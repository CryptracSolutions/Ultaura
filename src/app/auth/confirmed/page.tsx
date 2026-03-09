import { redirect } from 'next/navigation';
import configuration from '~/configuration';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import ConfirmedInterstitial from './ConfirmedInterstitial';

export default async function ConfirmedPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const next = getSafeNextPath(getFirstQueryValue(searchParams?.next));
  const client = getSupabaseServerComponentClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user?.email_confirmed_at) {
    redirect(configuration.paths.signUp);
  }

  return <ConfirmedInterstitial next={next} />;
}

function getSafeNextPath(value?: string) {
  if (!value) {
    return configuration.paths.onboarding;
  }

  if (!value.startsWith('/') || value.startsWith('//')) {
    return configuration.paths.onboarding;
  }

  return value;
}

function getFirstQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
