'use client';

import {
  BugAntIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  CreditCardIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  MegaphoneIcon,
  UserGroupIcon,
  UserIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import Sidebar, {
  SidebarContent,
  SidebarDivider,
  SidebarGroup,
  SidebarItem,
} from '~/core/ui/Sidebar';
import Logo from '~/core/ui/Logo';

const NEWSLETTER_PATH = '/admin/newsletter';
const BROADCASTS_PATH = '/admin/newsletter/broadcasts';

function isNewsletterSubscribersRoute(currentPath: string) {
  return (
    currentPath === NEWSLETTER_PATH ||
    currentPath === `${NEWSLETTER_PATH}/`
  );
}

function isNewsletterBroadcastsRoute(currentPath: string) {
  return (
    currentPath === BROADCASTS_PATH ||
    currentPath.startsWith(`${BROADCASTS_PATH}/`)
  );
}

function AdminSidebar() {
  return (
    <Sidebar>
      <SidebarContent className={'mt-4 mb-8 pt-2'}>
        <Logo href={'/'} />
      </SidebarContent>

      <SidebarContent>
        <SidebarGroup label={'Platform'} collapsible={false}>
          <SidebarItem
            end
            path={'/admin'}
            Icon={() => <HomeIcon className={'h-6'} />}
          >
            Admin
          </SidebarItem>

          <SidebarItem
            path={'/admin/search'}
            Icon={() => <MagnifyingGlassIcon className={'h-6'} />}
          >
            Search
          </SidebarItem>

          <SidebarItem
            path={'/admin/users'}
            Icon={() => <UserIcon className={'h-6'} />}
          >
            Users
          </SidebarItem>

          <SidebarItem
            path={'/admin/organizations'}
            Icon={() => <UserGroupIcon className={'h-6'} />}
          >
            Organizations
          </SidebarItem>

          <SidebarItem
            path={'/admin/billing'}
            Icon={() => <CreditCardIcon className={'h-6'} />}
          >
            Billing
          </SidebarItem>

          <SidebarItem
            path={'/admin/timeline'}
            Icon={() => <ClockIcon className={'h-6'} />}
          >
            Timeline
          </SidebarItem>

          <SidebarItem
            path={'/admin/feedback'}
            Icon={() => <ChatBubbleLeftRightIcon className={'h-6'} />}
          >
            Feedback
          </SidebarItem>
        </SidebarGroup>

        <SidebarDivider />

        <SidebarGroup label={'Ultaura'} collapsible={false}>
          <SidebarItem
            path={NEWSLETTER_PATH}
            activeMatch={isNewsletterSubscribersRoute}
            Icon={() => <UsersIcon className={'h-6'} />}
          >
            Subscribers
          </SidebarItem>

          <SidebarItem
            path={BROADCASTS_PATH}
            activeMatch={isNewsletterBroadcastsRoute}
            Icon={() => <MegaphoneIcon className={'h-6'} />}
          >
            Broadcasts
          </SidebarItem>

          <SidebarItem
            path={'/admin/debug-logs'}
            Icon={() => <BugAntIcon className={'h-6'} />}
          >
            Debug Logs
          </SidebarItem>
        </SidebarGroup>

        <SidebarDivider />

        <SidebarGroup label={'System'} collapsible={false}>
          <SidebarItem
            path={'/admin/diagnostics'}
            Icon={() => <WrenchScrewdriverIcon className={'h-6'} />}
          >
            Diagnostics
          </SidebarItem>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export default AdminSidebar;
