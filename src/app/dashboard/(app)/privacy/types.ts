import type { LucideIcon } from 'lucide-react';

export type PrivacyTabValue = 'overview' | 'consent' | 'data' | 'family';

export type PrivacySectionValue =
  | 'summary'
  | 'consent-status'
  | 'privacy-controls'
  | 'retention'
  | 'export'
  | 'audit'
  | 'recipients'
  | 'sharing';

export type PrivacySectionConfig = {
  value: PrivacySectionValue;
  label: string;
  icon: LucideIcon;
};
