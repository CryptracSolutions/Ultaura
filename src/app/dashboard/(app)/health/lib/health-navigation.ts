import type { HealthTabValue } from '@ultaura/types';

export const HEALTH_LINE_STORAGE_KEY_PREFIX = 'health_selected_line_';

export const HEALTH_TABS: Array<{ value: HealthTabValue; label: string }> = [
  { value: 'suggestions', label: 'Suggestions' },
  { value: 'conditions', label: 'Conditions' },
  { value: 'medications', label: 'Medications' },
  { value: 'documents', label: 'Documents' },
  { value: 'observations', label: 'Observations' },
];

const HEALTH_TAB_VALUES: HealthTabValue[] = HEALTH_TABS.map((t) => t.value);

export const DEFAULT_HEALTH_TAB: HealthTabValue = 'suggestions';

/**
 * Builds a URL to the Health Profile page with optional tab and line parameters.
 */
export function buildHealthUrl(tab?: HealthTabValue, lineId?: string): string {
  const params = new URLSearchParams();

  if (tab) {
    params.set('tab', tab);
  }

  if (lineId) {
    params.set('line', lineId);
  }

  const query = params.toString();
  return query ? `/dashboard/health?${query}` : '/dashboard/health';
}

/**
 * Parses and validates a tab value from URL search params.
 * Returns the default tab when the value is missing or invalid.
 */
export function parseHealthTab(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
): HealthTabValue {
  let value: string | null = null;

  if (searchParams instanceof URLSearchParams) {
    value = searchParams.get('tab');
  } else {
    const raw = searchParams['tab'];
    value = Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
  }

  if (!value) return DEFAULT_HEALTH_TAB;

  return HEALTH_TAB_VALUES.includes(value as HealthTabValue)
    ? (value as HealthTabValue)
    : DEFAULT_HEALTH_TAB;
}

/**
 * Parses a line short_id from URL search params.
 * Returns null when the parameter is absent.
 */
export function parseHealthLine(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
): string | null {
  let value: string | null = null;

  if (searchParams instanceof URLSearchParams) {
    value = searchParams.get('line');
  } else {
    const raw = searchParams['line'];
    value = Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
  }

  return value ?? null;
}
