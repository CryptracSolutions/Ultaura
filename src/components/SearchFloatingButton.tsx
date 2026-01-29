'use client';

import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import Button from '~/core/ui/Button';
import { useSearch } from '~/lib/contexts/SearchContext';

const SearchFloatingButton = () => {
  const { open, isOpen } = useSearch();

  return (
    <Button
      type="button"
      round
      size="icon"
      onClick={open}
      className="fixed bottom-4 right-4 z-40 shadow-lg lg:hidden"
      aria-label="Search"
      aria-haspopup="dialog"
      aria-expanded={isOpen}
    >
      <MagnifyingGlassIcon className="h-5 w-5" />
    </Button>
  );
};

export default SearchFloatingButton;
