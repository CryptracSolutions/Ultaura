import { redirect } from 'next/navigation';
import Link from 'next/link';

import {
  isUserSuperAdminWithoutMfa,
  isUserMfaAuthenticated,
  getEnforceMfa,
} from '~/app/admin/utils/is-user-super-admin';
import { PageBody } from '~/core/ui/Page';
import AdminHeader from '~/app/admin/components/AdminHeader';
import Alert from '~/core/ui/Alert';
import Button from '~/core/ui/Button';
import configuration from '~/configuration';

export const metadata = {
  title: `Admin MFA Setup | ${configuration.site.siteName}`,
};

async function AdminMfaPage() {
  const isSuperAdmin = await isUserSuperAdminWithoutMfa();

  if (!isSuperAdmin) {
    redirect('/');
  }

  const enforceMfa = getEnforceMfa();
  const hasMfa = await isUserMfaAuthenticated();

  if (hasMfa) {
    redirect('/admin');
  }

  return (
    <div className={'flex flex-col flex-1 items-center justify-center p-8'}>
      <div className={'w-full max-w-md space-y-6'}>
        <h1 className={'text-2xl font-bold text-center'}>Admin Access</h1>

        {enforceMfa ? (
          <Alert type={'warn'}>
            <Alert.Heading>MFA Required</Alert.Heading>
            Multi-factor authentication is required to access the Admin panel.
            Please set up MFA on your account first.
          </Alert>
        ) : (
          <Alert type={'info'}>
            <Alert.Heading>MFA Recommended</Alert.Heading>
            Multi-factor authentication is recommended for admin access. MFA
            enforcement is currently disabled.
          </Alert>
        )}

        <div className={'flex flex-col gap-3'}>
          <Button asChild block>
            <Link href={'/settings/profile'}>Set Up MFA</Link>
          </Button>

          {!enforceMfa && (
            <Button asChild variant={'outline'} block>
              <Link href={'/admin'}>Continue Without MFA</Link>
            </Button>
          )}

          <Button asChild variant={'ghost'} block>
            <Link href={'/dashboard'}>Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AdminMfaPage;
