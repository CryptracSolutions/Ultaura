const DEFAULT_LOCALE = 'en-US';
const DEFAULT_CURRENCY = 'USD';

export function formatCurrency(
  cents: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE,
): string {
  if (!Number.isFinite(cents)) return '$0.00';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatPercent(
  value: number,
  locale: string = DEFAULT_LOCALE,
  maximumFractionDigits: number = 1,
): string {
  if (!Number.isFinite(value)) return '0%';

  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits,
  }).format(value);
}

export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0s';

  const seconds = Math.round(totalSeconds);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) return `${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
}

export function formatNumber(
  value: number,
  locale: string = DEFAULT_LOCALE,
  maximumFractionDigits: number = 0,
): string {
  if (!Number.isFinite(value)) return '0';

  return new Intl.NumberFormat(locale, {
    maximumFractionDigits,
  }).format(value);
}
