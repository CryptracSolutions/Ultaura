'use client';

import type { ReactNode } from 'react';
import { CollapsibleInfoTip } from '~/core/ui/CollapsibleInfoTip';

interface PageTitleWithInfoProps {
  title: string;
  storageKey: string;
  infoLabel: string;
  children: ReactNode;
}

export function PageTitleWithInfo({
  title,
  storageKey,
  infoLabel,
  children,
}: PageTitleWithInfoProps) {
  return (
    <span className="inline-flex items-center gap-2">
      {title}
      <CollapsibleInfoTip storageKey={storageKey} collapsedLabel={infoLabel}>
        {children}
      </CollapsibleInfoTip>
    </span>
  );
}
