import { redirect } from 'next/navigation';
import { SupabaseClient } from '@supabase/supabase-js';

import Heading from '~/core/ui/Heading';
import Trans from '~/core/ui/Trans';

import getLogger from '~/core/logger';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';

import { getMembershipByInviteCode } from '~/lib/memberships/queries';
import ExistingUserInviteForm from '~/app/invite/components/ExistingUserInviteForm';
import { withI18n } from '~/i18n/with-i18n';
import { Database } from '~/database.types';
import { resolveInvite } from '~/lib/memberships/invite-resolution';

interface Context {
  params: {
    code: string;
  };
}

export const metadata = {
  title: `Join Organization`,
};

async function InvitePage({ params }: Context) {
  const code = params.code;
  const data = await loadInviteData(code);

  if (!data.membership) {
    redirect(data.userEmail ? '/dashboard' : '/auth/sign-in');
  }

  const organization = data.membership.organization;
  const invitedEmail = data.membership.invitedEmail?.trim().toLowerCase() ?? '';
  const signedInEmail = data.userEmail.trim().toLowerCase();
  const hasSignedInUser = Boolean(data.userId);
  const isEmailMismatch =
    Boolean(invitedEmail) && Boolean(signedInEmail) && invitedEmail !== signedInEmail;

  if (!hasSignedInUser) {
    redirect(`/auth/sign-up?inviteCode=${encodeURIComponent(code)}`);
  }

  if (!isEmailMismatch) {
    const adminClient = getSupabaseServerComponentClient({ admin: true });
    const inviteResolution = await resolveInvite({
      client: adminClient,
      code,
      userId: data.userId!,
      userEmail: data.userEmail,
    });

    if (inviteResolution.status === 'accepted') {
      redirect(inviteResolution.destination);
    }

    if (
      inviteResolution.status === 'consumed' ||
      inviteResolution.status === 'invalid'
    ) {
      redirect('/dashboard');
    }

    if (inviteResolution.status === 'failed') {
      redirect('/auth/invite-error');
    }
  }

  return (
    <>
      <Heading type={4}>
        <Trans
          i18nKey={'auth:joinOrganizationHeading'}
          values={{
            organization: organization.name,
          }}
        />
      </Heading>

      <div>
        <p className={'text-center'}>
          <Trans
            i18nKey={'auth:joinOrganizationSubHeading'}
            values={{
              organization: organization.name,
            }}
            components={{ b: <b /> }}
          />
        </p>

        <p className={'text-center text-sm text-muted-foreground'}>
        <Trans
          i18nKey={'auth:clickToAcceptAs'}
          values={{ email: invitedEmail || data.userEmail }}
          components={{ b: <b /> }}
        />
        </p>
      </div>

      <ExistingUserInviteForm
        code={code}
        email={data.userEmail}
        mode={'wrongAccount'}
        invitedEmail={invitedEmail}
      />
    </>
  );
}

export default withI18n(InvitePage);

async function loadInviteData(code: string) {
  const logger = getLogger();
  const client = getSupabaseServerComponentClient();

  // we use an admin client to be able to read the pending membership
  // without having to be logged in
  const adminClient = getSupabaseServerComponentClient({ admin: true });

  const { data: membership, error } = await getInvite(adminClient, code);

  // If the invite is missing or consumed, send the user to the appropriate auth destination.
  if (error) {
    logger.warn(
      {
        code,
        error,
      },
      `User navigated to invite page, but it wasn't found.`,
    );
  }

  const { data: {
    user
  } } = await client.auth.getUser();

  const userId = user?.id ?? '';
  const userEmail = user?.email ?? '';

  return {
    userId,
    userEmail,
    membership,
    code,
  };
}

async function getInvite(adminClient: SupabaseClient<Database>, code: string) {
  return getMembershipByInviteCode<{
    id: number;
    code: string;
    invitedEmail?: string | null;
    organization: {
      name: string;
      id: number;
    };
  }>(adminClient, {
    code,
    query: `
      id,
      code,
      invitedEmail: invited_email,
      organization: organization_id (
        name,
        id
      )
    `,
  });
}
