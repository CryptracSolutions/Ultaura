import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import requireSession from '~/lib/user/require-session';
import GlobalRole from '~/core/session/types/global-role';
import getLanguageCookie from '~/i18n/get-language-cookie';
import AdminProviders from '~/app/admin/components/AdminProviders';
import { Page } from '~/core/ui/Page';
import UltauraAdminSidebar from './components/UltauraAdminSidebar';

async function UltauraAdminLayout({ children }: React.PropsWithChildren) {
  const client = getSupabaseServerComponentClient();
  const session = await requireSession(client);
  const { data } = await client.auth.getUser();
  const user = data.user ?? session.user;

  const isUltauraAdmin = Boolean(user?.email?.endsWith('@ultaura.com'));
  const isSuperAdmin = user?.app_metadata?.role === GlobalRole.SuperAdmin;

  if (!isUltauraAdmin && !isSuperAdmin) {
    notFound();
  }

  const csrfToken = headers().get('X-CSRF-Token');
  const language = getLanguageCookie();
  const className =
    'ml-0 transition-[margin] duration-300' +
    ' motion-reduce:transition-none lg:ml-[17rem]';

  return (
    <AdminProviders csrfToken={csrfToken} language={language}>
      <Page contentContainerClassName={className} sidebar={<UltauraAdminSidebar />}>
        {children}
      </Page>
    </AdminProviders>
  );
}

export default UltauraAdminLayout;
