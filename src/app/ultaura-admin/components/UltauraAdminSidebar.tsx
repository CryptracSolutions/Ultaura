'use client';

import { BugAntIcon } from '@heroicons/react/24/outline';
import Sidebar, { SidebarContent, SidebarItem } from '~/core/ui/Sidebar';
import Logo from '~/core/ui/Logo';

function UltauraAdminSidebar() {
  return (
    <Sidebar>
      <SidebarContent className={'mt-4 mb-8 pt-2'}>
        <Logo href={'/'} />
      </SidebarContent>

      <SidebarContent>
        <SidebarItem
          path={'/ultaura-admin/debug-logs'}
          Icon={() => <BugAntIcon className={'h-6'} />}
        >
          Debug Logs
        </SidebarItem>
      </SidebarContent>
    </Sidebar>
  );
}

export default UltauraAdminSidebar;
