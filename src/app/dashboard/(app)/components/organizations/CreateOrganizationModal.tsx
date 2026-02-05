'use client';

import { useFormStatus } from 'react-dom';
import { useState } from 'react';

import TextField from '~/core/ui/TextField';
import Trans from '~/core/ui/Trans';
import If from '~/core/ui/If';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '~/core/ui/Dialog';
import Button from '~/core/ui/Button';
import { X } from 'lucide-react';

import { createNewOrganizationAction } from '~/lib/organizations/actions';

const CreateOrganizationModal: React.FC<{
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}> = ({ isOpen, setIsOpen }) => {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        className="mobile-form-sheet sm:max-w-[468px] max-h-[85vh] overflow-y-auto"
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </Button>
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
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(false)}
          >
            <Trans i18nKey={'common:cancel'} />
          </Button>

          <SubmitButton />
        </div>
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      data-cy={'confirm-create-organization-button'}
      type="submit"
      variant="default"
      loading={pending}
    >
      <Trans i18nKey={'organization:createOrganizationSubmitLabel'} />
    </Button>
  );
}
