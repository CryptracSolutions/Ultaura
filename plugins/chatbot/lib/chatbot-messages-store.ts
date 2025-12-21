import { Message } from 'ai';
import configuration from '~/configuration';
import isBrowser from '~/core/generic/is-browser';
import { ChatBotMessageRole } from '~/plugins/chatbot/lib/types';

const LOCAL_STORAGE_KEY = createLocalStorageKey();

const emptyMessages = [
  {
    id: 'initial-message',
    content: `Hi, I'm the ${configuration.site.siteName} chatbot! How can I help you?`,
    role: ChatBotMessageRole.Assistant,
  },
];

const chatBotMessagesStore = {
  loadMessages(): Message[] {
    if (!isBrowser()) {
      return emptyMessages;
    }

    const messages = localStorage.getItem(LOCAL_STORAGE_KEY);

    try {
      if (messages) {
        const parsed = JSON.parse(messages);

        if (!parsed.length) {
          return emptyMessages;
        }

        return parsed;
      }
    } catch (error) {
      return emptyMessages;
    }

    return emptyMessages;
  },
  saveMessages(messages: Message[]) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(messages));
  },
};

export default chatBotMessagesStore;

function createLocalStorageKey() {
  const url = new URL(configuration.site.siteUrl ?? 'http://localhost');
  const domain = url.hostname;

  return `${domain}-chatbot-messages`;
}
