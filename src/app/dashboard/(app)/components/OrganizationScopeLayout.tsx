'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import useCollapsible from '~/core/hooks/use-sidebar-state';
import AppSidebar from '~/app/dashboard/(app)/components/AppSidebar';
import TopNavBar from '~/components/TopNavBar';
import MobileDashboardHeader from '~/components/MobileDashboardHeader';
import MobileAppNavigation from '~/components/MobileAppNavigation';
import HelpPanel from '~/components/HelpPanel';
import Toaster from '~/components/Toaster';
import SentryBrowserWrapper from '~/components/SentryProvider';
import { InProgressCallBanner } from '~/components/ultaura/InProgressCallBanner';

import Organization from '~/lib/organizations/types/organization';
import UserSession from '~/core/session/types/user-session';

import OrganizationContext from '~/lib/contexts/organization';
import CsrfTokenContext from '~/lib/contexts/csrf';
import SidebarContext from '~/lib/contexts/sidebar';
import UserSessionContext from '~/core/session/contexts/user-session';
import { HelpPanelProvider, useHelpPanel } from '~/lib/contexts/HelpPanelContext';
import { ManualCallProvider } from '~/lib/contexts/ManualCallContext';
import { AddReminderProvider } from '~/lib/contexts/AddReminderContext';
import { AddScheduleProvider } from '~/lib/contexts/AddScheduleContext';
import { AddLineProvider } from '~/lib/contexts/AddLineContext';
import { SearchProvider } from '~/lib/contexts/SearchContext';
import SearchBottomSheet from '~/components/SearchCommandPalette';
import I18nProvider from '~/i18n/I18nProvider';
import type { DocsIndexItem } from '~/lib/search/types';

import { setCookie } from '~/core/generic/cookies';
import AuthChangeListener from '~/components/AuthChangeListener';
import type loadAppData from '~/lib/server/loaders/load-app-data';
import { Page } from '~/core/ui/Page';
import { cva } from 'cva';

const OrganizationScopeLayout: React.FCC<{
  data: Awaited<ReturnType<typeof loadAppData>>;
  ultauraAccountId?: string | null;
  docsIndex: DocsIndexItem[];
}> = ({ data, ultauraAccountId, docsIndex, children }) => {
  const userSessionContext: UserSession = useMemo(() => {
    return {
      auth: data.auth,
      data: data.user ?? undefined,
      role: data.role,
    };
  }, [data]);

  const [organization, setOrganization] = useState<Maybe<Organization>>(
    data.organization,
  );

  const [userSession, setUserSession] =
    useState<Maybe<UserSession>>(userSessionContext);

  const updateCurrentOrganization = useCallback(() => {
    setOrganization(data.organization);

    const organizationId = data.organization?.uuid;
    const cookieName = `${userSession?.data?.id}-organizationId`;

    if (organizationId) {
      setCookie(cookieName, organizationId.toString());
    }
  }, [data.organization, userSession]);

  const updateCurrentUser = useCallback(() => {
    if (userSessionContext.auth) {
      setUserSession(userSessionContext);
    }
  }, [userSessionContext]);

  useEffect(updateCurrentOrganization, [updateCurrentOrganization]);
  useEffect(updateCurrentUser, [updateCurrentUser]);

  return (
    <SentryBrowserWrapper>
      <UserSessionContext.Provider value={{ userSession, setUserSession }}>
        <OrganizationContext.Provider value={{ organization, setOrganization }}>
          <CsrfTokenContext.Provider value={data.csrfToken}>
            <I18nProvider lang={data.language}>
              <AuthChangeListener
                whenSignedOut={'/'}
              >
                <HelpPanelProvider>
                  <ManualCallProvider>
                    <AddReminderProvider>
                      <AddScheduleProvider>
                        <AddLineProvider>
                          <SearchProvider docsIndex={docsIndex}>
                            <Toaster richColors={false} />
                            <main>
                              <RouteShellWithSidebar
                                collapsed={data.ui.sidebarState === 'collapsed'}
                                ultauraAccountId={ultauraAccountId}
                              >
                                {children}
                              </RouteShellWithSidebar>
                            </main>
                            <SearchBottomSheet />
                          </SearchProvider>
                        </AddLineProvider>
                      </AddScheduleProvider>
                    </AddReminderProvider>
                  </ManualCallProvider>
                </HelpPanelProvider>
              </AuthChangeListener>
            </I18nProvider>
          </CsrfTokenContext.Provider>
        </OrganizationContext.Provider>
      </UserSessionContext.Provider>
    </SentryBrowserWrapper>
  );
};

export default OrganizationScopeLayout;

function RouteShellWithSidebar(
  props: React.PropsWithChildren<{
    collapsed: boolean;
    ultauraAccountId?: string | null;
  }>,
) {
  const [collapsed, setCollapsed] = useCollapsible(props.collapsed);
  const { isOpen: isHelpOpen, open: openHelp, close: closeHelp } = useHelpPanel();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const toggleHelp = () => {
    if (isHelpOpen) {
      closeHelp();
    } else {
      openHelp();
    }
  };
  const className = getClassNameBuilder()({ collapsed, helpOpen: isHelpOpen });

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      <Page
        contentContainerClassName={className}
        sidebar={<AppSidebar />}
      >
        <MobileDashboardHeader onMenuOpen={() => setMobileMenuOpen(true)} />
        <TopNavBar onHelpToggle={toggleHelp} />
        {props.ultauraAccountId ? (
          <InProgressCallBanner accountId={props.ultauraAccountId} />
        ) : null}
        {props.children}
      </Page>

      <MobileAppNavigation
        isOpen={mobileMenuOpen}
        onOpenChange={setMobileMenuOpen}
      />
      <HelpPanel isOpen={isHelpOpen} onClose={closeHelp} />
    </SidebarContext.Provider>
  );
}

function getClassNameBuilder() {
  return cva(
    ['flex min-w-0 flex-col h-screen overflow-y-auto ml-0 mr-0 overflow-x-clip transition-[margin] duration-300 ease-in-out motion-reduce:transition-none'],
    {
      variants: {
        collapsed: {
          true: 'lg:ml-[5rem]',
          false: 'lg:ml-[15.3rem]',
        },
        helpOpen: {
          true: 'lg:mr-[350px]',
          false: 'lg:mr-0',
        },
      },
    },
  );
}
