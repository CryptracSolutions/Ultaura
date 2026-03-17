'use client';

import { type ReactNode, useState } from 'react';
import { Info, ChevronUp } from 'lucide-react';

interface CollapsibleInfoTipProps {
  /** Unique key for persisting collapsed state in localStorage */
  storageKey: string;
  /** Short label shown when collapsed (e.g. "Health disclaimer") */
  collapsedLabel: string;
  /** The full disclaimer content (can include links, lists, etc.) */
  children: ReactNode;
}

export function CollapsibleInfoTip({
  storageKey,
  collapsedLabel,
  children,
}: CollapsibleInfoTipProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });

  const collapse = () => {
    setCollapsed(true);
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      // continue without localStorage
    }
  };

  const expand = () => {
    setCollapsed(false);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // continue without localStorage
    }
  };

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={expand}
        className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs text-primary transition-colors hover:bg-primary/10"
      >
        <Info className="h-3.5 w-3.5 shrink-0" />
        <span>{collapsedLabel}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={collapse}
      className="flex w-full cursor-default items-start gap-2.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-left transition-colors hover:bg-primary/10"
    >
      <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
      <div className="flex-1 text-xs text-primary leading-snug">{children}</div>
      <ChevronUp className="h-3.5 w-3.5 shrink-0 text-primary/60 mt-0.5" />
    </button>
  );
}
