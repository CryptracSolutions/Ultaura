'use client';

import { useState, useRef, useEffect } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Popover, PopoverContent, PopoverTrigger } from '~/core/ui/Popover';
import { useSearch } from '~/lib/contexts/SearchContext';
import { SearchPanel } from '~/components/SearchCommandPalette';

const SearchTrigger = () => {
  const { openDesktop, close, isDesktopOpen, prefillQuery, clearPrefillQuery } = useSearch();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (value && !isDesktopOpen) {
      openDesktop();
    }
    if (!value && isDesktopOpen) {
      close();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      close();
      setQuery('');
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      if (query.trim().length > 0) {
        openDesktop();
      } else {
        close();
      }
    } else {
      close();
      setQuery('');
    }
  };

  return (
    <Popover open={isDesktopOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <div className="relative flex h-10 w-full max-w-xs items-center">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search..."
            className="flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background pl-10 pr-12 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Search"
            aria-haspopup="listbox"
            aria-expanded={isDesktopOpen}
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
        align="start"
        className="w-[var(--radix-popover-trigger-width)] max-w-[var(--radix-popover-trigger-width)] p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <SearchPanel isOpen={isDesktopOpen} query={query} onQueryChange={handleInputChange} />
      </PopoverContent>
    </Popover>
  );
};

export default SearchTrigger;
