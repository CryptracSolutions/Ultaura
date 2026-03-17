'use client';

import type { ReactNode } from 'react';
import { CollapsibleInfoTip } from '~/core/ui/CollapsibleInfoTip';

export interface PrivacyInfoBannerProps {
  children: ReactNode;
  storageKey: string;
}

export function PrivacyInfoBanner({ children, storageKey }: PrivacyInfoBannerProps) {
  return (
    <CollapsibleInfoTip storageKey={storageKey} collapsedLabel="Privacy info">
      {children}
    </CollapsibleInfoTip>
  );
}
