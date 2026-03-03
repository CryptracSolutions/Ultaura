'use client';

import type { ReactNode } from 'react';
import { Info } from 'lucide-react';

export interface PrivacyInfoBannerProps {
  children: ReactNode;
}

export function PrivacyInfoBanner({ children }: PrivacyInfoBannerProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3.5">
      <Info className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 text-primary" />
      <p className="text-xs text-primary leading-snug">{children}</p>
    </div>
  );
}
