'use client';

import * as React from 'react';

import { cn } from '~/core/generic/shadcn-utils';

export type SwitchProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange'
> & {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      className,
      checked,
      defaultChecked,
      onCheckedChange,
      disabled,
      type,
      onClick,
      ...props
    },
    ref,
  ) => {
    const isControlled = checked !== undefined;
    const [uncontrolledChecked, setUncontrolledChecked] = React.useState(
      defaultChecked ?? false,
    );

    const isChecked = isControlled ? checked : uncontrolledChecked;

    const toggle = React.useCallback(() => {
      if (disabled) return;

      const next = !isChecked;

      if (!isControlled) {
        setUncontrolledChecked(next);
      }

      onCheckedChange?.(next);
    }, [disabled, isChecked, isControlled, onCheckedChange]);

    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        role="switch"
        aria-checked={isChecked}
        data-state={isChecked ? 'checked' : 'unchecked'}
        disabled={disabled}
        className={cn(
          'inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors' +
            ' focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2' +
            ' focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50' +
            ' data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
          className,
        )}
        onClick={(e) => {
          onClick?.(e);
          if (!e.defaultPrevented) toggle();
        }}
        {...props}
      >
        <span
          data-state={isChecked ? 'checked' : 'unchecked'}
          className={cn(
            'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform',
            isChecked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
    );
  },
);

Switch.displayName = 'Switch';


