'use client';

import {
  PlusIcon,
  PhoneIcon,
  BellIcon,
  PhoneArrowUpRightIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import useUltauraAccount from '~/lib/ultaura/hooks/use-ultaura-account';
import { useManualCall } from '~/lib/contexts/ManualCallContext';
import { useAddReminder } from '~/lib/contexts/AddReminderContext';
import { useAddSchedule } from '~/lib/contexts/AddScheduleContext';
import { useAddLine } from '~/lib/contexts/AddLineContext';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '~/core/ui/Dropdown';

import { Tooltip, TooltipContent, TooltipTrigger } from '~/core/ui/Tooltip';
import Button from '~/core/ui/Button';

const QuickActionsDropdown: React.FC = () => {
  const { data: account } = useUltauraAccount();
  const { openManualCall } = useManualCall();
  const { openAddReminder } = useAddReminder();
  const { openAddSchedule } = useAddSchedule();
  const { openAddLine } = useAddLine();
  const isFamilyManaged = account?.user_type === 'family_managed';

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Quick Actions">
              <PlusIcon className="h-5 w-5 text-primary" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Quick Actions</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" sideOffset={8} className="min-w-[12rem]">
        <DropdownMenuItem
          className="flex w-full items-center space-x-2"
          onClick={() => openAddReminder()}
        >
          <BellIcon className="h-5" />
          <span>Set Reminder</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="flex w-full items-center space-x-2"
          onClick={() => openAddSchedule()}
        >
          <CalendarIcon className="h-5" />
          <span>Schedule Call</span>
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

        <DropdownMenuItem
          className="flex w-full items-center space-x-2"
          onClick={() => openAddLine()}
        >
          <PhoneIcon className="h-5" />
          <span>Add Line</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default QuickActionsDropdown;
