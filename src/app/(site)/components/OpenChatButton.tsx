'use client';

export function OpenChatCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent('ultaura:open-chat'))}
      className={className}
    >
      {children}
    </button>
  );
}
