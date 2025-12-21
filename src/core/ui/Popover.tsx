import { forwardRef } from 'react';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import classNames from 'clsx';

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(function PopoverContentComponent(
  { className, align = 'start', sideOffset = 8, alignOffset = 0, ...props },
  ref
) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        className={classNames(
          `animate-in data-[side=bottom]:slide-in-from-top-2
          data-[side=top]:slide-in-from-bottom-2 z-50 rounded-md border
          border-border bg-popover p-2 shadow-lg outline-none`,
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
});

const PopoverItem = forwardRef<
  HTMLDivElement,
  React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>
>(function PopoverItemComponent({ children, className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={classNames(
        `flex cursor-pointer items-center rounded-md bg-transparent py-2 px-4 transition duration-150 ease-in-out hover:bg-muted focus:outline-none active:bg-muted/80`,
        className
      )}
      {...props}
    >
      <span
        className={classNames(
          `truncate text-sm font-medium text-popover-foreground`
        )}
      >
        {children}
      </span>
    </div>
  );
});

const PopoverDivider: React.FC<{
  className?: string;
}> = ({ className }) => (
  <div
    className={classNames(
      `my-1 border-t border-border`,
      className
    )}
  />
);

PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverItem, PopoverDivider };
