export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { headers } from 'next/headers';

import { isUserSuperAdminWithoutMfa } from '~/app/admin/utils/is-user-super-admin';
import AdminSidebar from '~/app/admin/components/AdminSidebar';
import getLanguageCookie from '~/i18n/get-language-cookie';
import AdminProviders from '~/app/admin/components/AdminProviders';
import { Page } from '~/core/ui/Page';

async function AdminLayout({ children }: React.PropsWithChildren) {
  const isAdmin = await isUserSuperAdminWithoutMfa();

  const language = getLanguageCookie();

  if (!isAdmin) {
    notFound();
  }

  const csrfToken = headers().get('X-CSRF-Token');

  const className =
    'ml-0 transition-[margin] duration-300 motion-reduce:transition-none lg:ml-[15.3rem]';

  return (
    <AdminProviders csrfToken={csrfToken} language={language}>
      <Page contentContainerClassName={className} sidebar={<AdminSidebar />}>
        {children}
      </Page>
    </AdminProviders>
  );
}

export default AdminLayout;
