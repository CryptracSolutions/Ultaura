'use client';

import { useCallback, useEffect, useRef, memo } from 'react';
import { useChat } from 'ai/react';
import type { Message } from 'ai';
import classNames from 'clsx';
import ReactMarkdown from 'react-markdown';

import {
  XMarkIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';

import Link from 'next/link';
import If from '~/core/ui/If';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/core/ui/Tooltip';
import configuration from '~/configuration';

interface HelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const INITIAL_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: `Hi! What can I help you with today? You can ask me anything.`,
};

export function HelpPanel({ isOpen, onClose }: HelpPanelProps) {
  const scrollingDiv = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    [input]
  );

  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      handleSubmit(e);
      resetTextareaHeight();
    },
    [handleSubmit, resetTextareaHeight]
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
        <div className="px-4 py-3 flex justify-between items-center border-b border-border bg-sidebar">
          <div className="flex items-center gap-2">
            <SparklesIcon className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">Assistant</span>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/docs">
                  <button className="p-2 rounded-lg text-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                    <QuestionMarkCircleIcon className="h-5 w-5" />
                  </button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>Documentation</TooltipContent>
            </Tooltip>

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollingDiv}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-card"
          style={{
            backgroundImage:
              'linear-gradient(180deg, rgba(10, 186, 181, 0.18) 0%, rgba(10, 186, 181, 0) 85%)',
          }}
        >
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          <If condition={isLoading}>
            <BubbleAnimation />
          </If>
        </div>

        {/* Input Card */}
        <div className="p-4 bg-card">
          <form onSubmit={onSubmit}>
            <div
              className="relative flex items-center bg-card rounded-xl border-[1.4px] shadow-sm shadow-[0_0_0_1px_rgba(10,186,181,0.6)]"
              style={{ borderColor: '#0ABAB5' }}
            >
              <textarea
                ref={textareaRef}
                disabled={isLoading}
                autoComplete="off"
                required
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onInput={(e) => {
                  const target = e.currentTarget;
                  target.style.height = 'auto';
                  target.style.height = `${target.scrollHeight}px`;
                }}
                name="message"
                className={classNames(
                  'w-full px-4 py-2 pr-12 outline-none resize-none text-sm bg-transparent rounded-xl leading-6',
                  'text-foreground placeholder:text-foreground',
                  'min-h-[36px] max-h-48 overflow-y-auto'
                )}
                placeholder="Ask a question..."
                rows={1}
              />

              <button
                disabled={isLoading}
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 disabled:opacity-50 transition-colors"
                aria-label="Send message"
              >
                <PaperAirplaneIcon className="h-4 w-4 text-primary" />
              </button>
            </div>
          </form>
        </div>
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
          className={classNames('text-xs font-medium text-foreground', {
            'text-right': isUser,
          })}
        >
          {isBot ? 'Ultaura' : 'You'}
        </span>

        <div
          className={classNames(
            'px-3 py-2 rounded-lg text-sm',
            {
              'bg-primary/10 text-foreground': isBot,
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
        <span className="text-xs font-medium text-muted-foreground">Ultaura</span>
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

export default HelpPanel;
