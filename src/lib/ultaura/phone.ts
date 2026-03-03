import { TELEPHONY } from './constants';

const US_COUNTRY_CODE = '1';

function normalizeUsDigits(input: string): string | null {
  const digits = input.replace(/\D/g, '');

  if (digits.length === 11 && digits.startsWith(US_COUNTRY_CODE)) {
    return digits.slice(1);
  }

  if (digits.length === 10) {
    return digits;
  }

  return null;
}

export function formatToE164(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return input;

  const digits = trimmed.replace(/\D/g, '');

  if (digits.length === 11 && digits.startsWith(US_COUNTRY_CODE)) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+${US_COUNTRY_CODE}${digits}`;
  }

  if (!trimmed.startsWith('+') && digits.length > 0) {
    return `+${digits}`;
  }

  return trimmed;
}

export function formatUsPhoneForDisplay(input: string): string {
  const digits = normalizeUsDigits(input);
  if (!digits) return input;

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Progressive US phone formatter for format-as-you-type.
 * Works on partial input — formats digits incrementally:
 *   ""          → ""
 *   "5"         → "(5"
 *   "55"        → "(55"
 *   "555"       → "(555"
 *   "5551"      → "(555) 1"
 *   "55512"     → "(555) 12"
 *   "555123"    → "(555) 123"
 *   "5551234"   → "(555) 123-4"
 *   "5551234567"→ "(555) 123-4567"
 */
export function formatUsPhoneProgressive(input: string): string {
  // Strip to raw digits, removing a leading "1" country code if 11 digits
  let digits = input.replace(/\D/g, '');

  if (digits.length === 11 && digits.startsWith(US_COUNTRY_CODE)) {
    digits = digits.slice(1);
  }

  // Cap at 10 digits (US national number)
  digits = digits.slice(0, 10);

  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function isValidUsE164(input: string): boolean {
  return TELEPHONY.PHONE_REGEX.test(input);
}

export function isValidUsPhoneInput(
  input: string,
  options?: { required?: boolean },
): boolean {
  const trimmed = input.trim();

  if (!trimmed) {
    return !options?.required;
  }

  return isValidUsE164(formatToE164(trimmed));
}

export function getUsPhoneValidationError(
  input: string,
  options?: { required?: boolean },
): string | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return options?.required ? 'Phone number is required.' : null;
  }

  return isValidUsE164(formatToE164(trimmed))
    ? null
    : 'Enter a valid US phone number.';
}
