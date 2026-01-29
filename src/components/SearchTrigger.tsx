'use client';

import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Popover, PopoverContent, PopoverTrigger } from '~/core/ui/Popover';
import { useSearch } from '~/lib/contexts/SearchContext';
import { SearchPanel } from '~/components/SearchCommandPalette';

const SearchTrigger = () => {
  const { openDesktop, close, isDesktopOpen } = useSearch();

  return (
    <Popover
      open={isDesktopOpen}
      onOpenChange={(open) => (open ? openDesktop() : close())}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={openDesktop}
          className="flex h-10 w-full max-w-xs items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Search"
          aria-haspopup="listbox"
          aria-expanded={isDesktopOpen}
        >
          <MagnifyingGlassIcon className="h-4 w-4" />
          <span className="truncate">Search...</span>
          <span className="ml-auto inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            ⌘K
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(560px,calc(100vw-2rem))] p-0"
      >
        <SearchPanel isOpen={isDesktopOpen} />
      </PopoverContent>
    </Popover>
  );
};

export default SearchTrigger;
