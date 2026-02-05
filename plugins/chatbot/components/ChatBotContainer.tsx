import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import classNames from 'clsx';
import { useChat } from 'ai/react';
import type { ChatRequestOptions, Message } from 'ai';
import Link from 'next/link';

import { Turnstile, TurnstileInstance } from '@marsidev/react-turnstile';

import {
  XMarkIcon,
  ArrowPathIcon,
  PaperAirplaneIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

import { Tooltip, TooltipContent, TooltipTrigger } from '~/core/ui/Tooltip';
import If from '~/core/ui/If';
import Textarea from '~/core/ui/Textarea';

import { ChatBotMessageRole } from '../lib/types';
import chatbotMessagesStore from '../lib/chatbot-messages-store';

import ChatBotBubble from './ChatBotBubble';
import { ChatBotContext } from './ChatbotContext';
import ChatMessageMarkdownRenderer from './ChatMessageMarkdownRenderer';

import configuration from '~/configuration';

function ChatBotContainer(
  props: React.PropsWithChildren<{
    defaultPrompts?: string[];
  }>,
) {
  const { state, onOpenChange, onLoadingChange } = useContext(ChatBotContext);
  const scrollingDiv = useRef<HTMLDivElement>();
  const scrollToBottom = useScrollToBottom(scrollingDiv);
  const [error, setError] = useState<string | undefined>(undefined);

  const {
    messages,
    input,
    handleSubmit,
    handleInputChange,
    append,
    setMessages,
    isLoading,
  } = useChat({
    initialMessages: chatbotMessagesStore.loadMessages(),
    onError: () => {
      setError('Sorry, we could not process your request. Please try again.');
      onLoadingChange(false);
    },
    onResponse: () => {
      onLoadingChange(false);
    },
  });

  useEffect(() => {
    scrollToBottom({ smooth: true });
    setError(undefined);
    chatbotMessagesStore.saveMessages(messages);
  }, [messages, scrollToBottom]);

  if (!state.isOpen) {
    return <ChatBotBubble onOpenChange={onOpenChange} />;
  }

  return (
    <div
      className={
        'animate-in fade-in z-50 slide-in-from-bottom-16 duration-200' +
        ' bg-sidebar mobile-form-sheet' +
        ' fixed md:right-8 md:rounded-xl ease-out slide-out-to-bottom-8' +
        ' bottom-0 md:bottom-8 w-full h-[60vh] md:w-[40vw] xl:w-[26vw]' +
        ' shadow-xl zoom-in-95 border border-border'
      }
    >
      <div className={'flex flex-col h-full'}>
        <ChatBotHeader
          onClose={() => onOpenChange(false)}
          onRefresh={() => {
            chatbotMessagesStore.saveMessages([]);
            setMessages(chatbotMessagesStore.loadMessages());
          }}
        />

        <div
          ref={(div) => { scrollingDiv.current = div ?? undefined; }}
          className={'overflow-y-auto flex flex-col flex-1 bg-card overscroll-contain'}
          style={{
            backgroundImage:
              'linear-gradient(180deg, rgba(10, 186, 181, 0.18) 0%, rgba(10, 186, 181, 0) 85%)',
          }}
        >
          <ChatBotMessages
            isLoading={state.isLoading}
            messages={messages}
            defaultPrompts={props.defaultPrompts}
            onPromptClick={(content) => {
              onLoadingChange(true);

              return append({
                role: ChatBotMessageRole.User,
                content,
              });
            }}
          />
        </div>

        <If condition={error}>
          <div className={'p-4'}>
            <span className={'text-xs text-red-500'}>{error}</span>
          </div>
        </If>

        <ChatBotInput
          isLoading={isLoading || state.isLoading}
          input={input}
          handleSubmit={handleSubmit}
          handleInputChange={handleInputChange}
        />
      </div>
    </div>
  );
}

export default ChatBotContainer;

function ChatBotHeader(
  props: React.PropsWithChildren<{
    onClose: () => void;
    onRefresh: () => void;
  }>,
) {
  return (
    <div
      className={
        'px-4 py-3 flex border-b md:rounded-t-xl justify-between' +
        ' items-center border-border bg-sidebar'
      }
    >
      <div className={'flex items-center gap-2'}>
        <SparklesIcon className={'h-5 w-5 text-primary'} />
        <span className={'font-semibold text-foreground'}>Assistant</span>
      </div>

      <div className={'flex space-x-4 items-center'}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={props.onRefresh}>
              <ArrowPathIcon
                className={'h-4 text-foreground dark:hover:text-white'}
              />
            </button>
          </TooltipTrigger>

          <TooltipContent>Reset conversation</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={props.onClose}
              className="rounded-full bg-transparent h-8 w-8 flex items-center justify-center ring-ring transition-all outline-none focus:ring-2 hover:bg-primary/10 hover:border-primary/30 dark:hover:bg-primary/20 dark:hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-50 active:bg-primary/20 dark:active:bg-primary/30"
            >
              <XMarkIcon className={'h-5 w-5 text-foreground'} />
            </button>
          </TooltipTrigger>

          <TooltipContent>Close</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function ChatBotMessages(
  props: React.PropsWithChildren<{
    isLoading: boolean;
    defaultPrompts?: string[];
    messages: Message[];
    onPromptClick: (prompt: string) => void;
  }>,
) {
  const shouldDisplayHelpButtons = useShouldDisplayHelpButtons(props.messages);
  const shouldDisplayDefaultPrompts = props.messages.length < 2;

  return (
    <div className={'flex-1 relative p-4 flex-col space-y-4'}>
      {props.messages.map((message, index) => {
        return <ChatBotMessage key={index} message={message} />;
      })}

      <If condition={props.isLoading}>
        <BubbleAnimation />
      </If>

      <If condition={shouldDisplayHelpButtons}>
        <div className={'py-1'}>
          <HelpButtonsContainer />
        </div>
      </If>

      <If condition={shouldDisplayDefaultPrompts}>
        <div className={'py-4'}>
          <DefaultPromptsContainer
            onPromptClick={props.onPromptClick}
            defaultPrompts={props.defaultPrompts}
          />
        </div>
      </If>
    </div>
  );
}

function ChatBotMessage({ message }: { message: Message }) {
  const isBot = message.role === ChatBotMessageRole.Assistant;
  const isUser = message.role === ChatBotMessageRole.User;

  return (
    <div
      className={classNames(`flex`, {
        'justify-end': isUser,
        'justify-start': isBot,
      })}
    >
      <div className={'flex flex-col space-y-1 max-w-[85%]'}>
        <span
          className={classNames('text-xs font-medium text-foreground', {
            'text-right': isUser,
          })}
        >
          {isBot ? 'Ultaura' : 'You'}
        </span>

        <div
          className={classNames('px-3 py-2 rounded-lg text-sm', {
            'bg-primary/10 text-foreground': isBot,
            'bg-primary text-primary-foreground': isUser,
          })}
        >
          <ChatMessageMarkdownRenderer className="prose prose-sm dark:prose-invert break-words max-w-none">
            {message.content}
          </ChatMessageMarkdownRenderer>
        </div>
      </div>
    </div>
  );
}

function ChatBotInput({
  isLoading,
  input,
  handleSubmit,
  handleInputChange,
}: React.PropsWithChildren<{
  input: string;
  isLoading: boolean;
  handleSubmit: (
    e: React.FormEvent<HTMLFormElement>,
    chatRequestOptions?: ChatRequestOptions,
  ) => void;
  handleInputChange: React.ChangeEventHandler<HTMLTextAreaElement>;
}>) {
  const { onLoadingChange } = useContext(ChatBotContext);
  const siteKey = process.env.NEXT_PUBLIC_CHATBOT_SITE_KEY;
  const ref = useRef<TurnstileInstance>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resetTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (input.trim()) {
          const form = e.currentTarget.form;
          if (form) {
            form.requestSubmit();
          }
        }
      }
    },
    [input],
  );

  const onSubmit: React.FormEventHandler<HTMLFormElement> = useCallback(
    (e) => {
      e.preventDefault();

      onLoadingChange(true);

      if (!siteKey) {
        const token = ref.current?.getResponse();

        return handleSubmit(e, {
          options: {
            headers: token
              ? {
                  'x-captcha-token': token,
                }
              : {},
          },
        });
      }

      handleSubmit(e);
      resetTextareaHeight();
    },
    [handleSubmit, resetTextareaHeight, siteKey],
  );

  return (
    <form onSubmit={onSubmit}>
      <div className={'p-4 bg-card pb-[calc(env(safe-area-inset-bottom)+1rem)]'}>
        <If condition={siteKey}>
          <Turnstile ref={ref} siteKey={siteKey as string} />
        </If>

        <div
          className={
            'relative flex items-end bg-card rounded-xl border border-input shadow-sm' +
            ' transition-colors focus-within:!border-primary'
          }
        >
          <Textarea
            ref={textareaRef}
            disabled={isLoading}
            autoComplete={'off'}
            required
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            autoResize
            name={'message'}
            className={
              'w-full px-4 py-2 pr-12 resize-none bg-transparent rounded-xl leading-6' +
              ' text-foreground placeholder:text-foreground max-h-48 overflow-y-auto border-0 text-base sm:text-sm'
            }
            placeholder="Ask a question..."
            rows={1}
          />

          <button
            disabled={isLoading}
            type={'submit'}
            className={
              'absolute right-3 bottom-1/2 translate-y-1/2 h-8 w-8 rounded-md' +
              ' text-primary hover:bg-primary/10 disabled:opacity-50 transition-colors' +
              ' touch-manipulation flex items-center justify-center'
            }
            aria-label="Send message"
          >
            <PaperAirplaneIcon className={'h-4 w-4'} />
          </button>
        </div>
      </div>
    </form>
  );
}

function HelpButtonsContainer() {
  const supportFallbackUrl = process.env.NEXT_PUBLIC_CHATBOT_FALLBACK_URL;

  if (!supportFallbackUrl) {
    return null;
  }

  return (
    <div className={'flex'}>
      <ClickablePrompt href={supportFallbackUrl}>
        Contact Support
      </ClickablePrompt>
    </div>
  );
}

function DefaultPromptsContainer({
  defaultPrompts,
  onPromptClick,
}: {
  defaultPrompts?: string[];
  onPromptClick: (prompt: string) => void;
}) {
  if (!defaultPrompts) {
    return null;
  }

  return (
    <div className={'grid grid-cols-2 gap-2'}>
      {defaultPrompts.map((text, index) => {
        return (
          <ClickablePrompt
            key={index}
            onClick={() => {
              onPromptClick(text);
            }}
          >
            {text}
          </ClickablePrompt>
        );
      })}
    </div>
  );
}

function ClickablePrompt(
  props: React.PropsWithChildren<
    | {
        onClick: () => void;
      }
    | {
        href: string;
      }
  >,
) {
  const className = `p-1.5 rounded-md text-xs inline-flex border dark:bg-card
      text-left transition-all dark:text-foreground dark:hover:border-muted-foreground dark:border-border
      hover:bg-gray-50 dark:hover:bg-muted`;

  if ('href' in props) {
    return (
      <Link href={props.href} className={className}>
        {props.children}
      </Link>
    );
  }

  return (
    <button className={className} onClick={props.onClick}>
      {props.children}
    </button>
  );
}

function BubbleAnimation() {
  return (
    <div className="flex justify-start">
      <div className="flex flex-col space-y-1">
        <span className="text-xs font-medium text-muted-foreground">
          Ultaura
        </span>
        <div className="bg-primary/10 rounded-lg px-3 py-2">
          <div className="flex space-x-1">
            <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" />
            <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0.1s]" />
            <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0.2s]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function useShouldDisplayHelpButtons(messages: Message[]) {
  const lastMessage = messages[messages.length - 1];

  if (!lastMessage) {
    return false;
  }

  return lastMessage.content.includes(
    `Sorry, I don\'t know how to help with that`,
  );
}

function useScrollToBottom(
  scrollingDiv: React.MutableRefObject<HTMLDivElement | undefined>,
) {
  return useCallback(
    ({ smooth } = { smooth: false }) => {
      setTimeout(() => {
        const div = scrollingDiv.current;

        if (!div) return;

        div.scrollTo({
          behavior: smooth ? 'smooth' : 'auto',
          top: div.scrollHeight,
        });
      }, 50);
    },
    [scrollingDiv],
  );
}
