'use client';

import { useState } from 'react';
import { cva } from 'cva';

import SidebarContext from '~/lib/contexts/sidebar';
import UserSessionContext from '~/core/session/contexts/user-session';
import type UserSession from '~/core/session/types/user-session';
import AdminSidebar from './AdminSidebar';
import AdminMobileHeader from './AdminMobileHeader';
import AdminMobileNavigation from './AdminMobileNavigation';
import { Page } from '~/core/ui/Page';

interface AdminRouteShellProps {
  children: React.ReactNode;
  userSession: UserSession;
}

function AdminRouteShell({ children, userSession }: AdminRouteShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [userSessionState, setUserSessionState] = useState<Maybe<UserSession>>(userSession);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const className = contentClassName({ collapsed });

  return (
    <UserSessionContext.Provider value={{ userSession: userSessionState, setUserSession: setUserSessionState }}>
      <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
        <Page contentContainerClassName={className} sidebar={<AdminSidebar />}>
          <AdminMobileHeader onMenuOpen={() => setMobileMenuOpen(true)} />
          {children}
        </Page>
        <AdminMobileNavigation isOpen={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />
      </SidebarContext.Provider>
    </UserSessionContext.Provider>
  );
}

export default AdminRouteShell;

const contentClassName = cva(
  ['ml-0 mr-0 overflow-x-hidden transition-[margin] duration-300 ease-in-out motion-reduce:transition-none'],
  {
    variants: {
      collapsed: {
        true: 'lg:ml-[5rem]',
        false: 'lg:ml-[15.3rem]',
      },
    },
  },
);
