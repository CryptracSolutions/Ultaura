'use client';

import { forwardRef } from 'react';
import classNames from 'clsx';
import type { ComponentPropsWithRef, ChangeEvent } from 'react';

import { formatUsPhoneForDisplay } from '~/lib/ultaura/phone';

type PhoneInputProps = Omit<ComponentPropsWithRef<'input'>, 'value' | 'onChange' | 'type'> & {
  value: string;
  onValueChange: (value: string) => void;
};

const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  { value, onValueChange, onBlur, className, ...props },
  ref,
) {
  return (
    <input
      {...props}
      ref={ref}
      type="tel"
      value={value}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onValueChange(event.target.value)}
      onBlur={(event) => {
        onValueChange(formatUsPhoneForDisplay(event.target.value));
        onBlur?.(event);
      }}
      className={classNames(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:!outline-none focus-visible:!border-primary disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    />
  );
});

export default PhoneInput;
