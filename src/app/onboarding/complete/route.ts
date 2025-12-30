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

import configuration from '~/configuration';
import { BILLING, PLANS, TRIAL_ELIGIBLE_PLANS } from '~/lib/ultaura/constants';

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

  const organizationName = body.organization;
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

  // Create Ultaura account with a 3-day trial on the chosen plan (no credit card required)
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

      const { error: accountError } = await adminClient
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
        });

      if (accountError) {
        logger.error({ accountError, organizationUid }, 'Failed to create Ultaura account during onboarding');
        return throwInternalServerErrorException();
      }
    }
  } catch (error) {
    logger.error({ error, organizationUid }, 'Failed to create Ultaura account during onboarding');
    return throwInternalServerErrorException();
  }

  logger.info(
    {
      userId,
      organizationUid,
    },
    `Onboarding successfully completed for user`,
  );

  cookies().set(createOrganizationIdCookie({ userId, organizationUid }));

  const returnUrl = configuration.paths.appHome;

  return NextResponse.json({
    success: true,
    returnUrl,
  });
};

function getOnboardingBodySchema() {
  return z.object({
    organization: z.string().trim().min(1),
    selectedPlanId: z.enum(TRIAL_ELIGIBLE_PLANS),
    invites: z.array(
      z.object({
        email: z.string().email(),
        role: z.nativeEnum(MembershipRole),
      }),
    ),
  });
}
