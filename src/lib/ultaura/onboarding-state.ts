'use server';

import { randomUUID } from 'crypto';
import { z } from 'zod';

import getLogger from '~/core/logger';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import type { Json } from '~/database.types';
import requireSession from '~/lib/user/require-session';

const logger = getLogger();

const ONBOARDING_STATE_TTL_MS = 60 * 60 * 1000;
const MIN_ONBOARDING_STATE_TTL_MS = 60 * 1000;
const EVENT_INVALID_SAVE_PAYLOAD = 'onboarding_state_save_invalid_payload';
const EVENT_SAVE_FAILED = 'onboarding_state_save_failed';
const EVENT_LOAD_MISSING_TOKEN = 'onboarding_state_load_missing_token';
const EVENT_LOAD_FAILED = 'onboarding_state_load_failed';
const EVENT_LOAD_INVALID_SHAPE = 'onboarding_state_load_invalid_shape';
const ONBOARDING_STATE_TABLE = 'ultaura_onboarding_state';

const onboardingStateSchema = z.object({
  currentStep: z.number().int().min(0),
  data: z.record(z.unknown()),
  billingInterval: z.enum(['monthly', 'annual']).optional(),
  selectedPlanId: z.string().optional(),
  stripeSessionId: z.string().optional(),
});

export type PersistedOnboardingState = z.infer<typeof onboardingStateSchema>;

function createStateToken() {
  return `ob_${randomUUID().replaceAll('-', '')}`;
}

export async function persistOnboardingState(
  state: PersistedOnboardingState,
  params?: {
    ttlMs?: number;
  },
): Promise<{ success: boolean; stateToken?: string; error?: string }> {
  const parsedState = onboardingStateSchema.safeParse(state);

  if (!parsedState.success) {
    logger.warn(
      {
        eventKey: EVENT_INVALID_SAVE_PAYLOAD,
        issueCount: parsedState.error.issues.length,
      },
      'Invalid onboarding state payload',
    );

    return {
      success: false,
      error: 'Invalid onboarding state payload',
    };
  }

  const client = getSupabaseServerActionClient();
  const adminClient = getSupabaseServerActionClient({ admin: true });
  const session = await requireSession(client);
  const stateToken = createStateToken();

  const ttlMs = Math.max(
    params?.ttlMs ?? ONBOARDING_STATE_TTL_MS,
    MIN_ONBOARDING_STATE_TTL_MS,
  );
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  const { error } = await adminClient.from(ONBOARDING_STATE_TABLE).insert({
    state_token: stateToken,
    auth_user_id: session.user.id,
    state: parsedState.data as Json,
    expires_at: expiresAt,
  });

  if (error) {
    logger.error(
      {
        eventKey: EVENT_SAVE_FAILED,
        error,
        userId: session.user.id,
      },
      'Failed to persist onboarding state',
    );
    return {
      success: false,
      error: 'Failed to persist onboarding state',
    };
  }

  return {
    success: true,
    stateToken,
  };
}

export async function consumeOnboardingState(stateToken: string): Promise<{
  success: boolean;
  state?: PersistedOnboardingState;
  error?: string;
}> {
  const token = stateToken.trim();

  if (!token) {
    logger.warn(
      {
        eventKey: EVENT_LOAD_MISSING_TOKEN,
      },
      'Missing onboarding state token on load',
    );

    return {
      success: false,
      error: 'Missing state token',
    };
  }

  const client = getSupabaseServerActionClient();
  const adminClient = getSupabaseServerActionClient({ admin: true });
  const session = await requireSession(client);
  const nowIso = new Date().toISOString();

  const { data, error } = await adminClient
    .from(ONBOARDING_STATE_TABLE)
    .delete()
    .eq('state_token', token)
    .eq('auth_user_id', session.user.id)
    .gt('expires_at', nowIso)
    .select('state')
    .maybeSingle();

  if (error) {
    logger.error(
      {
        eventKey: EVENT_LOAD_FAILED,
        error,
        userId: session.user.id,
      },
      'Failed to consume onboarding state',
    );
    return {
      success: false,
      error: 'Failed to consume onboarding state',
    };
  }

  if (!data?.state) {
    return {
      success: false,
      error: 'Onboarding state not found or expired',
    };
  }

  const parsedState = onboardingStateSchema.safeParse(data.state);

  if (!parsedState.success) {
    logger.warn(
      {
        eventKey: EVENT_LOAD_INVALID_SHAPE,
        userId: session.user.id,
        issueCount: parsedState.error.issues.length,
      },
      'Stored onboarding state has invalid shape',
    );

    return {
      success: false,
      error: 'Onboarding state is invalid',
    };
  }

  return {
    success: true,
    state: parsedState.data,
  };
}
