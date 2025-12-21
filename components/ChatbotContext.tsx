import { createContext } from 'react';

import useChatBotState, {
  ChatBotActionTypes,
} from '~/plugins/chatbot/lib/chatbot-state.reducer';

interface ChatBotContextState {
  state: ReturnType<typeof useChatBotState>[0];
  onOpenChange: (isOpen: boolean) => void;
  onLoadingChange: (isLoading: boolean) => void;
}

export const ChatBotContext = createContext<ChatBotContextState>(
  {} as ChatBotContextState,
);

function ChatBotContextProvider(props: React.PropsWithChildren) {
  const [state, dispatch] = useChatBotState();

  const onOpenChange = (isOpen: boolean) =>
    dispatch({ type: ChatBotActionTypes.SET_IS_OPEN, payload: isOpen });

  const onLoadingChange = (isLoading: boolean) =>
    dispatch({ type: ChatBotActionTypes.SET_IS_LOADING, payload: isLoading });

  const defaultContext = {
    state,
    onOpenChange,
    onLoadingChange,
  };

  return (
    <ChatBotContext.Provider value={defaultContext}>
      {props.children}
    </ChatBotContext.Provider>
  );
}

export default ChatBotContextProvider;
