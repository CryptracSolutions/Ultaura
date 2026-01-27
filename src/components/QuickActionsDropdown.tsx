'use client';

import Link from 'next/link';
import {
  PlusIcon,
  PhoneIcon,
  BellIcon,
  PhoneArrowUpRightIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import useUltauraAccount from '~/lib/ultaura/hooks/use-ultaura-account';
import { useManualCall } from '~/lib/contexts/ManualCallContext';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '~/core/ui/Dropdown';

import { Tooltip, TooltipContent, TooltipTrigger } from '~/core/ui/Tooltip';
import IconButton from '~/core/ui/IconButton';

const QuickActionsDropdown: React.FC = () => {
  const { data: account } = useUltauraAccount();
  const { openManualCall } = useManualCall();
  const isFamilyManaged = account?.user_type === 'family_managed';

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <IconButton label="Quick Actions">
              <PlusIcon className="h-5 w-5" />
            </IconButton>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Quick Actions</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" sideOffset={8} className="min-w-[12rem]">
        <DropdownMenuItem asChild>
          <Link
            href="/dashboard/reminders?action=add"
            className="flex w-full items-center space-x-2"
          >
            <BellIcon className="h-5" />
            <span>Add Reminder</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link
            href="/dashboard/calls?action=add"
            className="flex w-full items-center space-x-2"
          >
            <CalendarIcon className="h-5" />
            <span>Schedule Call</span>
          </Link>
        </DropdownMenuItem>

        {isFamilyManaged && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="flex w-full items-center space-x-2"
              onClick={() => openManualCall()}
            >
              <PhoneArrowUpRightIcon className="h-5" />
              <span>Place Call</span>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link
            href="/dashboard/lines?action=add"
            className="flex w-full items-center space-x-2"
          >
            <PhoneIcon className="h-5" />
            <span>Add Line</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default QuickActionsDropdown;
