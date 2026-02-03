'use client';

import { useState, useRef, useEffect, useCallback, useId } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Popover, PopoverContent, PopoverTrigger } from '~/core/ui/Popover';
import { useSearch } from '~/lib/contexts/SearchContext';
import { SearchPanel } from '~/components/SearchCommandPalette';

const SearchTrigger = () => {
  const { openDesktop, close, isDesktopOpen, prefillQuery, clearPrefillQuery } = useSearch();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (isDesktopOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isDesktopOpen]);

  useEffect(() => {
    if (prefillQuery && !query) {
      setQuery(prefillQuery);
      clearPrefillQuery();
    }
  }, [prefillQuery, query, clearPrefillQuery]);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (value.trim().length > 0 && !isDesktopOpen) {
      openDesktop();
    }
    if (value.trim().length === 0 && isDesktopOpen) {
      close();
    }
  };

  const handleClose = useCallback(() => {
    close();
    setQuery('');
    inputRef.current?.blur();
  }, [close]);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      if (query.trim().length > 0) {
        openDesktop();
      } else {
        close();
      }
    } else {
      handleClose();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      handleClose();
    }
  };

  useEffect(() => {
    if (!isDesktopOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (contentRef.current?.contains(target)) return;
      handleClose();
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [handleClose, isDesktopOpen]);

  return (
    <Popover open={isDesktopOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <div ref={triggerRef} className="relative flex h-8 w-full max-w-sm items-center">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search..."
            className="flex h-8 w-full items-center gap-2 rounded-md border border-input bg-background pl-10 pr-12 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:!outline-none focus-visible:!border-primary"
            aria-label="Search"
            role="combobox"
            aria-haspopup="listbox"
            aria-controls={listId}
            aria-expanded={isDesktopOpen}
            aria-autocomplete="list"
          />
          <MagnifyingGlassIcon className="absolute left-3 h-4 w-4 text-primary pointer-events-none" />
          {!query && (
            <span className="absolute right-3 inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground pointer-events-none">
              ⌘K
            </span>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        align="start"
        className="w-[var(--radix-popover-trigger-width)] max-w-[var(--radix-popover-trigger-width)] p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={() => handleClose()}
        onEscapeKeyDown={() => handleClose()}
      >
        <SearchPanel
          isOpen={isDesktopOpen}
          query={query}
          onQueryChange={handleInputChange}
          listId={listId}
        />
      </PopoverContent>
    </Popover>
  );
};

export default SearchTrigger;
