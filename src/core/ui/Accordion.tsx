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

const AccordionItemContext = createContext<string>('');

export function Accordion({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  const [openItem, setOpenItem] = useState<string | null>(null);

  return (
    <AccordionContext.Provider value={{ openItem, setOpenItem }}>
      <div className={cn('flex flex-col space-y-2', className)}>{children}</div>
    </AccordionContext.Provider>
  );
}

export function AccordionItem({
  children,
  value,
  className,
}: React.PropsWithChildren<{ value: string; className?: string }>) {
  return (
    <AccordionItemContext.Provider value={value}>
      <div
        className={cn(
          'border border-border rounded-xl overflow-hidden bg-card',
          className,
        )}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
}

export function AccordionTrigger({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  const value = useContext(AccordionItemContext);
  const { openItem, setOpenItem } = useContext(AccordionContext);
  const isOpen = openItem === value;

  const triggerId = `accordion-trigger-${value}`;
  const contentId = `accordion-content-${value}`;

  return (
    <button
      type="button"
      id={triggerId}
      aria-expanded={isOpen}
      aria-controls={contentId}
      onClick={() => setOpenItem(isOpen ? null : value)}
      className={cn(
        'flex w-full items-center justify-between p-6 text-left font-semibold text-foreground transition-all hover:bg-muted/50',
        className,
      )}
    >
      {children}
      <ChevronDownIcon
        className={cn(
          'h-5 w-5 shrink-0 text-primary transition-transform duration-200',
          { 'rotate-180': isOpen },
        )}
        aria-hidden="true"
      />
    </button>
  );
}

export function AccordionContent({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  const value = useContext(AccordionItemContext);
  const { openItem } = useContext(AccordionContext);
  const isOpen = openItem === value;

  const triggerId = `accordion-trigger-${value}`;
  const contentId = `accordion-content-${value}`;

  return (
    <div
      id={contentId}
      role="region"
      aria-labelledby={triggerId}
      className={cn(
        'grid transition-[grid-template-rows] duration-200 ease-out',
        isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}
    >
      <div className="overflow-hidden">
        <div
          className={cn(
            'px-6 pb-6 pt-3 text-sm text-muted-foreground',
            className,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
