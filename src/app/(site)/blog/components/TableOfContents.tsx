'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { ListBulletIcon, XMarkIcon } from '@heroicons/react/24/outline';
import isBrowser from '~/core/generic/is-browser';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/core/ui/Tooltip';

type Heading = { level: number; text: string; id: string };

export default function TableOfContents({ headings }: { headings?: Heading[] }) {
  if (!headings || headings.length === 0) return null;

  return <FloatingTOC headings={headings} />;
}

function FloatingTOC({ headings }: { headings: Heading[] }) {
  const body = useMemo(() => {
    return isBrowser() ? document.body : null;
  }, []);

  const [isVisible, setIsVisible] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Only lock body scroll on mobile when overlay is open
  useEffect(() => {
    if (!body) return;
    const isMobile = window.innerWidth < 768;
    body.style.overflowY = isVisible && isMobile ? 'hidden' : '';
  }, [isVisible, body]);

  // Close desktop popover on outside click
  useEffect(() => {
    if (!isVisible) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        !target.closest('[data-toc-trigger]')
      ) {
        setIsVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isVisible]);

  const close = () => setIsVisible(false);
  const toggle = () => setIsVisible((v) => !v);

  const headingLinks = headings.map((heading) => (
    <a
      key={heading.id}
      href={`#${heading.id}`}
      onClick={close}
      className={`text-sm text-muted-foreground hover:text-primary transition-colors ${
        heading.level === 3 ? 'pl-4' : 'font-medium'
      }`}
    >
      {heading.text}
    </a>
  ));

  return (
    <>
      {/* Mobile: full-screen overlay */}
      {isVisible && (
        <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-sm p-6 overflow-auto md:hidden">
          <div className="mx-auto max-w-md pt-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-heading font-semibold text-foreground">
                Table of Contents
              </h2>
              <button
                onClick={close}
                className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-3">{headingLinks}</nav>
          </div>
        </div>
      )}

      {/* Desktop: popover anchored above the button */}
      {isVisible && (
        <div
          ref={popoverRef}
          className="hidden md:block fixed left-8 bottom-20 z-50 w-72 max-h-[60vh] overflow-y-auto rounded-xl border border-border bg-card shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <div className="sticky top-0 flex items-center justify-between p-4 pb-2 bg-card border-b border-border">
            <h2 className="text-sm font-heading font-semibold text-foreground">
              Table of Contents
            </h2>
            <button
              onClick={close}
              className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
          <nav className="flex flex-col gap-2 p-4 pt-3">{headingLinks}</nav>
        </div>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            data-toc-trigger
            className={
              'bg-primary text-primary-foreground h-12 w-12 rounded-full' +
              ' flex items-center justify-center fixed left-4 bottom-4 md:left-8 md:bottom-8' +
              ' hover:shadow-lg transition-all shadow-md' +
              ' hover:-translate-y-1 duration-300 hover:scale-105 z-50'
            }
            onClick={toggle}
          >
            {isVisible ? (
              <XMarkIcon className="h-6 w-6" />
            ) : (
              <ListBulletIcon className="h-6 w-6" />
            )}
          </button>
        </TooltipTrigger>

        <TooltipContent side="right" className="hidden lg:block">
          Table of contents
        </TooltipContent>
      </Tooltip>
    </>
  );
}
