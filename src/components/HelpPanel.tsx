'use client';

import { useCallback, useEffect, useRef, memo } from 'react';
import { useChat } from 'ai/react';
import type { Message } from 'ai';
import classNames from 'clsx';
import ReactMarkdown from 'react-markdown';

import {
  XMarkIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';

import If from '~/core/ui/If';
import configuration from '~/configuration';

interface HelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const INITIAL_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: `Hi! I'm here to help you with any questions about ${configuration.site.siteName}. What can I help you with today?`,
};

export function HelpPanel({ isOpen, onClose }: HelpPanelProps) {
  const scrollingDiv = useRef<HTMLDivElement>(null);

  const {
    messages,
    input,
    handleSubmit,
    handleInputChange,
    isLoading,
    setMessages,
  } = useChat({
    initialMessages: [INITIAL_MESSAGE],
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollingDiv.current) {
      scrollingDiv.current.scrollTo({
        behavior: 'smooth',
        top: scrollingDiv.current.scrollHeight,
      });
    }
  }, [messages]);

  // Reset messages when panel closes
  useEffect(() => {
    if (!isOpen) {
      setMessages([INITIAL_MESSAGE]);
    }
  }, [isOpen, setMessages]);

  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      handleSubmit(e);
    },
    [handleSubmit]
  );

  return (
    <div
      className={classNames(
        'fixed top-0 right-0 h-full w-full lg:w-[350px] bg-sidebar border-l border-border shadow-xl z-50',
        'transform transition-transform duration-300 ease-in-out',
        {
          'translate-x-0': isOpen,
          'translate-x-full': !isOpen,
        }
      )}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-4 py-3 flex border-b border-border justify-between items-center">
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">Help</span>
            <span className="text-xs text-sidebar-foreground">
              Ask us anything
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-md transition-colors"
            aria-label="Close help panel"
          >
            <XMarkIcon className="h-5 w-5 text-muted-foreground hover:text-foreground" />
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollingDiv}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          <If condition={isLoading}>
            <BubbleAnimation />
          </If>
        </div>

        {/* Input */}
        <form onSubmit={onSubmit} className="border-t border-border">
          <div className="flex relative">
            <input
              disabled={isLoading}
              autoComplete="off"
              required
              value={input}
              onChange={handleInputChange}
              name="message"
              className={classNames(
                'p-4 h-14 w-full outline-none resize-none text-sm bg-sidebar',
                'text-foreground placeholder:text-sidebar-foreground/60',
                'pr-12 focus:ring-2 focus:ring-primary/20 transition-all'
              )}
              placeholder="Ask a question..."
            />

            <button
              disabled={isLoading}
              type="submit"
              className="absolute right-4 top-4 bg-transparent disabled:opacity-50"
            >
              <PaperAirplaneIcon className="h-5 w-5 text-primary" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ChatMessage({ message }: { message: Message }) {
  const isBot = message.role === 'assistant';
  const isUser = message.role === 'user';

  return (
    <div
      className={classNames('flex', {
        'justify-end': isUser,
        'justify-start': isBot,
      })}
    >
      <div className="flex flex-col space-y-1 max-w-[85%]">
        <span
          className={classNames('text-xs font-medium text-muted-foreground', {
            'text-right': isUser,
          })}
        >
          {isBot ? 'AI' : 'You'}
        </span>

        <div
          className={classNames(
            'px-3 py-2 rounded-lg text-sm',
            {
              'bg-muted text-foreground': isBot,
              'bg-primary text-primary-foreground': isUser,
            }
          )}
        >
          <MemoizedMarkdown className="prose prose-sm dark:prose-invert break-words max-w-none">
            {message.content}
          </MemoizedMarkdown>
        </div>
      </div>
    </div>
  );
}

const MemoizedMarkdown = memo(
  function MarkdownRenderer({
    children,
    className,
  }: {
    children: string;
    className: string;
  }) {
    return (
      <ReactMarkdown
        className={className}
        components={{
          p: ({ children }) => <p className="my-1">{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc list-inside pl-2 my-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside pl-2 my-1">{children}</ol>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    );
  },
  (prev, next) => prev.children === next.children
);

function BubbleAnimation() {
  return (
    <div className="flex justify-start">
      <div className="flex flex-col space-y-1">
        <span className="text-xs font-medium text-muted-foreground">AI</span>
        <div className="bg-muted rounded-lg px-3 py-2">
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

export default HelpPanel;
