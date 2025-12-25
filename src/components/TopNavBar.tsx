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

interface TopNavBarProps {
  onHelpClick?: () => void;
}

const TopNavBar: React.FC<TopNavBarProps> = ({ onHelpClick }) => {
  return (
    <div className="hidden lg:flex items-center justify-end gap-2 px-container py-2 bg-background sticky top-0 z-10">
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
          <IconButton label="Help" onClick={onHelpClick}>
            <LifebuoyIcon className="h-5 w-5" />
          </IconButton>
        </TooltipTrigger>
        <TooltipContent>Help</TooltipContent>
      </Tooltip>

      <FeedbackPopupContainer>
        <IconButton label="Send Feedback">
          <ChatBubbleLeftIcon className="h-5 w-5" />
        </IconButton>
      </FeedbackPopupContainer>
    </div>
  );
};

export default TopNavBar;
