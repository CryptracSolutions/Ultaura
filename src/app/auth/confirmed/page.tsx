import { redirect } from 'next/navigation';
import configuration from '~/configuration';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import ConfirmedInterstitial from './ConfirmedInterstitial';
import { resolveInvite } from '~/lib/memberships/invite-resolution';
import PendingEmailConfirmation from './PendingEmailConfirmation';

export default async function ConfirmedPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const inviteCode = getFirstQueryValue(searchParams?.inviteCode);
  const pending = getFirstQueryValue(searchParams?.pending) === '1';
  const email = getFirstQueryValue(searchParams?.email);
  const requestedNextPath = getFirstQueryValue(searchParams?.next);
  let next = getSafeNextPath(requestedNextPath);

  if (pending && email) {
    return (
      <PendingEmailConfirmation
        email={email}
        inviteCode={inviteCode}
        nextPath={next}
      />
    );
  }

  const client = getSupabaseServerComponentClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user?.email_confirmed_at) {
    redirect(configuration.paths.signUp);
  }

  if (inviteCode) {
    const adminClient = getSupabaseServerComponentClient({ admin: true });
    const inviteResolution = await resolveInvite({
      client: adminClient,
      code: inviteCode,
      userId: user.id,
      userEmail: user.email,
      consume: false,
      activateOrganization: true,
    });

    if (inviteResolution.status === 'invalid' || inviteResolution.status === 'failed') {
      const fallbackToNextPath = Boolean(user.email_confirmed_at && requestedNextPath);
      if (!fallbackToNextPath) {
        redirect(configuration.paths.signIn);
      }
    }

    if (inviteResolution.status === 'consumed') {
      redirect(inviteResolution.destination);
    }

    if (inviteResolution.status === 'wrong_account') {
      redirect(`/invite/${encodeURIComponent(inviteCode)}`);
    }

    if (
      inviteResolution.status === 'ready' ||
      inviteResolution.status === 'accepted'
    ) {
      next = inviteResolution.destination;
    }
  }

  return <ConfirmedInterstitial next={next} autoRedirect />;
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
