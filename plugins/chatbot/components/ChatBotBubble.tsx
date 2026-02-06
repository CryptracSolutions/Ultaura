import { ChatBubbleBottomCenterIcon } from '@heroicons/react/24/outline';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/core/ui/Tooltip';

function ChatBotBubble(
  props: React.PropsWithChildren<{
    onOpenChange: (isOpen: boolean) => void;
  }>,
) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={
            'bg-primary text-primary-foreground h-12 w-12 rounded-full' +
            ' flex items-center justify-center fixed floating-safe-bottom-right md:right-8 md:bottom-8' +
            ' hover:shadow-lg transition-all shadow-md' +
            ' hover:-translate-y-1 duration-300 hover:scale-105 z-50'
          }
          onClick={() => props.onOpenChange(true)}
        >
          <ChatBubbleBottomCenterIcon className="h-6 w-6" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="hidden lg:block">Help</TooltipContent>
    </Tooltip>
  );
}

export default ChatBotBubble;
