'use client';

import Link from 'next/link';
import {
  QuestionMarkCircleIcon,
  ChatBubbleLeftIcon,
  LifebuoyIcon,
} from '@heroicons/react/24/outline';

import { Tooltip, TooltipContent, TooltipTrigger } from '~/core/ui/Tooltip';
import IconButton from '~/core/ui/IconButton';
import { FeedbackPopupContainer } from '~/plugins/feedback-popup/FeedbackPopup';
import QuickActionsDropdown from '~/components/QuickActionsDropdown';
import SearchTrigger from '~/components/SearchTrigger';

interface TopNavBarProps {
  onHelpToggle?: () => void;
}

const TopNavBar: React.FC<TopNavBarProps> = ({ onHelpToggle }) => {
  return (
    <div className="hidden lg:flex items-center justify-between gap-4 px-container py-2 bg-background sticky top-0 z-10">
      <SearchTrigger />

      <div className="flex items-center gap-2">
        <QuickActionsDropdown />

        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/docs">
              <IconButton label="Documentation">
                <QuestionMarkCircleIcon className="h-5 w-5" />
              </IconButton>
            </Link>
          </TooltipTrigger>
          <TooltipContent>Documentation</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <IconButton label="Help" onClick={onHelpToggle}>
              <LifebuoyIcon className="h-5 w-5" />
            </IconButton>
          </TooltipTrigger>
          <TooltipContent>Help</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <FeedbackPopupContainer>
                <IconButton label="Send Feedback">
                  <ChatBubbleLeftIcon className="h-5 w-5" />
                </IconButton>
              </FeedbackPopupContainer>
            </div>
          </TooltipTrigger>
          <TooltipContent>Feedback</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

export default TopNavBar;
