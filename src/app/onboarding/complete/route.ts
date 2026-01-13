'use server';

import { z } from 'zod';

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import getLogger from '~/core/logger';
import requireSession from '~/lib/user/require-session';
import completeOnboarding from '~/lib/server/onboarding/complete-onboarding';

import { createOrganizationIdCookie } from '~/lib/server/cookies/organization.cookie';
import { throwInternalServerErrorException } from '~/core/http-exceptions';
import MembershipRole from '~/lib/organizations/types/membership-role';
import inviteMembers from '~/lib/server/organizations/invite-members';
import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';

import { BILLING, PLANS, TRIAL_ELIGIBLE_PLANS } from '~/lib/ultaura/constants';
import { createLine } from '~/lib/ultaura/lines';
import { getUserDataById } from '~/lib/server/queries';

export const POST = async (req: NextRequest) => {
  const logger = getLogger();

  const client = getSupabaseRouteHandlerClient();
  const adminClient = getSupabaseRouteHandlerClient({ admin: true });
  const session = await requireSession(client);
  const userId = session.user.id;

  let body;
  try {
    const json = await req.json();
    body = await getOnboardingBodySchema().parseAsync(json);
  } catch (error) {
    logger.warn({ error, userId }, 'Invalid onboarding request body');
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 },
    );
  }

  const userRecord = await getUserDataById(client, userId).catch(() => null);
  const displayName = userRecord?.displayName?.trim() || '';
  const emailPrefix = session.user.email?.split('@')[0] || '';
  const fallbackName = emailPrefix || 'My Account';
  const accountName = displayName || fallbackName;

  const organizationName =
    body.userType === 'self' ? accountName : body.organization;
  const selectedPlanId = body.selectedPlanId;
  const invites = body.invites;

  const payload = {
    userId,
    organizationName,
    client,
  };

  logger.info(
    {
      userId,
    },
    `Completing onboarding for user...`,
  );

  // complete onboarding and get the organization id created
  const { data: organizationUid, error } = await completeOnboarding(payload);

  if (error) {
    logger.error(
      {
        error,
        userId,
      },
      `Error completing onboarding for user`,
    );

    return throwInternalServerErrorException();
  }

  if (body.userType === 'family_managed' && invites.length > 0) {
    logger.info(
      {
        invites: invites.length,
      },
      `Processing ${invites.length} members invites...`,
    );

    await inviteMembers({
      organizationUid,
      invites,
      client,
      adminClient: getSupabaseRouteHandlerClient({
        admin: true,
      }),
      inviterId: userId,
    });
  }

  // Create Ultaura account with a 3-day trial on the chosen plan (no credit card required)
  let accountId: string | null = null;
  try {
    const { data: orgRow, error: orgError } = await adminClient
      .from('organizations')
      .select('id')
      .eq('uuid', organizationUid)
      .single();

    if (orgError || !orgRow) {
      logger.error({ orgError, organizationUid }, 'Failed to fetch organization for Ultaura account creation');
      return throwInternalServerErrorException();
    }

    const { data: existingAccount, error: existingAccountError } = await adminClient
      .from('ultaura_accounts')
      .select('id')
      .eq('organization_id', orgRow.id)
      .maybeSingle();

    if (existingAccountError) {
      logger.error({ existingAccountError, organizationUid }, 'Failed to check existing Ultaura account');
      return throwInternalServerErrorException();
    }

    if (!existingAccount) {
      const plan = PLANS[selectedPlanId];
      const now = new Date();
      const trialEnds = new Date(
        now.getTime() + BILLING.TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000,
      );

      const { data: accountRow, error: accountError } = await adminClient
        .from('ultaura_accounts')
        .insert({
          organization_id: orgRow.id,
          name: organizationName,
          billing_email: session.user.email ?? '',
          created_by_user_id: userId,
          status: 'trial',
          plan_id: selectedPlanId,
          trial_plan_id: selectedPlanId,
          trial_starts_at: now.toISOString(),
          trial_ends_at: trialEnds.toISOString(),
          minutes_included: plan.minutesIncluded,
          minutes_used: 0,
          cycle_start: now.toISOString(),
          cycle_end: trialEnds.toISOString(),
          user_type: body.userType,
          sharing_enabled: body.userType === 'family_managed',
          sharing_enabled_at: null,
        })
        .select('id')
        .single();

      if (accountError) {
        logger.error({ accountError, organizationUid }, 'Failed to create Ultaura account during onboarding');
        return throwInternalServerErrorException();
      }

      accountId = accountRow?.id ?? null;
    } else {
      accountId = existingAccount.id;
    }
  } catch (error) {
    logger.error({ error, organizationUid }, 'Failed to create Ultaura account during onboarding');
    return throwInternalServerErrorException();
  }

  if (!accountId) {
    logger.error({ organizationUid }, 'Missing Ultaura account ID after onboarding');
    return throwInternalServerErrorException();
  }

  const lineName = body.userType === 'self'
    ? (displayName || 'My Account')
    : body.lovedOneName;

  const linePhone = body.userType === 'self'
    ? body.selfPhoneE164
    : body.lovedOnePhoneE164;

  const lineTimezone = body.userType === 'self'
    ? body.selfTimezone
    : body.lovedOneTimezone;

  const lineResult = await createLine({
    accountId,
    displayName: lineName,
    phoneE164: linePhone,
    timezone: lineTimezone,
  });

  if (!lineResult.success || !lineResult.data) {
    logger.error({ error: lineResult.error, organizationUid }, 'Failed to create line during onboarding');
    return throwInternalServerErrorException();
  }

  if (body.userType === 'self' && body.selfBirthday) {
    const { error: milestoneError } = await adminClient
      .from('ultaura_milestones')
      .insert({
        account_id: accountId,
        line_id: lineResult.data.lineId,
        milestone_type: 'birthday',
        title: 'My Birthday',
        date_month: body.selfBirthday.month,
        date_day: body.selfBirthday.day,
        is_recurring: true,
        source: 'family_input',
        privacy_scope: 'line_only',
      });

    if (milestoneError) {
      logger.warn({ milestoneError, organizationUid }, 'Failed to create birthday milestone during onboarding');
    }
  }

  logger.info(
    {
      userId,
      organizationUid,
    },
    `Onboarding successfully completed for user`,
  );

  cookies().set(createOrganizationIdCookie({ userId, organizationUid }));

  const returnUrl = `/dashboard/lines/${lineResult.data.shortId}/verify`;

  return NextResponse.json({
    success: true,
    returnUrl,
  });
};

function getOnboardingBodySchema() {
  const phoneSchema = z.string().regex(/^\+1[2-9]\d{9}$/);

  return z
    .object({
      userType: z.enum(['self', 'family_managed']),
      organization: z.string().trim().optional().default(''),
      selectedPlanId: z.enum(TRIAL_ELIGIBLE_PLANS),
      invites: z
        .array(
          z.object({
            email: z.string().email(),
            role: z.nativeEnum(MembershipRole),
          }),
        )
        .optional()
        .default([]),
      selfPhoneE164: phoneSchema.optional(),
      selfTimezone: z.string().optional(),
      selfBirthday: z
        .object({
          month: z.number().int().min(1).max(12),
          day: z.number().int().min(1).max(31),
        })
        .nullable()
        .optional(),
      lovedOneName: z.string().trim().optional(),
      lovedOnePhoneE164: phoneSchema.optional(),
      lovedOneTimezone: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.userType === 'self') {
        if (!data.selfPhoneE164) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['selfPhoneE164'],
            message: 'Phone is required',
          });
        }
        if (!data.selfTimezone) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['selfTimezone'],
            message: 'Timezone is required',
          });
        }
        return;
      }

      if (!data.organization) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['organization'],
          message: 'Organization is required',
        });
      }
      if (!data.lovedOneName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['lovedOneName'],
          message: 'Loved one name is required',
        });
      }
      if (!data.lovedOnePhoneE164) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['lovedOnePhoneE164'],
          message: 'Phone is required',
        });
      }
      if (!data.lovedOneTimezone) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['lovedOneTimezone'],
          message: 'Timezone is required',
        });
      }
    });
}
