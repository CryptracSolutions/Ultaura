'use client';

import { useState, useRef, useEffect, useCallback, useId } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Popover, PopoverContent, PopoverTrigger } from '~/core/ui/Popover';
import TextField from '~/core/ui/TextField';
import { useSearch } from '~/lib/contexts/SearchContext';
import { SearchPanel } from '~/components/SearchCommandPalette';

function SearchTrigger() {
  const { openDesktop, close, isDesktopOpen, prefillQuery, clearPrefillQuery } = useSearch();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
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

  const handleClose = useCallback(() => {
    close();
    setQuery('');
    inputRef.current?.blur();
  }, [close]);

  function handleInputChange(value: string) {
    setQuery(value);
    if (value.trim().length > 0 && !isDesktopOpen) {
      openDesktop();
    }
  }

  function handleOpenChange(open: boolean) {
    if (open) {
      openDesktop();
    } else if (document.activeElement !== inputRef.current) {
      handleClose();
    }
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      handleClose();
    }
  }

  return (
    <Popover open={isDesktopOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <div className="relative flex h-[31px] w-full min-w-0 items-center md:w-[51%]">
          <TextField.Input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (!isDesktopOpen) openDesktop();
            }}
            placeholder="Search..."
            className="!h-[31px] !min-h-0 pl-10 pr-12 shadow-sm"
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
        align="start"
        className="w-[var(--radix-popover-trigger-width)] max-w-none p-0"
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
}

export default SearchTrigger;
