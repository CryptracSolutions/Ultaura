'use client';

import {
  ChatBubbleLeftIcon,
  LifebuoyIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';

import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/core/ui/Tooltip';
import Button from '~/core/ui/Button';
import { FeedbackPopupContainer } from '~/plugins/feedback-popup/FeedbackPopup';
import QuickActionsDropdown from '~/components/QuickActionsDropdown';
import SearchTrigger from '~/components/SearchTrigger';

interface TopNavBarProps {
  onHelpToggle?: () => void;
}

const TopNavBar: React.FC<TopNavBarProps> = ({ onHelpToggle }) => {
  return (
    <div className="hidden lg:flex items-center justify-between gap-4 px-container py-2 bg-background sticky top-0 z-10 border-l border-border">
      <SearchTrigger />

      <div className="flex items-center gap-2">
        <QuickActionsDropdown />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onHelpToggle} aria-label="Help" className="rounded-full hover:bg-primary/10">
              <QuestionMarkCircleIcon className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Help</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/docs">
              <Button variant="ghost" size="icon" aria-label="Documentation" className="rounded-full hover:bg-primary/10">
                <LifebuoyIcon className="h-5 w-5" />
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent>Documentation</TooltipContent>
        </Tooltip>

        <FeedbackPopupContainer tooltipContent="Feedback">
          <Button variant="ghost" size="icon" aria-label="Send Feedback" className="rounded-full hover:bg-primary/10">
            <ChatBubbleLeftIcon className="h-5 w-5" />
          </Button>
        </FeedbackPopupContainer>
      </div>
    </div>
  );
};

export default TopNavBar;
