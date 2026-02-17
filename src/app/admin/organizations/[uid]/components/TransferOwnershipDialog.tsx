'use client';

import { useState, useTransition } from 'react';

import Button from '~/core/ui/Button';
import { TextFieldInput, TextFieldLabel } from '~/core/ui/TextField';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/core/ui/Dialog';

import Alert from '~/core/ui/Alert';
import { adminTransferOwnership } from '~/app/admin/organizations/[uid]/actions.server';

interface TransferOwnershipDialogProps {
  orgUid: string;
  currentOwnerName: string;
  newOwnerName: string;
  newOwnerMembershipId: number;
}

function TransferOwnershipDialog({
  orgUid,
  currentOwnerName,
  newOwnerName,
  newOwnerMembershipId,
}: TransferOwnershipDialogProps) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const isConfirmed = confirmation === 'TRANSFER';

  function handleSubmit() {
    setError('');

    const formData = new FormData();
    formData.set('orgId', orgUid);
    formData.set('newOwnerMembershipId', String(newOwnerMembershipId));

    startTransition(async () => {
      try {
        await adminTransferOwnership(formData);
        setOpen(false);
        setConfirmation('');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Transfer failed');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="small">
          Transfer Ownership
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer Ownership</DialogTitle>

          <DialogDescription>
            This will transfer organization ownership from{' '}
            <strong>{currentOwnerName}</strong> to{' '}
            <strong>{newOwnerName}</strong>. The current owner will be demoted
            to Admin.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col space-y-4">
          {error && (
            <Alert type="error">
              <Alert.Heading>Error</Alert.Heading>
              <span>{error}</span>
            </Alert>
          )}

          <TextFieldLabel>
            Type <strong>TRANSFER</strong> to confirm
            <TextFieldInput
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="TRANSFER"
              autoComplete="off"
            />
          </TextFieldLabel>

          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              size="small"
              onClick={() => {
                setOpen(false);
                setConfirmation('');
                setError('');
              }}
            >
              Cancel
            </Button>

            <Button
              variant="destructive"
              size="small"
              disabled={!isConfirmed || pending}
              loading={pending}
              onClick={handleSubmit}
            >
              Transfer Ownership
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TransferOwnershipDialog;
