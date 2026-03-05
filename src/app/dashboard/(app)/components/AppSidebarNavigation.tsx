'use client';

import Trans from '~/core/ui/Trans';
import { SidebarItem, SidebarDivider, SidebarGroup } from '~/core/ui/Sidebar';

import createNavigationConfig from '~/navigation.config';
import useUltauraAccount from '~/lib/ultaura/hooks/use-ultaura-account';
import useUserSession from '~/core/hooks/use-user-session';

function AppSidebarNavigation() {
  const { data: account } = useUltauraAccount();
  const userSession = useUserSession();
  const userType =
    account?.user_type === 'self' || account?.user_type === 'family_managed'
      ? account.user_type
      : undefined;
  const navigation = createNavigationConfig(
    account
      ? {
          userType,
          accountId: account.id,
          role: userSession?.role == null ? undefined : Number(userSession.role),
        }
      : undefined
  );

  return (
    <>
      {navigation.items.map((item, index) => {
        if ('divider' in item) {
          return <SidebarDivider key={index} />;
        }

        if ('children' in item) {
          return (
            <SidebarGroup
              key={item.label}
              label={<Trans i18nKey={item.label} defaults={item.label} />}
              collapsible={item.collapsible}
              collapsed={item.collapsed}
            >
              {item.children.map((child) => {
                return (
                  <SidebarItem
                    key={child.path}
                    end={child.end}
                    path={child.path}
                    Icon={child.Icon}
                    activeMatch={child.activeMatch}
                  >
                    <Trans i18nKey={child.label} defaults={child.label} />
                  </SidebarItem>
                );
              })}
            </SidebarGroup>
          );
        }

        return (
          <SidebarItem
            key={item.path}
            end={item.end}
            path={item.path}
            Icon={item.Icon}
            activeMatch={item.activeMatch}
          >
            <Trans i18nKey={item.label} defaults={item.label} />
          </SidebarItem>
        );
      })}
    </>
  );
}

export default AppSidebarNavigation;
