'use client';

import { cn } from '~/core/generic/shadcn-utils';

interface AutomationSectionProps {
  title: string;
  headerAction?: React.ReactNode;
  emptyMessage?: string;
  children?: React.ReactNode;
  className?: string;
}

export function AutomationSection({
  title,
  headerAction,
  emptyMessage,
  children,
  className,
}: AutomationSectionProps) {
  const hasChildren = Array.isArray(children)
    ? children.filter(Boolean).length > 0
    : Boolean(children);

  return (
    <div className={cn('mb-8', className)}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-semibold text-lg">{title}</h2>
        {headerAction}
      </div>

      {hasChildren ? (
        <div className="space-y-3">{children}</div>
      ) : emptyMessage ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : null}
    </div>
  );
}
