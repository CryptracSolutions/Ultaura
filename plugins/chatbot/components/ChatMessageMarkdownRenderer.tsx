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
        p: ({ node, ...props }) => <p className={'my-1'} {...props} />,
        ul: ({ node, ...props }) => (
          <ul className={'list-disc list-inside pl-2 my-1'} {...props} />
        ),
        ol: ({ node, ...props }) => (
          <ol className={'list-decimal list-inside pl-2 my-1'} {...props} />
        ),
      }}
    >
      {props.children}
    </MemoizedReactMarkdown>
  );
}
