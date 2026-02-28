'use client';

import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';

export interface PrivacyDialogsProps {
  reinviteDialogOpen: boolean;
  onReinviteDialogOpenChange: (open: boolean) => void;
  onConfirmReinvite: () => void | Promise<void>;
  deleteDialogOpen: boolean;
  onDeleteDialogOpenChange: (open: boolean) => void;
  onConfirmDeleteData: () => void | Promise<void>;
  upgradeConfirmOpen: boolean;
  onUpgradeConfirmOpenChange: (open: boolean) => void;
  onConfirmUpgrade: () => void | Promise<void>;
  retentionConfirmOpen: boolean;
  onRetentionConfirmOpenChange: (open: boolean) => void;
  onConfirmRetentionChange: () => void | Promise<void>;
}

export function PrivacyDialogs({
  reinviteDialogOpen,
  onReinviteDialogOpenChange,
  onConfirmReinvite,
  deleteDialogOpen,
  onDeleteDialogOpenChange,
  onConfirmDeleteData,
  upgradeConfirmOpen,
  onUpgradeConfirmOpenChange,
  onConfirmUpgrade,
  retentionConfirmOpen,
  onRetentionConfirmOpenChange,
  onConfirmRetentionChange,
}: PrivacyDialogsProps) {
  return (
    <>
      <ConfirmationDialog
        open={reinviteDialogOpen}
        onOpenChange={onReinviteDialogOpenChange}
        title="Re-invite this recipient?"
        description="They previously unsubscribed from updates. Re-inviting will send a new confirmation email."
        confirmLabel="Re-invite"
        variant="default"
        onConfirm={onConfirmReinvite}
      />

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={onDeleteDialogOpenChange}
        title="Delete privacy data"
        description="This will permanently delete memories, call insights, and recordings for this account. This action cannot be undone."
        confirmLabel="Delete data"
        variant="destructive"
        onConfirm={onConfirmDeleteData}
      />

      <ConfirmationDialog
        open={upgradeConfirmOpen}
        onOpenChange={onUpgradeConfirmOpenChange}
        title="Upgrade to Family Mode?"
        description="This change is permanent and cannot be undone. Your account will switch to family-managed mode."
        confirmLabel="Upgrade now"
        variant="default"
        onConfirm={onConfirmUpgrade}
      />

      <ConfirmationDialog
        open={retentionConfirmOpen}
        onOpenChange={onRetentionConfirmOpenChange}
        title="Change data retention?"
        description="Updating retention can affect how long historical memories and insights are kept."
        confirmLabel="Save retention"
        variant="default"
        onConfirm={onConfirmRetentionChange}
      />
    </>
  );
}
