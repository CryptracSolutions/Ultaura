export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { headers } from 'next/headers';

import { isUserSuperAdminWithoutMfa } from '~/app/admin/utils/is-user-super-admin';
import getLanguageCookie from '~/i18n/get-language-cookie';
import AdminProviders from '~/app/admin/components/AdminProviders';
import AdminRouteShell from '~/app/admin/components/AdminRouteShell';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';

async function AdminLayout({ children }: React.PropsWithChildren) {
  const isAdmin = await isUserSuperAdminWithoutMfa();
  const language = getLanguageCookie();

  if (!isAdmin) {
    notFound();
  }

  const csrfToken = headers().get('X-CSRF-Token');

  const client = getSupabaseServerComponentClient();
  const { data: { session } } = await client.auth.getSession();

  let userSession = {
    auth: {
      user: {
        id: session?.user?.id ?? '',
        email: session?.user?.email ?? null,
        phone: session?.user?.phone ?? null,
      },
    },
    data: undefined as undefined,
    role: undefined as undefined,
  };

  if (session?.user?.id) {
    const { data: userData } = await client
      .from('users')
      .select('id, display_name, photo_url, onboarded')
      .eq('id', session.user.id)
      .single();

    if (userData) {
      userSession = {
        ...userSession,
        data: {
          id: userData.id,
          displayName: userData.display_name,
          photoUrl: userData.photo_url,
          onboarded: userData.onboarded,
        } as any,
      };
    }
  }

  return (
    <AdminProviders csrfToken={csrfToken} language={language}>
      <AdminRouteShell userSession={userSession as any}>
        {children}
      </AdminRouteShell>
    </AdminProviders>
  );
}

export default AdminLayout;
