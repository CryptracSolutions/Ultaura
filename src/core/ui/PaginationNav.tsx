'use client';

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface PaginationNavProps {
  totalPages: number;
  currentPage: number;
  showAmount: number;
  onPageSelect: (page: number) => void;
  onNextPageClick: () => void;
  onPreviousPageClick: () => void;
}

function getVisiblePages(
  totalPages: number,
  currentPage: number,
  showAmount: number,
): (number | 'ellipsis')[] {
  if (totalPages <= showAmount) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [];

  // Always reserve slots for first page, last page, and current page.
  // The remaining slots are distributed around the current page.
  // We keep 1 slot for the first page, 1 for the last, and up to 2 for ellipses,
  // leaving (showAmount - 2) slots for the middle window.
  const sideSlots = showAmount - 2; // slots available between first and last
  const half = Math.floor((sideSlots - 1) / 2);

  let start = currentPage - half;
  let end = currentPage + (sideSlots - 1 - half);

  // Clamp the window so it doesn't overlap with first/last page slots
  if (start <= 2) {
    start = 2;
    end = start + sideSlots - 1;
  }

  if (end >= totalPages - 1) {
    end = totalPages - 1;
    start = end - sideSlots + 1;
  }

  // Ensure bounds
  start = Math.max(2, start);
  end = Math.min(totalPages - 1, end);

  // Build the page list
  pages.push(1);

  if (start > 2) {
    pages.push('ellipsis');
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (end < totalPages - 1) {
    pages.push('ellipsis');
  }

  pages.push(totalPages);

  return pages;
}

export default function PaginationNav({
  totalPages,
  currentPage,
  showAmount,
  onPageSelect,
  onNextPageClick,
  onPreviousPageClick,
}: PaginationNavProps) {
  if (totalPages <= 1) return null;

  const visiblePages = getVisiblePages(totalPages, currentPage, showAmount);

  const prevButton = (
    <button
      type="button"
      aria-label="Previous page"
      disabled={currentPage <= 1}
      onClick={onPreviousPageClick}
      className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40 sm:h-10 sm:w-10"
    >
      <ChevronLeftIcon className="h-4 w-4" />
    </button>
  );

  const nextButton = (
    <button
      type="button"
      aria-label="Next page"
      disabled={currentPage >= totalPages}
      onClick={onNextPageClick}
      className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40 sm:h-10 sm:w-10"
    >
      <ChevronRightIcon className="h-4 w-4" />
    </button>
  );

  return (
    <nav aria-label="Pagination">
      {/* 1–2 cards visible: compact "< 3 of 9 >" layout */}
      <div className="flex items-center justify-center gap-3 lg:hidden">
        {prevButton}
        <span className="text-sm tabular-nums text-muted-foreground">
          <span className="font-semibold text-primary">{currentPage}</span>
          <span className="mx-1">of</span>
          {totalPages}
        </span>
        {nextButton}
      </div>

      {/* 3 cards visible (lg+): full numbered pagination */}
      <div className="hidden items-center justify-center gap-1 lg:flex">
        {prevButton}

        {visiblePages.map((page, index) => {
          if (page === 'ellipsis') {
            return (
              <span
                key={`ellipsis-${index}`}
                className="flex h-10 w-10 items-center justify-center text-sm text-muted-foreground"
                aria-hidden
              >
                &hellip;
              </span>
            );
          }

          const isActive = page === currentPage;

          return (
            <button
              key={page}
              type="button"
              aria-label={`Page ${page}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onPageSelect(page)}
              className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium transition ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              }`}
            >
              {page}
            </button>
          );
        })}

        {nextButton}
      </div>
    </nav>
  );
}
