import { NextResponse } from 'next/server';
import { z } from 'zod';
import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import { inviteNotificationRecipient } from '~/lib/ultaura/notification-recipients';

const InviteSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  phoneE164: z.string().optional(),
  relationship: z.string().optional(),
  addAsTrustedContact: z.boolean().optional(),
  allowReinvite: z.boolean().optional(),
});

export async function POST(request: Request) {
  const supabase = getSupabaseRouteHandlerClient();
  const { data } = await supabase.auth.getSession();

  if (!data.session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = InviteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const result = await inviteNotificationRecipient(parsed.data.accountId, {
    name: parsed.data.name,
    email: parsed.data.email,
    phoneE164: parsed.data.phoneE164,
    relationship: parsed.data.relationship,
    addAsTrustedContact: parsed.data.addAsTrustedContact,
    allowReinvite: parsed.data.allowReinvite,
  });

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: result.data });
}
