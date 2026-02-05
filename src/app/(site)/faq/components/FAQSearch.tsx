'use client';

import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { TextFieldInput } from '~/core/ui/TextField';

interface FAQSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  resultsCount?: number;
  categoriesCount?: number;
}

export function FAQSearch({
  query,
  onQueryChange,
  resultsCount,
  categoriesCount,
}: FAQSearchProps) {
  return (
    <div>
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <TextFieldInput
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search FAQs..."
          className="pl-12 pr-12 h-12"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            className="absolute right-4 top-1/2 -translate-y-1/2"
          >
            <XMarkIcon className="h-5 w-5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors" />
          </button>
        )}
      </div>
      {query && (
        <p className="text-sm text-muted-foreground mt-2">
          {resultsCount !== undefined && resultsCount > 0
            ? `${resultsCount} result${resultsCount !== 1 ? 's' : ''} in ${categoriesCount} categor${categoriesCount !== 1 ? 'ies' : 'y'}`
            : 'No results found'}
        </p>
      )}
    </div>
  );
}
