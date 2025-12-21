import { ChatBubbleBottomCenterIcon } from '@heroicons/react/24/outline';

function ChatBotBubble(
  props: React.PropsWithChildren<{
    onOpenChange: (isOpen: boolean) => void;
  }>,
) {
  return (
    <button
      className={
        'bg-primary-500 animate-out text-white h-16 w-16 rounded-full' +
        ' flex items-center justify-center fixed right-8 bottom-8' +
        ' hover:shadow-xl hover:bg-primary-600 transition-all' +
        ' hover:-translate-y-1 duration-500 hover:scale-105 z-50'
      }
      onClick={() => props.onOpenChange(true)}
    >
      <ChatBubbleBottomCenterIcon className="h-8 w-8" />
    </button>
  );
}

export default ChatBotBubble;
