'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import Alert from '~/core/ui/Alert';
import Button from '~/core/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '~/core/ui/card';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import * as changelogAdminActions from '~/lib/ultaura/changelog-admin-actions';

import ChangelogEntryDialog from './ChangelogEntryDialog';
import ChangelogTable from './ChangelogTable';

export interface ChangelogCategoryOption {
  value: string;
  label: string;
  description?: string;
}

export interface ChangelogAdminEntry {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  sort_order?: number | null;
  status: string;
  published_at?: string | null;
  publish_batch_id?: string | null;
  email_sent?: boolean | null;
  email_sent_at?: string | null;
}

export interface ChangelogEntryFormValues {
  title: string;
  description: string;
  category: string;
  sort_order: number | null;
}

type Notice =
  | {
      type: 'success' | 'error';
      message: string;
    }
  | null;

type PendingAction =
  | { kind: 'save'; entryId?: string }
  | { kind: 'delete'; entryId: string }
  | { kind: 'publish' }
  | { kind: 'retry-latest-unsent'; batchId: string }
  | null;

interface ChangelogAdminClientProps {
  entries: ChangelogAdminEntry[];
  categoryOptions: ChangelogCategoryOption[];
  initialLoadError?: string | null;
}

export default function ChangelogAdminClient({
  entries,
  categoryOptions,
  initialLoadError,
}: ChangelogAdminClientProps) {
  const router = useRouter();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ChangelogAdminEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChangelogAdminEntry | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(
    initialLoadError ? { type: 'error', message: initialLoadError } : null,
  );
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const isBusy = pendingAction !== null;
  const draftCount = entries.filter((entry) => isDraftStatus(entry.status)).length;
  const latestRetryableUnsentBatch = getLatestRetryableUnsentBatch(entries);
  const retryableBatchId = latestRetryableUnsentBatch?.batchId ?? null;
  const publishHelperText =
    draftCount > 0
      ? `Publishes ${draftCount} draft ${
          draftCount === 1 ? 'entry' : 'entries'
        } and sends the changelog email.`
      : 'No draft entries available yet. Create or edit an entry, then publish all drafts with email.';
  const retryHelperText = latestRetryableUnsentBatch
    ? `Resends email for the latest published unsent batch (${latestRetryableUnsentBatch.unsentEntryCount} ${
        latestRetryableUnsentBatch.unsentEntryCount === 1 ? 'entry' : 'entries'
      }).`
    : 'No published unsent changelog batch detected yet.';

  function openCreateDialog() {
    if (isBusy) {
      return;
    }

    setEditingEntry(null);
    setDialogError(null);
    setDialogOpen(true);
  }

  function openEditDialog(entry: ChangelogAdminEntry) {
    if (isBusy) {
      return;
    }

    setEditingEntry(entry);
    setDialogError(null);
    setDialogOpen(true);
  }

  function handleDialogOpenChange(open: boolean) {
    if (pendingAction?.kind === 'save') {
      return;
    }

    setDialogOpen(open);

    if (!open) {
      setEditingEntry(null);
      setDialogError(null);
    }
  }

  async function handleSave(values: ChangelogEntryFormValues) {
    setDialogError(null);
    setNotice(null);

    const savingEntryId = editingEntry?.id;
    setPendingAction({ kind: 'save', entryId: savingEntryId });

    try {
      if (editingEntry) {
        const result = await changelogAdminActions.update({
          id: editingEntry.id,
          ...values,
        });
        assertActionSuccess(result, 'Failed to update changelog entry.');

        setNotice({
          type: 'success',
          message: result.message ?? 'Changelog entry updated.',
        });
      } else {
        const result = await changelogAdminActions.create(values);
        assertActionSuccess(result, 'Failed to create changelog entry.');

        setNotice({
          type: 'success',
          message: result.message ?? 'Changelog entry created.',
        });
      }

      setDialogOpen(false);
      setEditingEntry(null);
      router.refresh();
    } catch (error) {
      const message = getErrorMessage(error) ?? 'Failed to save changelog entry.';
      setDialogError(message);
      setNotice({ type: 'error', message });
      throw error instanceof Error ? error : new Error(message);
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) {
      return;
    }

    setNotice(null);
    setPendingAction({ kind: 'delete', entryId: deleteTarget.id });

    try {
      const result = await changelogAdminActions.remove({ id: deleteTarget.id });
      assertActionSuccess(result, 'Failed to delete changelog entry.');

      setNotice({
        type: 'success',
        message: result.message ?? 'Changelog entry deleted.',
      });
      setDeleteTarget(null);
      router.refresh();
    } catch (error) {
      const message = getErrorMessage(error) ?? 'Failed to delete changelog entry.';
      setNotice({ type: 'error', message });
      throw error instanceof Error ? error : new Error(message);
    } finally {
      setPendingAction(null);
    }
  }

  async function handlePublishAndSend() {
    if (isBusy || draftCount === 0) {
      return;
    }

    setNotice(null);
    setPendingAction({ kind: 'publish' });

    try {
      const result = await changelogAdminActions.publishAndSendChangelog();
      assertActionSuccess(result, 'Failed to publish changelog and send email.');

      const publishedCount = result.publishedCount ?? 0;
      setNotice({
        type: 'success',
        message:
          publishedCount > 0
            ? `Published ${publishedCount} ${
                publishedCount === 1 ? 'draft' : 'drafts'
              } and sent the changelog email.`
            : 'No drafts were available to publish.',
      });

      router.refresh();
    } catch (error) {
      const message =
        getErrorMessage(error) ?? 'Failed to publish changelog and send email.';
      setNotice({ type: 'error', message });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRetryLatestUnsentEmail() {
    if (isBusy || !retryableBatchId) {
      return;
    }

    setNotice(null);
    setPendingAction({
      kind: 'retry-latest-unsent',
      batchId: retryableBatchId,
    });

    try {
      const retryAction = getLatestRetryableUnsentChangelogEmailAction();

      if (!retryAction) {
        throw new Error(
          'Retry action is not available yet. Refresh after the backend retry action is deployed.',
        );
      }

      const result = await retryAction();
      assertActionSuccess(result, 'Failed to retry latest unsent changelog email.');

      const sentCount = result.email?.sent ?? 0;
      const failedCount = result.email?.failed ?? 0;
      const shortBatchId = shortenBatchId(retryableBatchId);

      setNotice({
        type: 'success',
        message:
          result.message ??
          (failedCount > 0
            ? `Retry completed for batch ${shortBatchId} with ${sentCount} sent and ${failedCount} failed recipients.`
            : `Retried changelog email for batch ${shortBatchId} successfully.`),
      });

      router.refresh();
    } catch (error) {
      const message =
        getErrorMessage(error) ?? 'Failed to retry latest unsent changelog email.';
      setNotice({ type: 'error', message });
    } finally {
      setPendingAction(null);
    }
  }

  const deletingEntryId =
    pendingAction?.kind === 'delete' ? pendingAction.entryId : null;
  const savingEntryId =
    pendingAction?.kind === 'save' ? pendingAction.entryId ?? null : null;

  return (
    <div className="flex flex-col gap-6">
      {notice ? (
        <Alert type={notice.type === 'success' ? 'success' : 'error'}>
          {notice.message}
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Changelog Admin</CardTitle>
          <p className="text-sm text-muted-foreground">
            Create draft entries, edit published entries, and publish all drafts in a
            single email send.
          </p>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-foreground">
                Publish &amp; Send Email
              </p>
              <p className="text-sm text-muted-foreground">{publishHelperText}</p>
              <p className="pt-1 text-sm font-medium text-foreground">
                Retry Latest Unsent Email
              </p>
              <p className="text-sm text-muted-foreground">{retryHelperText}</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="outline"
                onClick={openCreateDialog}
                disabled={isBusy}
              >
                New Entry
              </Button>

              <Button
                variant="outline"
                onClick={handleRetryLatestUnsentEmail}
                disabled={isBusy || !retryableBatchId}
                loading={pendingAction?.kind === 'retry-latest-unsent'}
              >
                Retry Unsent Email
              </Button>

              <Button
                onClick={handlePublishAndSend}
                disabled={isBusy || draftCount === 0}
                loading={pendingAction?.kind === 'publish'}
              >
                Publish &amp; Send Email
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>All Entries</CardTitle>
          <p className="text-sm text-muted-foreground">
            Title, category, status, publish timing, and email send state for every
            changelog entry.
          </p>
        </CardHeader>

        <CardContent className="pt-0">
          <ChangelogTable
            entries={entries}
            categoryOptions={categoryOptions}
            onEdit={openEditDialog}
            onDelete={setDeleteTarget}
            disabled={isBusy}
            deletingEntryId={deletingEntryId}
            savingEntryId={savingEntryId}
          />
        </CardContent>
      </Card>

      <ChangelogEntryDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        mode={editingEntry ? 'edit' : 'create'}
        entry={editingEntry}
        categoryOptions={categoryOptions}
        onSubmit={handleSave}
        submitError={dialogError}
        isSubmitting={pendingAction?.kind === 'save'}
      />

      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        title="Delete changelog entry?"
        description={
          deleteTarget
            ? `This will permanently delete “${deleteTarget.title}”. Published entries can also be deleted in v1.`
            : 'This will permanently delete this changelog entry.'
        }
        confirmLabel="Delete Entry"
        cancelLabel="Keep Entry"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

function isDraftStatus(status: string) {
  return status.trim().toLowerCase() === 'draft';
}

function isPublishedEntry(entry: ChangelogAdminEntry) {
  return entry.status.trim().toLowerCase() === 'published' || Boolean(entry.published_at);
}

function getLatestRetryableUnsentChangelogEmailAction() {
  const candidate = (
    changelogAdminActions as typeof changelogAdminActions & {
      retryLatestUnsentChangelogEmail?: unknown;
    }
  ).retryLatestUnsentChangelogEmail;

  return typeof candidate === 'function'
    ? (candidate as () => Promise<RetryLatestUnsentChangelogEmailResult>)
    : null;
}

function getLatestRetryableUnsentBatch(
  entries: ChangelogAdminEntry[],
): RetryableUnsentBatch | null {
  const byBatchId = new Map<string, RetryableUnsentBatchInternal>();

  for (const entry of entries) {
    if (!isPublishedEntry(entry) || entry.email_sent) {
      continue;
    }

    const batchId = normalizeNonEmptyString(entry.publish_batch_id);
    if (!batchId) {
      continue;
    }

    const publishedAt = normalizeNonEmptyString(entry.published_at);
    const publishedAtMs = toSortableTimestamp(publishedAt);
    const existing = byBatchId.get(batchId);

    if (existing) {
      existing.unsentEntryCount += 1;

      if (publishedAtMs >= existing.latestPublishedAtMs) {
        existing.latestPublishedAt = publishedAt;
        existing.latestPublishedAtMs = publishedAtMs;
      }

      continue;
    }

    byBatchId.set(batchId, {
      batchId,
      unsentEntryCount: 1,
      latestPublishedAt: publishedAt,
      latestPublishedAtMs: publishedAtMs,
    });
  }

  let latestBatch: RetryableUnsentBatchInternal | null = null;

  for (const batch of Array.from(byBatchId.values())) {
    if (!latestBatch || batch.latestPublishedAtMs > latestBatch.latestPublishedAtMs) {
      latestBatch = batch;
      continue;
    }

    if (
      latestBatch &&
      batch.latestPublishedAtMs === latestBatch.latestPublishedAtMs &&
      batch.batchId > latestBatch.batchId
    ) {
      latestBatch = batch;
    }
  }

  if (!latestBatch) {
    return null;
  }

  return {
    batchId: latestBatch.batchId,
    unsentEntryCount: latestBatch.unsentEntryCount,
    latestPublishedAt: latestBatch.latestPublishedAt,
  };
}

function normalizeNonEmptyString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function toSortableTimestamp(value: string | null) {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function shortenBatchId(batchId: string) {
  if (batchId.length <= 8) {
    return batchId;
  }

  return `${batchId.slice(0, 8)}...`;
}

interface RetryLatestUnsentChangelogEmailResult {
  success: boolean;
  error?: string | null;
  message?: string | null;
  batchId?: string | null;
  email?: {
    attempted?: number | null;
    sent?: number | null;
    failed?: number | null;
  } | null;
}

interface RetryableUnsentBatch {
  batchId: string;
  unsentEntryCount: number;
  latestPublishedAt: string | null;
}

interface RetryableUnsentBatchInternal extends RetryableUnsentBatch {
  latestPublishedAtMs: number;
}

function assertActionSuccess<T extends { success: boolean; error?: string | null }>(
  result: T,
  fallbackMessage: string,
): asserts result is T & { success: true } {
  if (!result.success) {
    throw new Error(result.error ?? fallbackMessage);
  }
}

function getErrorMessage(error: unknown): string | null {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return null;
}
