'use client';

import { useCallback, useId } from 'react';

import clsx from 'clsx';

const COUNTRY_CODES = [
  { code: '+1', country: 'US', label: 'United States (+1)' },
  { code: '+1', country: 'CA', label: 'Canada (+1)' },
  { code: '+44', country: 'GB', label: 'United Kingdom (+44)' },
  { code: '+61', country: 'AU', label: 'Australia (+61)' },
  { code: '+33', country: 'FR', label: 'France (+33)' },
  { code: '+49', country: 'DE', label: 'Germany (+49)' },
  { code: '+91', country: 'IN', label: 'India (+91)' },
  { code: '+81', country: 'JP', label: 'Japan (+81)' },
  { code: '+52', country: 'MX', label: 'Mexico (+52)' },
  { code: '+55', country: 'BR', label: 'Brazil (+55)' },
] as const;

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

interface PhoneNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
}

function parseE164(value: string) {
  for (const entry of COUNTRY_CODES) {
    if (value.startsWith(entry.code)) {
      return {
        countryCode: entry.code,
        nationalNumber: value.slice(entry.code.length),
      };
    }
  }

  return { countryCode: '+1', nationalNumber: '' };
}

function PhoneNumberInput({
  value,
  onChange,
  disabled,
  error,
  className,
}: PhoneNumberInputProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const { countryCode, nationalNumber } = parseE164(value);

  const handleCountryChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newCode = e.target.value;
      onChange(`${newCode}${nationalNumber}`);
    },
    [nationalNumber, onChange],
  );

  const handleNumberChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, '');
      onChange(`${countryCode}${digits}`);
    },
    [countryCode, onChange],
  );

  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      <div className="flex gap-2">
        <select
          value={countryCode}
          onChange={handleCountryChange}
          disabled={disabled}
          aria-label="Country code"
          className={clsx(
            'h-11 min-h-[44px] w-[130px] rounded-lg border border-input bg-background px-3',
            'text-sm text-foreground',
            'focus:ring-2 focus:ring-primary/50 focus:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive',
          )}
        >
          {COUNTRY_CODES.map((entry) => (
            <option key={`${entry.country}-${entry.code}`} value={entry.code}>
              {entry.label}
            </option>
          ))}
        </select>

        <input
          id={id}
          type="tel"
          inputMode="numeric"
          value={nationalNumber}
          onChange={handleNumberChange}
          disabled={disabled}
          placeholder="(555) 123-4567"
          aria-describedby={error ? errorId : undefined}
          aria-invalid={!!error}
          className={clsx(
            'h-11 min-h-[44px] flex-1 rounded-lg border border-input bg-background px-3',
            'text-sm text-foreground placeholder:text-muted-foreground',
            'focus:ring-2 focus:ring-primary/50 focus:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive',
          )}
        />
      </div>

      {error && (
        <p id={errorId} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default PhoneNumberInput;
export { E164_REGEX, COUNTRY_CODES };
export type { PhoneNumberInputProps };
