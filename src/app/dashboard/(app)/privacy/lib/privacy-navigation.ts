import {
  Archive,
  ClipboardList,
  Download,
  Mic,
  Share2,
  ShieldCheck,
  Users,
} from 'lucide-react';

import type {
  PrivacySectionConfig,
  PrivacySectionValue,
  PrivacyTabValue,
} from '../types';

export const PRIVACY_TABS: Array<{ value: PrivacyTabValue; label: string }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'consent', label: 'Consent & Recording' },
  { value: 'data', label: 'Data Management' },
  { value: 'family', label: 'Family Sharing' },
];

const PRIVACY_TAB_VALUES: PrivacyTabValue[] = [
  'overview',
  'consent',
  'data',
  'family',
];

const PRIVACY_SECTION_VALUES: PrivacySectionValue[] = [
  'summary',
  'consent-status',
  'privacy-controls',
  'retention',
  'export',
  'audit',
  'recipients',
  'sharing',
];

export const PRIVACY_SECTIONS: Record<
  PrivacyTabValue,
  PrivacySectionConfig[]
> = {
  overview: [],
  consent: [
    { value: 'consent-status', label: 'Consent Status', icon: Mic },
    { value: 'privacy-controls', label: 'Privacy Controls', icon: ShieldCheck },
  ],
  data: [
    { value: 'retention', label: 'Data Retention', icon: Archive },
    { value: 'export', label: 'Export Data', icon: Download },
    { value: 'audit', label: 'Audit Log', icon: ClipboardList },
  ],
  family: [
    { value: 'recipients', label: 'Family Recipients', icon: Users },
    { value: 'sharing', label: 'Sharing Preferences', icon: Share2 },
  ],
};

export function buildPrivacyUrl(
  tab: PrivacyTabValue,
  section?: PrivacySectionValue,
) {
  const params = new URLSearchParams();
  params.set('tab', tab);
  if (section) {
    params.set('section', section);
  }
  return `/dashboard/privacy?${params.toString()}`;
}

export function parsePrivacyTab(value: string | null): PrivacyTabValue | null {
  if (!value) return null;
  return PRIVACY_TAB_VALUES.includes(value as PrivacyTabValue)
    ? (value as PrivacyTabValue)
    : null;
}

export function parsePrivacySection(
  value: string | null,
): PrivacySectionValue | null {
  if (!value) return null;
  return PRIVACY_SECTION_VALUES.includes(value as PrivacySectionValue)
    ? (value as PrivacySectionValue)
    : null;
}
