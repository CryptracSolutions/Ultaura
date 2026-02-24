'use client';

import { useEffect, useState } from 'react';

import Alert from '~/core/ui/Alert';
import Button from '~/core/ui/Button';
import TextField from '~/core/ui/TextField';
import Textarea from '~/core/ui/Textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/core/ui/Dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/core/ui/Select';

import type {
  ChangelogAdminEntry,
  ChangelogCategoryOption,
  ChangelogEntryFormValues,
} from './ChangelogAdminClient';

interface ChangelogEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  entry: ChangelogAdminEntry | null;
  categoryOptions: ChangelogCategoryOption[];
  onSubmit: (values: ChangelogEntryFormValues) => Promise<void>;
  submitError?: string | null;
  isSubmitting?: boolean;
}

interface FormState {
  title: string;
  description: string;
  category: string;
  sortOrder: string;
}

export default function ChangelogEntryDialog({
  open,
  onOpenChange,
  mode,
  entry,
  categoryOptions,
  onSubmit,
  submitError,
  isSubmitting = false,
}: ChangelogEntryDialogProps) {
  const [formState, setFormState] = useState<FormState>(() =>
    createInitialFormState(null, categoryOptions),
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const isCreateMode = mode === 'create';

  useEffect(() => {
    if (!open) {
      return;
    }

    setFormState(createInitialFormState(entry, categoryOptions));
    setValidationError(null);
  }, [open, entry, categoryOptions]);

  const categorySelectOptions = getCategoryOptions(categoryOptions, entry);

  function updateFormState<K extends keyof FormState>(key: K, value: FormState[K]) {
    setFormState((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);

    const title = formState.title.trim();
    const description = formState.description.trim();
    const category = formState.category.trim();
    const rawSortOrder = formState.sortOrder.trim();

    if (!title) {
      setValidationError('Title is required.');
      return;
    }

    if (!category) {
      setValidationError('Category is required.');
      return;
    }

    let sortOrder: number | null = null;

    if (rawSortOrder) {
      const parsed = Number(rawSortOrder);

      if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
        setValidationError('Sort order must be a whole number.');
        return;
      }

      sortOrder = parsed;
    }

    try {
      await onSubmit({
        title,
        description,
        category,
        sort_order: sortOrder,
      });
    } catch {
      // Parent component keeps the dialog open and shows submitError.
    }
  }

  const dialogTitle = isCreateMode ? 'New Changelog Entry' : 'Edit Changelog Entry';
  const dialogDescription =
    isCreateMode
      ? 'Add a changelog draft. Entries are published in bulk when you use Publish & Send Email.'
      : 'Update the entry details. Published entries can still be edited or deleted in v1.';

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <TextField>
            <TextField.Label>Title</TextField.Label>
            <TextField.Input
              data-autofocus
              value={formState.title}
              onChange={(event) => updateFormState('title', event.target.value)}
              placeholder="March updates and improvements"
              disabled={isSubmitting}
            />
          </TextField>

          <TextField>
            <TextField.Label>Description</TextField.Label>
            <Textarea
              rows={4}
              value={formState.description}
              onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                updateFormState('description', event.target.value)
              }
              placeholder="Short summary used in the dashboard and changelog list."
              disabled={isSubmitting}
            />
            <TextField.Hint>
              Keep this concise so families can quickly scan what changed.
            </TextField.Hint>
          </TextField>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium">Category</label>
              <Select
                value={formState.category}
                onValueChange={(value) => updateFormState('category', value)}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categorySelectOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <TextField>
              <TextField.Label>Sort Order</TextField.Label>
              <TextField.Input
                type="number"
                inputMode="numeric"
                step={1}
                value={formState.sortOrder}
                onChange={(event) => updateFormState('sortOrder', event.target.value)}
                placeholder="100"
                disabled={isSubmitting}
              />
              <TextField.Hint>
                Optional. Lower numbers appear first.
              </TextField.Hint>
            </TextField>
          </div>

          {validationError ? <Alert type="error">{validationError}</Alert> : null}
          {submitError ? <Alert type="error">{submitError}</Alert> : null}

          <DialogFooter className="gap-3 pt-2 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={isSubmitting}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              {isCreateMode ? 'Create Entry' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function createInitialFormState(
  entry: ChangelogAdminEntry | null,
  categoryOptions: ChangelogCategoryOption[],
): FormState {
  return {
    title: entry?.title ?? '',
    description: entry?.description ?? '',
    category: entry?.category ?? categoryOptions[0]?.value ?? 'announcement',
    sortOrder:
      entry?.sort_order == null || Number.isNaN(entry.sort_order)
        ? ''
        : String(entry.sort_order),
  };
}

function getCategoryOptions(
  categoryOptions: ChangelogCategoryOption[],
  entry: ChangelogAdminEntry | null,
) {
  const options =
    categoryOptions.length > 0
      ? [...categoryOptions]
      : [{ value: 'announcement', label: 'Announcement' }];

  const currentCategory = entry?.category?.trim();
  if (
    currentCategory &&
    !options.some((option) => option.value === currentCategory)
  ) {
    options.push({
      value: currentCategory,
      label: humanizeLabel(currentCategory),
    });
  }

  return options;
}

function humanizeLabel(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
