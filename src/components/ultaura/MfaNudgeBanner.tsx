import { cookies } from 'next/headers';

import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';

import { MfaNudgeBannerClient } from './MfaNudgeBannerClient';

export async function MfaNudgeBanner() {
  const cookieStore = await cookies();
  const dismissedAt = cookieStore.get('mfa-nudge-dismissed')?.value;

  if (dismissedAt) {
    const dismissedDate = new Date(dismissedAt);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    if (dismissedDate > thirtyDaysAgo) return null;
  }

  try {
    const client = getSupabaseServerComponentClient();
    const { data: factors, error } = await client.auth.mfa.listFactors();

    if (error) return null;

    const verifiedCount =
      (factors?.totp?.filter((f) => f.status === 'verified').length ?? 0) +
      (factors?.phone?.filter((f) => f.status === 'verified').length ?? 0);

    if (verifiedCount > 0) return null;

    return <MfaNudgeBannerClient />;
  } catch {
    return null;
  }
}
