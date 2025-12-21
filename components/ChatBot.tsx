'use client';

import ChatBotContainer from './ChatBotContainer';
import ChatBoxContextProvider from '~/plugins/chatbot/components/ChatbotContext';

function ChatBot(props: { defaultPrompts?: string[] }) {
  return (
    <ChatBoxContextProvider>
      <ChatBotContainer defaultPrompts={props.defaultPrompts} />
    </ChatBoxContextProvider>
  );
}

export default ChatBot;
