export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import getLogger from '~/core/logger';
import {
  inviteNotificationRecipient,
  NotificationInviteSendError,
  rollbackNotificationInviteMutation,
} from '~/lib/ultaura/notification-recipients';

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
  relationship: z.string().optional(),
  addAsTrustedContact: z.boolean().optional(),
  allowReinvite: z.boolean().optional(),
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
        relationship: inviteInput.relationship,
        addAsTrustedContact: inviteInput.addAsTrustedContact,
        allowReinvite: inviteInput.allowReinvite,
      },
      { client: supabase }
    );

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    if (error instanceof NotificationInviteSendError) {
      const rollbackResult = await rollbackNotificationInviteMutation(error.context, {
        client: supabase,
      });
      if (!rollbackResult.success) {
        logger.error(
          { rollbackError: rollbackResult.error, context: error.context },
          'Failed to rollback invite mutation after email send failure'
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVITE_SEND_FAILED',
            message: 'We could not send the invite email. Please try again.',
          },
        },
        { status: 502 }
      );
    }

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
