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

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '~/core/ui/Select';

import Alert from '~/core/ui/Alert';
import MembershipRole from '~/lib/organizations/types/membership-role';
import { adminAddMember } from '~/app/admin/organizations/[uid]/actions.server';

interface AddMemberDialogProps {
  orgUid: string;
}

function AddMemberDialog({ orgUid }: AddMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<number>(MembershipRole.Member);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function handleSubmit() {
    setError('');

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    const formData = new FormData();
    formData.set('orgUid', orgUid);
    formData.set('email', email.trim());
    formData.set('role', String(role));

    startTransition(async () => {
      try {
        await adminAddMember(formData);
        setOpen(false);
        setEmail('');
        setRole(MembershipRole.Member);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to add member');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="small">
          Add Member
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Member</DialogTitle>

          <DialogDescription>
            Add a user to this organization by their email address. The user
            must already have an account.
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
            Email address
            <TextFieldInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              autoComplete="off"
            />
          </TextFieldLabel>

          <TextFieldLabel>
            Role
            <Select
              value={String(role)}
              onValueChange={(v) => setRole(Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={String(MembershipRole.Member)}>Member</SelectItem>
                <SelectItem value={String(MembershipRole.Admin)}>Admin</SelectItem>
              </SelectContent>
            </Select>
          </TextFieldLabel>

          <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setOpen(false);
                setEmail('');
                setRole(MembershipRole.Member);
                setError('');
              }}
            >
              Cancel
            </Button>

            <Button
              className="w-full"
              disabled={!email.trim() || pending}
              loading={pending}
              onClick={handleSubmit}
            >
              Add Member
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AddMemberDialog;
