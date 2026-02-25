'use client';

import Badge from '~/core/ui/Badge';
import Button from '~/core/ui/Button';
import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '~/core/ui/Dropdown';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/core/ui/Table';

import type {
  ChangelogAdminEntry,
  ChangelogCategoryOption,
} from './ChangelogAdminClient';

interface ChangelogTableProps {
  entries: ChangelogAdminEntry[];
  categoryOptions: ChangelogCategoryOption[];
  onEdit: (entry: ChangelogAdminEntry) => void;
  onDelete: (entry: ChangelogAdminEntry) => void;
  disabled?: boolean;
  deletingEntryId?: string | null;
  savingEntryId?: string | null;
}

export default function ChangelogTable({
  entries,
  categoryOptions,
  onEdit,
  onDelete,
  disabled = false,
  deletingEntryId,
  savingEntryId,
}: ChangelogTableProps) {
  const categoryLabelMap = new Map(
    categoryOptions.map((option) => [option.value, option.label]),
  );

  if (entries.length === 0) {
    return (
      <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-border">
        <p className="px-4 text-center text-sm text-muted-foreground">
          No changelog entries yet. Create your first draft entry to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Published At</TableHead>
            <TableHead>Email Sent</TableHead>
            <TableHead className="w-[110px]">Actions</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {entries.map((entry) => {
            const isDeleting = deletingEntryId === entry.id;
            const isSaving = savingEntryId === entry.id;
            const status = getEntryStatus(entry);
            const statusLabel = status === 'published' ? 'Published' : 'Draft';

            return (
              <TableRow key={entry.id}>
                <TableCell>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-medium text-foreground">
                      {entry.title}
                    </span>

                    {entry.description ? (
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {entry.description}
                      </span>
                    ) : null}

                    {entry.sort_order != null ? (
                      <span className="text-xs text-muted-foreground">
                        Sort: {entry.sort_order}
                      </span>
                    ) : null}
                  </div>
                </TableCell>

                <TableCell>
                  <Badge size="small" color="info">
                    {categoryLabelMap.get(entry.category) ?? humanizeLabel(entry.category)}
                  </Badge>
                </TableCell>

                <TableCell>
                  <Badge
                    size="small"
                    color={status === 'published' ? 'success' : 'warn'}
                  >
                    {statusLabel}
                  </Badge>
                </TableCell>

                <TableCell>
                  {entry.published_at ? (
                    <span suppressHydrationWarning className="text-sm">
                      {formatDateTime(entry.published_at)}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>

                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Badge
                      size="small"
                      color={entry.email_sent ? 'success' : 'normal'}
                    >
                      {entry.email_sent ? 'Sent' : 'Not Sent'}
                    </Badge>

                    {entry.email_sent_at ? (
                      <span
                        suppressHydrationWarning
                        className="text-xs text-muted-foreground"
                      >
                        {formatDateTime(entry.email_sent_at)}
                      </span>
                    ) : null}
                  </div>
                </TableCell>

                <TableCell>
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={disabled || isSaving || isDeleting}
                        >
                          <span className="sr-only">Open changelog actions</span>
                          <EllipsisHorizontalIcon className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem
                          disabled={disabled || isSaving || isDeleting}
                          onClick={() => onEdit(entry)}
                        >
                          {isSaving ? 'Editing...' : 'Edit'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={disabled || isSaving || isDeleting}
                          className="text-red-500"
                          onClick={() => onDelete(entry)}
                        >
                          {isDeleting ? 'Deleting...' : 'Delete'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function getEntryStatus(entry: ChangelogAdminEntry): 'draft' | 'published' {
  const normalized = entry.status.trim().toLowerCase();
  if (normalized === 'published' || normalized === 'draft') {
    return normalized;
  }

  return entry.published_at ? 'published' : 'draft';
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function humanizeLabel(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
