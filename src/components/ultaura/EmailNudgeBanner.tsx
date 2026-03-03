import { cookies } from 'next/headers';

import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';

import { EmailNudgeBannerClient } from './EmailNudgeBannerClient';

export async function EmailNudgeBanner() {
  const cookieStore = await cookies();
  const dismissedAt = cookieStore.get('email-nudge-dismissed')?.value;

  if (dismissedAt) {
    const dismissedDate = new Date(dismissedAt);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    if (dismissedDate > thirtyDaysAgo) return null;
  }

  try {
    const client = getSupabaseServerComponentClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();

    if (error || !user) return null;

    const identities = user.identities ?? [];
    const hasEmail = identities.some(
      (identity) => identity.provider === 'email',
    );

    if (hasEmail) return null;

    return <EmailNudgeBannerClient />;
  } catch {
    return null;
  }
}
