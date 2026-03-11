export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import getLogger from '~/core/logger';
import { ErrorCodes } from '@ultaura/schemas';
import { inviteNotificationRecipient } from '~/lib/ultaura/notification-recipients';

const E164_PHONE_REGEX = /^\+[1-9]\d{1,14}$/;
const logger = getLogger();

const InviteSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  phoneE164: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().regex(E164_PHONE_REGEX, 'Invalid E.164 phone number').optional(),
  ),
  deliveryChannel: z.enum(['email', 'sms', 'both']).optional(),
  smsConsentAcknowledgedAt: z.string().datetime().nullable().optional(),
  relationship: z.string().optional(),
  addAsTrustedContact: z.boolean().optional(),
  allowReinvite: z.boolean().optional(),
}).superRefine((value, ctx) => {
  const requiresSms = value.deliveryChannel === 'sms' || value.deliveryChannel === 'both';
  if (requiresSms && !value.phoneE164) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['phoneE164'],
      message: 'Phone number is required for SMS alerts',
    });
  }
  if (requiresSms && !value.smsConsentAcknowledgedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['smsConsentAcknowledgedAt'],
      message: 'SMS consent is required for SMS alerts',
    });
  }
});

export async function POST(request: Request) {
  const supabase = getSupabaseRouteHandlerClient();
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = InviteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const inviteInput = parsed.data;

    const { data: account, error: accountError } = await supabase
      .from('ultaura_accounts')
      .select('id')
      .eq('id', inviteInput.accountId)
      .eq('created_by_user_id', user.id)
      .maybeSingle();

    if (accountError || !account) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const result = await inviteNotificationRecipient(
      inviteInput.accountId,
      {
        name: inviteInput.name,
        email: inviteInput.email,
        phoneE164: inviteInput.phoneE164,
        deliveryChannel: inviteInput.deliveryChannel,
        smsConsentAcknowledgedAt: inviteInput.smsConsentAcknowledgedAt ?? undefined,
        relationship: inviteInput.relationship,
        addAsTrustedContact: inviteInput.addAsTrustedContact,
        allowReinvite: inviteInput.allowReinvite,
      },
      { client: supabase }
    );

    if (!result.success) {
      const status =
        result.error.code === ErrorCodes.FORBIDDEN
          ? 403
          : result.error.code === ErrorCodes.UNAUTHORIZED
            ? 401
            : result.error.code === ErrorCodes.EXTERNAL_SERVICE_ERROR
              ? 502
              : result.error.code === ErrorCodes.DATABASE_ERROR
                ? 500
                : 400;

      return NextResponse.json({ success: false, error: result.error }, { status });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    logger.error({ error }, 'Invite API route failed');
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Unable to process invite right now. Please try again.',
        },
      },
      { status: 500 }
    );
  }
}
