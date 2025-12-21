import { memo } from 'react';
import ReactMarkdown from 'react-markdown';

const MemoizedReactMarkdown = memo(
  ReactMarkdown,
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.className === nextProps.className,
);

export default function ChatMessageMarkdownRenderer(
  props: React.PropsWithChildren<{ className: string; children: string }>,
) {
  return (
    <MemoizedReactMarkdown
      className={props.className}
      components={{
        ul: ({ node, ...props }) => {
          return (
            <ul className={'list-disc list-inside pl-2 my-1'} {...props} />
          );
        },
        ol: ({ node, ...props }) => {
          return (
            <ol className={'list-decimal list-inside pl-2 my-1'} {...props} />
          );
        },
        p: ({ node, ...props }) => {
          return <p className={'my-1'} {...props} />;
        },
        pre: ({ node, ...props }) => {
          return (
            <pre
              className={
                'p-4 bg-gray-200 dark:bg-dark-700 break-words' +
                ' rounded-lg my-4 whitespace-break-spaces text-sm'
              }
              {...props}
            />
          );
        },
      }}
    >
      {props.children}
    </MemoizedReactMarkdown>
  );
}
