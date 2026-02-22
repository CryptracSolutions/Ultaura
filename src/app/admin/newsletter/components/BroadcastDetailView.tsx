'use client';

import { useState } from 'react';
import Alert from '~/core/ui/Alert';
import Badge from '~/core/ui/Badge';
import Button from '~/core/ui/Button';
import { adminCancelBroadcast } from '~/lib/ultaura/newsletter-admin-actions';

function statusBadgeColor(
  status: string,
): 'normal' | 'info' | 'success' | 'error' | 'warn' {
  switch (status) {
    case 'draft':
      return 'normal';
    case 'queued':
    case 'sending':
      return 'info';
    case 'sent':
      return 'success';
    case 'failed':
    case 'cancelled':
      return 'error';
    case 'scheduled':
      return 'warn';
    default:
      return 'normal';
  }
}

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">
          {broadcast.name || broadcast.subject || 'Untitled'}
        </h2>

        <div className="flex items-center gap-3">
          <Badge color={statusBadgeColor(status)} size="small">
            {status}
          </Badge>
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

      {error && <Alert type="error">{error}</Alert>}

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
