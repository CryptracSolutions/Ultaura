'use client';

import { useFormStatus } from 'react-dom';
import { useState } from 'react';

import TextField from '~/core/ui/TextField';
import Trans from '~/core/ui/Trans';
import If from '~/core/ui/If';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '~/core/ui/Dialog';
import { X } from 'lucide-react';
import {
  modalIconButtonClass,
} from '~/core/ui/modal-button-classes';
import {
  COMPACT_OUTLINE_BUTTON_CLASS,
  COMPACT_PRIMARY_BUTTON_CLASS,
} from '~/app/dashboard/(app)/components/compact-action-classes';

import { createNewOrganizationAction } from '~/lib/organizations/actions';

const CreateOrganizationModal: React.FC<{
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}> = ({ isOpen, setIsOpen }) => {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        className="sm:max-w-[468px] max-h-[85vh] overflow-y-auto"
        overlayClassName="bg-black/50 backdrop-blur-none"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <DialogTitle className="truncate">
              <Trans i18nKey={'organization:createOrganizationModalHeading'} />
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Create a new workspace for billing and team access.
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className={modalIconButtonClass}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <CreateOrganizationForm setIsOpen={setIsOpen} />
      </DialogContent>
    </Dialog>
  );
};

export default CreateOrganizationModal;

function CreateOrganizationForm({
  setIsOpen,
}: {
  setIsOpen: (isOpen: boolean) => void;
}) {
  const [error, setError] = useState<boolean>();

  return (
    <form
      action={async (data) => {
        try {
          await createNewOrganizationAction(data);
          setIsOpen(false);
        } catch (error) {
          setError(true);
        }
      }}
    >
      <div className={'flex flex-col space-y-6'}>
        <If condition={error}>
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <p className="font-medium">
              <Trans i18nKey={'organization:createOrganizationErrorHeading'} />
            </p>
            <Trans i18nKey={'organization:createOrganizationErrorMessage'} />
          </div>
        </If>

        <TextField>
          <TextField.Label>
            <Trans i18nKey={'organization:organizationNameLabel'} />

            <TextField.Input
              data-cy={'create-organization-name-input'}
              name={'organization'}
              required
              minLength={2}
              maxLength={50}
              placeholder={''}
            />
          </TextField.Label>
        </TextField>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className={COMPACT_OUTLINE_BUTTON_CLASS}
          >
            <Trans i18nKey={'common:cancel'} />
          </button>

          <SubmitButton />
        </div>
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      data-cy={'confirm-create-organization-button'}
      type="submit"
      disabled={pending}
      className={COMPACT_PRIMARY_BUTTON_CLASS}
    >
      {pending ? (
        <>
          <span className="w-3 h-3 block animate-spin rounded-full border-2 border-current border-t-transparent" />
          <Trans i18nKey={'organization:createOrganizationSubmitLabel'} />
        </>
      ) : (
        <Trans i18nKey={'organization:createOrganizationSubmitLabel'} />
      )}
    </button>
  );
}
