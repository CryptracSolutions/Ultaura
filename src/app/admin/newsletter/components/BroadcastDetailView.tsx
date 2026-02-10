'use client';

import { useState } from 'react';
import Button from '~/core/ui/Button';
import { adminCancelBroadcast } from '~/lib/ultaura/newsletter-admin-actions';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  queued: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  sending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  sent: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

interface BroadcastDetailViewProps {
  broadcast: any;
}

export default function BroadcastDetailView({
  broadcast,
}: BroadcastDetailViewProps) {
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState('');

  const status = cancelled ? 'cancelled' : (broadcast.status || 'draft');
  const canCancel =
    !cancelled && (status === 'queued' || status === 'draft');

  async function handleCancel() {
    const confirmed = window.confirm(
      'Are you sure you want to cancel this broadcast?',
    );
    if (!confirmed) return;

    setCancelling(true);
    setError('');

    try {
      const result = await adminCancelBroadcast(broadcast.id);
      if (result.success) {
        setCancelled(true);
      } else {
        setError(result.error || 'Failed to cancel broadcast.');
      }
    } catch {
      setError('Failed to cancel broadcast.');
    } finally {
      setCancelling(false);
    }
  }

  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.draft;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">
          {broadcast.name || broadcast.subject || 'Untitled'}
        </h2>

        <div className="flex items-center gap-3">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle}`}
          >
            {status}
          </span>
        </div>

        <p className="text-sm text-muted-foreground" suppressHydrationWarning>
          Created:{' '}
          {broadcast.created_at
            ? new Date(broadcast.created_at).toLocaleString()
            : '-'}
        </p>

        {broadcast.sent_at && (
          <p
            className="text-sm text-muted-foreground"
            suppressHydrationWarning
          >
            Sent: {new Date(broadcast.sent_at).toLocaleString()}
          </p>
        )}
      </div>

      {broadcast.html && (
        <div className="border rounded-md p-4">
          <div dangerouslySetInnerHTML={{ __html: broadcast.html }} />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {canCancel && (
        <div>
          <Button
            variant="destructive"
            onClick={handleCancel}
            loading={cancelling}
            disabled={cancelling}
          >
            Cancel Broadcast
          </Button>
        </div>
      )}
    </div>
  );
}
