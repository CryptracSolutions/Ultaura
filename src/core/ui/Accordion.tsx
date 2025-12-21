'use client';

import React, { createContext, useContext, useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { cn } from '~/core/generic/shadcn-utils';

const AccordionContext = createContext<{
  openItem: string | null;
  setOpenItem: (value: string | null) => void;
}>({
  openItem: null,
  setOpenItem: () => {},
});

export function Accordion({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  const [openItem, setOpenItem] = useState<string | null>(null);

  return (
    <AccordionContext.Provider value={{ openItem, setOpenItem }}>
      <div className={cn('flex flex-col space-y-2', className)}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

export function AccordionItem({
  children,
  value,
  className,
}: React.PropsWithChildren<{ value: string; className?: string }>) {
  return (
    <div
      className={cn(
        'border border-border rounded-xl overflow-hidden bg-card',
        className
      )}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          // @ts-ignore
          return React.cloneElement(child, { value });
        }
        return child;
      })}
    </div>
  );
}

export function AccordionTrigger({
  children,
  value,
  className,
}: React.PropsWithChildren<{ value?: string; className?: string }>) {
  const { openItem, setOpenItem } = useContext(AccordionContext);
  const isOpen = openItem === value;

  return (
    <button
      onClick={() => setOpenItem(isOpen ? null : value!)}
      className={cn(
        'flex w-full items-center justify-between p-6 text-left font-semibold text-foreground transition-all hover:bg-muted/50',
        className
      )}
    >
      {children}
      <ChevronDownIcon
        className={cn('h-5 w-5 transition-transform duration-200', {
          'rotate-180': isOpen,
        })}
      />
    </button>
  );
}

export function AccordionContent({
  children,
  value,
  className,
}: React.PropsWithChildren<{ value?: string; className?: string }>) {
  const { openItem } = useContext(AccordionContext);
  const isOpen = openItem === value;

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'px-6 pb-6 pt-0 text-muted-foreground text-sm animate-in fade-in zoom-in-95 duration-200',
        className
      )}
    >
      {children}
    </div>
  );
}

