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

  return isValidUsE164(formatToE164(trimmed)) ? null : 'Enter a valid US phone number.';
}
