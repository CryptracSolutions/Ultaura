'use client';

import { forwardRef, useId } from 'react';
import classNames from 'clsx';
import type { ComponentPropsWithRef, ChangeEvent } from 'react';

import { formatUsPhoneProgressive } from '~/lib/ultaura/phone';

type PhoneInputProps = Omit<
  ComponentPropsWithRef<'input'>,
  'value' | 'onChange' | 'type' | 'inputMode' | 'autoComplete' | 'maxLength'
> & {
  value: string;
  onValueChange: (value: string) => void;
  /** Pass an error string to render aria-invalid and aria-describedby. */
  error?: string;
  /** Custom ID for the error element. Auto-generated if not provided. */
  errorId?: string;
};

/**
 * US-only phone input with format-as-you-type, +1 prefix, numeric keypad,
 * autocomplete, and accessibility support.
 *
 * Max formatted length: "(555) 123-4567" = 14 chars.
 */
const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  function PhoneInput(
    { value, onValueChange, error, errorId, onBlur, className, id, ...props },
    ref,
  ) {
    const autoId = useId();
    const resolvedErrorId = errorId ?? `${id ?? autoId}-error`;

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      const formatted = formatUsPhoneProgressive(event.target.value);
      onValueChange(formatted);
    };

    return (
      <div className="flex items-center gap-0">
        <span
          className={classNames(
            'flex h-10 shrink-0 select-none items-center rounded-l-md border border-r-0 border-input bg-muted px-2.5 text-sm text-muted-foreground',
            props.disabled && 'opacity-50',
          )}
          aria-hidden="true"
        >
          +1
        </span>

        <input
          {...props}
          ref={ref}
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={14}
          value={value}
          onChange={handleChange}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? resolvedErrorId : undefined}
          className={classNames(
            'flex h-10 w-full rounded-r-md border border-input bg-background px-3 py-2 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:!outline-none focus-visible:!border-primary disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive',
            className,
          )}
        />
      </div>
    );
  },
);

export default PhoneInput;
