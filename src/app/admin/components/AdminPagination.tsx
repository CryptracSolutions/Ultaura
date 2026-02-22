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

interface AdminPaginationProps {
  page: number;
  pageCount: number;
  perPage: number;
  validPerPageOptions?: number[];
}

function AdminPagination({
  page,
  pageCount,
  perPage,
  validPerPageOptions = [20, 50, 100],
}: AdminPaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const navigate = (newPage: number, newPerPage?: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    if (newPerPage !== undefined) {
      params.set('perPage', String(newPerPage));
    }
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Rows per page</span>
        <Select
          value={String(perPage)}
          onValueChange={(v) => navigate(1, Number(v))}
        >
          <SelectTrigger className="h-9 w-[70px] min-h-0">
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

export default AdminPagination;
