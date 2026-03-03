'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

import Button from '~/core/ui/Button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/core/ui/Select';

interface TablePaginationProps {
  page: number;
  pageCount: number;
  perPage?: number;
  totalCount?: number;
  validPerPageOptions?: number[];
  onPageChange?: (page: number, perPage: number) => void;
}

function TablePagination({
  page,
  pageCount,
  perPage,
  totalCount,
  validPerPageOptions = [20, 50, 100],
  onPageChange,
}: TablePaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const effectivePerPage = perPage ?? validPerPageOptions[0] ?? 20;

  const navigate = (newPage: number, newPerPage?: number) => {
    const resolvedPerPage = newPerPage ?? effectivePerPage;

    if (onPageChange) {
      onPageChange(newPage, resolvedPerPage);
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    if (newPerPage !== undefined) {
      params.set('perPage', String(newPerPage));
    }
    router.push(`?${params.toString()}`);
  };

  const showingStart =
    totalCount !== undefined && totalCount > 0
      ? (page - 1) * effectivePerPage + 1
      : 0;
  const showingEnd =
    totalCount !== undefined
      ? Math.min(page * effectivePerPage, totalCount)
      : 0;

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-4">
        {totalCount !== undefined && (
          <span className="text-sm text-muted-foreground">
            Showing {showingStart}&ndash;{showingEnd} of {totalCount}
          </span>
        )}

        {perPage !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page</span>
            <Select
              value={String(effectivePerPage)}
              onValueChange={(v) => navigate(1, Number(v))}
            >
              <SelectTrigger className="h-8 w-[70px] min-h-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {validPerPageOptions.map((opt) => (
                  <SelectItem key={opt} value={String(opt)}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Page {page} of {pageCount}
        </span>

        <Button
          variant="ghost"
          size="icon"
          disabled={page <= 1}
          onClick={() => navigate(page - 1)}
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          disabled={page >= pageCount}
          onClick={() => navigate(page + 1)}
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default TablePagination;
