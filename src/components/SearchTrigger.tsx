'use client';

import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useSearch } from '~/lib/contexts/SearchContext';

const SearchTrigger = () => {
  const { open, isOpen } = useSearch();

  return (
    <button
      type="button"
      onClick={open}
      onFocus={open}
      className="flex h-10 w-full max-w-xs items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Search"
      aria-haspopup="dialog"
      aria-expanded={isOpen}
    >
      <MagnifyingGlassIcon className="h-4 w-4" />
      <span className="truncate">Search...</span>
      <span className="ml-auto inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        ⌘K
      </span>
    </button>
  );
};

export default SearchTrigger;
