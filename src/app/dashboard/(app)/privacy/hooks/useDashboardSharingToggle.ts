'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import type { NotificationRecipient } from '~/lib/ultaura/types';
import { grantDashboardAccess, revokeDashboardAccess } from '~/lib/ultaura/dashboard-sharing';

interface UseDashboardSharingToggleOptions {
  accountId: string;
  recipients: NotificationRecipient[];
  setRecipients: React.Dispatch<React.SetStateAction<NotificationRecipient[]>>;
}

export function useDashboardSharingToggle(options: UseDashboardSharingToggleOptions) {
  const { accountId, recipients, setRecipients } = options;
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [pendingRecipient, setPendingRecipient] = useState<NotificationRecipient | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const requestGrant = useCallback((recipient: NotificationRecipient) => {
    setPendingRecipient(recipient);
    setIsConfirmDialogOpen(true);
  }, []);

  const cancelGrant = useCallback(() => {
    if (isLoading) {
      return;
    }

    setIsConfirmDialogOpen(false);
    setPendingRecipient(null);
  }, [isLoading]);

  const confirmGrant = useCallback(async () => {
    if (!pendingRecipient) {
      return;
    }

    setIsLoading(true);

    try {
      const result = await grantDashboardAccess(accountId, pendingRecipient.id);

      if (!result.success) {
        toast.error(result.error.message || 'Failed to grant dashboard access');
        return;
      }

      const grantedAt = new Date().toISOString();
      setRecipients((prev) =>
        prev.map((item) =>
          item.id === pendingRecipient.id
            ? { ...item, dashboardAccessGrantedAt: grantedAt }
            : item,
        ),
      );

      toast.success(`Dashboard access granted to ${pendingRecipient.name}`);
      setIsConfirmDialogOpen(false);
      setPendingRecipient(null);
    } catch {
      toast.error('Failed to grant dashboard access');
    } finally {
      setIsLoading(false);
    }
  }, [accountId, pendingRecipient, setRecipients]);

  const revoke = useCallback(
    async (recipientId: string) => {
      setIsLoading(true);

      try {
        const recipient = recipients.find((item) => item.id === recipientId) ?? null;
        const result = await revokeDashboardAccess(accountId, recipientId);

        if (!result.success) {
          toast.error(result.error.message || 'Failed to remove dashboard access');
          return;
        }

        setRecipients((prev) =>
          prev.map((item) =>
            item.id === recipientId
              ? { ...item, dashboardAccessGrantedAt: null }
              : item,
          ),
        );

        toast.success(
          recipient
            ? `Dashboard access removed for ${recipient.name}`
            : 'Dashboard access removed',
        );
      } catch {
        toast.error('Failed to remove dashboard access');
      } finally {
        setIsLoading(false);
      }
    },
    [accountId, recipients, setRecipients],
  );

  return {
    isConfirmDialogOpen,
    pendingRecipient,
    isLoading,
    requestGrant,
    confirmGrant,
    cancelGrant,
    revoke,
  };
}
