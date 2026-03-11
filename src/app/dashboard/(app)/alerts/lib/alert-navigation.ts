import type { AlertSectionConfig, AlertSectionValue } from '../types';

export const ALERT_SECTIONS: AlertSectionConfig[] = [
  { value: 'lines', label: 'Line Notifications' },
  { value: 'owner', label: 'Alert Settings' },
];

const ALERT_SECTION_VALUES: AlertSectionValue[] = ['owner', 'lines'];

export function buildAlertUrl(section?: AlertSectionValue): string {
  const params = new URLSearchParams();
  params.set('tab', 'alert-settings');
  if (section) {
    params.set('section', section);
  }
  return `/dashboard/alerts?${params.toString()}`;
}

export function parseAlertSection(value: string | null): AlertSectionValue | null {
  if (!value) return null;
  return ALERT_SECTION_VALUES.includes(value as AlertSectionValue)
    ? (value as AlertSectionValue)
    : null;
}
