export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import getLogger from '~/core/logger';
import type { TelephonyHealthContext } from '@ultaura/types';
import { isHealthFeatureEnabled, isHealthEligiblePlan } from '~/lib/ultaura/health/entitlements';
import { getPendingNoticesForLine } from '~/lib/ultaura/health/call-notices';
import { decryptHealthPayload } from '~/lib/ultaura/health/crypto';

const logger = getLogger();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateWebhookSecret(request: NextRequest): NextResponse | null {
  const expectedSecret = process.env.ULTAURA_INTERNAL_API_SECRET;
  const providedSecret = request.headers.get('x-webhook-secret');

  if (!expectedSecret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (!providedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const providedBuffer = Buffer.from(providedSecret, 'utf8');
  const expectedBuffer = Buffer.from(expectedSecret, 'utf8');

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(
      Uint8Array.from(providedBuffer),
      Uint8Array.from(expectedBuffer),
    )
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

export async function GET(request: NextRequest) {
  // 1. Validate internal secret
  const authError = validateWebhookSecret(request);
  if (authError) return authError;

  // 2. Validate contract version header
  const contractVersion = request.headers.get('x-ultaura-health-contract-version');
  if (contractVersion !== 'v1') {
    return NextResponse.json(
      { error: 'Missing or unsupported x-ultaura-health-contract-version header' },
      { status: 400 },
    );
  }

  // 3. Validate query params
  const { searchParams } = request.nextUrl;
  const lineId = searchParams.get('lineId');
  const callSessionId = searchParams.get('callSessionId');

  if (!lineId || !callSessionId) {
    return NextResponse.json({ error: 'Missing lineId or callSessionId' }, { status: 400 });
  }

  if (!UUID_REGEX.test(lineId) || !UUID_REGEX.test(callSessionId)) {
    return NextResponse.json({ error: 'Invalid UUID format' }, { status: 400 });
  }

  try {
    const client = getSupabaseRouteHandlerClient({ admin: true });

    // 4. Validate callSessionId belongs to lineId
    const { data: session, error: sessionError } = await client
      .from('ultaura_call_sessions')
      .select('id, line_id, account_id')
      .eq('id', callSessionId)
      .eq('line_id', lineId)
      .maybeSingle();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found or line mismatch' }, { status: 404 });
    }

    // 5. Load consent state
    const { data: consentState } = await client
      .from('ultaura_health_line_consent')
      .select(
        'health_consent, health_consent_requested_at, health_last_prompted_at, self_explanation_requested_at, self_explanation_last_prompted_at',
      )
      .eq('line_id', lineId)
      .maybeSingle();

    const healthConsent = (consentState?.health_consent ?? 'not_requested') as
      | 'not_requested'
      | 'granted'
      | 'denied'
      | 'revoked';

    // 6. Load account for user_type, plan_id, and status
    const { data: account } = await client
      .from('ultaura_accounts')
      .select('id, user_type, plan_id, status')
      .eq('id', session.account_id)
      .single();

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // 7. Determine canUseHealthInCall
    const featureEnabled = await isHealthFeatureEnabled();
    const planEligible = isHealthEligiblePlan(account.plan_id ?? '', account.status ?? '');
    const canUseHealthInCall = healthConsent === 'granted' && featureEnabled && planEligible;

    // 8. Build consent/explanation prompts
    const isFamilyManaged = account.user_type === 'family_managed';

    let familyManagedConsentPrompt: TelephonyHealthContext['familyManagedConsentPrompt'] = null;
    if (isFamilyManaged) {
      const requestedAt = consentState?.health_consent_requested_at ?? null;
      const lastPromptedAt = consentState?.health_last_prompted_at ?? null;
      const hasOutstandingOwnerRequest =
        healthConsent !== 'granted' &&
        requestedAt !== null &&
        (lastPromptedAt === null || requestedAt > lastPromptedAt);

      familyManagedConsentPrompt = {
        hasOutstandingOwnerRequest,
        requestedAt,
        lastPromptedAt,
      };
    }

    let selfManagedExplanationPrompt: TelephonyHealthContext['selfManagedExplanationPrompt'] = null;
    if (!isFamilyManaged) {
      const requestedAt = consentState?.self_explanation_requested_at ?? null;
      const lastPromptedAt = consentState?.self_explanation_last_prompted_at ?? null;
      const hasOutstandingOwnerRequest =
        requestedAt !== null && (lastPromptedAt === null || requestedAt > lastPromptedAt);

      selfManagedExplanationPrompt = {
        hasOutstandingOwnerRequest,
        requestedAt,
        lastPromptedAt,
      };
    }

    // 9. Load conditions and medications (only when canUseHealthInCall)
    let conditions: TelephonyHealthContext['conditions'] = [];
    let medications: TelephonyHealthContext['medications'] = [];

    if (canUseHealthInCall) {
      const accountId = session.account_id;

      // Load conditions: active + monitoring only
      const { data: conditionRows } = await client
        .from('ultaura_health_conditions')
        .select('id, status, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid')
        .eq('line_id', lineId)
        .in('status', ['active', 'monitoring'])
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (conditionRows && conditionRows.length > 0) {
        for (const row of conditionRows) {
          try {
            const plaintext = await decryptHealthPayload(accountId, lineId, {
              ciphertext: row.payload_ciphertext,
              iv: row.payload_iv,
              tag: row.payload_tag,
              alg: row.payload_alg,
              kid: row.payload_kid,
            });
            const payload = JSON.parse(plaintext) as { name: string };
            conditions.push({ name: payload.name, status: row.status as 'active' | 'monitoring' });
          } catch (err) {
            logger.error({ error: err, conditionId: row.id }, 'Failed to decrypt condition');
          }
        }
      }

      // Load medications: current + as_needed
      const { data: medicationRows } = await client
        .from('ultaura_health_medications')
        .select(
          'id, status, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid, created_at',
        )
        .eq('line_id', lineId)
        .in('status', ['current', 'as_needed'])
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (medicationRows && medicationRows.length > 0) {
        type MedEntry = {
          id: string;
          name: string;
          status: 'current' | 'as_needed';
          timesOfDay: string[];
          sortGroup: number;
          earliestTime: string;
        };
        const medEntries: MedEntry[] = [];

        for (const row of medicationRows) {
          try {
            const plaintext = await decryptHealthPayload(accountId, lineId, {
              ciphertext: row.payload_ciphertext,
              iv: row.payload_iv,
              tag: row.payload_tag,
              alg: row.payload_alg,
              kid: row.payload_kid,
            });
            const payload = JSON.parse(plaintext) as {
              name: string;
              timesOfDay?: string[];
            };

            const status = row.status as 'current' | 'as_needed';
            const timesOfDay: string[] = payload.timesOfDay ?? [];

            // Sort groups per spec Section 8.4:
            // 1: current with timesOfDay
            // 2: current without timesOfDay
            // 3: as_needed with timesOfDay
            // as_needed without timesOfDay excluded
            let sortGroup: number;
            if (status === 'current' && timesOfDay.length > 0) {
              sortGroup = 1;
            } else if (status === 'current') {
              sortGroup = 2;
            } else if (status === 'as_needed' && timesOfDay.length > 0) {
              sortGroup = 3;
            } else {
              continue; // as_needed without timesOfDay excluded
            }

            const earliestTime = timesOfDay.length > 0 ? [...timesOfDay].sort()[0] : 'ZZ:ZZ';
            medEntries.push({ id: row.id, name: payload.name, status, timesOfDay, sortGroup, earliestTime });
          } catch (err) {
            logger.error({ error: err, medicationId: row.id }, 'Failed to decrypt medication');
          }
        }

        // Deterministic sort: group → earliest time → name → id
        medEntries.sort((a, b) => {
          if (a.sortGroup !== b.sortGroup) return a.sortGroup - b.sortGroup;
          if (a.earliestTime !== b.earliestTime) return a.earliestTime.localeCompare(b.earliestTime);
          if (a.name !== b.name) return a.name.localeCompare(b.name);
          return a.id.localeCompare(b.id);
        });

        // Cap at 10
        medications = medEntries.slice(0, 10).map((m) => ({
          name: m.name,
          status: m.status,
          timesOfDay: m.timesOfDay,
        }));
      }
    }

    // 10. Load observations
    let observations: TelephonyHealthContext['observations'] = [];

    if (canUseHealthInCall) {
      const { ownerSafeSummary } = await import('~/lib/ultaura/health/owner-safe-summary');

      const { data: obsRows } = await client
        .from('ultaura_health_observations')
        .select('id, payload_ciphertext, payload_iv, payload_tag, payload_alg, payload_kid, created_at')
        .eq('line_id', lineId)
        .is('deleted_at', null);

      if (obsRows && obsRows.length > 0) {
        type ObsEntry = {
          id: string;
          text: string;
          category: string | null;
          concernLevel: string | null;
          observedDate: string | null;
          createdAt: string;
        };

        const decrypted: ObsEntry[] = [];

        for (const row of obsRows) {
          try {
            const plaintext = await decryptHealthPayload(session.account_id, lineId, {
              ciphertext: row.payload_ciphertext,
              iv: row.payload_iv,
              tag: row.payload_tag,
              alg: row.payload_alg,
              kid: row.payload_kid,
            });
            const parsed = JSON.parse(plaintext) as {
              text: string;
              category?: string | null;
              concernLevel?: string | null;
              observedDate?: string | null;
            };
            decrypted.push({
              id: row.id,
              text: parsed.text,
              category: parsed.category ?? null,
              concernLevel: parsed.concernLevel ?? null,
              observedDate: parsed.observedDate ?? null,
              createdAt: row.created_at,
            });
          } catch (err) {
            logger.error({ error: err, observationId: row.id }, 'Failed to decrypt observation');
          }
        }

        // Deterministic sort: coalesce(observedDate, createdAt date) desc, createdAt desc, id desc
        decrypted.sort((a, b) => {
          const dateA = a.observedDate || a.createdAt.split('T')[0];
          const dateB = b.observedDate || b.createdAt.split('T')[0];
          if (dateA !== dateB) return dateB.localeCompare(dateA);
          if (a.createdAt !== b.createdAt) return b.createdAt.localeCompare(a.createdAt);
          return b.id.localeCompare(a.id);
        });

        // Apply ownerSafeSummary and take top 3 non-rejected
        for (const obs of decrypted) {
          if (observations.length >= 3) break;
          const summary = ownerSafeSummary(obs.text);
          if (summary) {
            observations.push({
              ownerSafeSummary: summary,
              category: obs.category as TelephonyHealthContext['observations'][number]['category'],
              concernLevel: obs.concernLevel as TelephonyHealthContext['observations'][number]['concernLevel'],
              observedDate: obs.observedDate,
            });
          }
        }
      }
    }

    // 11. Load pending notices
    const pendingNotices = await getPendingNoticesForLine(lineId);

    // 12. Build and return response
    const context: TelephonyHealthContext = {
      schemaVersion: 'health-context-v1',
      lineId,
      consentStatus: healthConsent,
      canUseHealthInCall,
      familyManagedConsentPrompt,
      selfManagedExplanationPrompt,
      conditions,
      medications,
      observations,
      pendingNotices,
    };

    return NextResponse.json(context);
  } catch (error) {
    logger.error({ error, lineId, callSessionId }, 'Health context endpoint error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
