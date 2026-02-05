'use client';

import { useCallback, useContext, useEffect } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import type { SupabaseClient } from '@supabase/supabase-js';

import OrganizationContext from '~/lib/contexts/organization';
import useUpdateOrganizationMutation from '~/lib/organizations/hooks/use-update-organization-mutation';

import TextField from '~/core/ui/TextField';
import Trans from '~/core/ui/Trans';
import ImageUploader from '~/core/ui/ImageUploader';

import useSupabase from '~/core/hooks/use-supabase';
import type Organization from '~/lib/organizations/types/organization';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { useLeavePageGuard } from '~/core/hooks/use-leave-page-guard';
import Button from '~/core/ui/Button';

const UpdateOrganizationForm = () => {
  const { organization, setOrganization } = useContext(OrganizationContext);
  const updateOrganizationMutation = useUpdateOrganizationMutation();
  const { t } = useTranslation('organization');

  const currentOrganizationName = organization?.name ?? '';
  const organizationId = organization?.id as number;

  const { register, handleSubmit, reset, formState } = useForm({
    defaultValues: {
      name: currentOrganizationName,
    },
  });
  const hasChanges = formState.isDirty;
  const shouldWarnOnNavigate = hasChanges && !updateOrganizationMutation.isMutating;
  const resetForm = useCallback(() => {
    reset({
      name: currentOrganizationName,
    });
  }, [currentOrganizationName, reset]);
  const { dialogProps } = useLeavePageGuard({
    isDirty: shouldWarnOnNavigate,
    onDiscard: resetForm,
  });

  const updateOrganizationData = useCallback(
    (data: WithId<Partial<Organization>>) => {
      const promise = updateOrganizationMutation.trigger(data).then(() => {
        setOrganization({
          ...organization,
          ...data,
        } as Organization);
      });

      toast.promise(promise, {
        loading: t(`updateOrganizationLoadingMessage`),
        success: t(`updateOrganizationSuccessMessage`),
        error: t(`updateOrganizationErrorMessage`),
      });
    },
    [organization, setOrganization, t, updateOrganizationMutation],
  );

  const onSubmit = useCallback(
    async (organizationName: string) => {
      const organizationId = organization?.id;

      if (!organizationId) {
        const errorMessage = t(`updateOrganizationErrorMessage`);

        return toast.error(errorMessage);
      }

      const organizationData: WithId<Partial<Organization>> = {
        id: organizationId,
        name: organizationName,
      };

      return updateOrganizationData(organizationData);
    },
    [organization?.id, updateOrganizationData, t],
  );

  useEffect(() => {
    reset({
      name: organization?.name,
    });
  }, [organization, reset]);

  const nameControl = register('name', {
    required: true,
  });

  return (
    <div className={'space-y-8'}>
      <UploadLogoForm
        currentLogoUrl={organization?.logoURL}
        organizationId={organizationId}
        onLogoUpdated={async (logoUrl) => {
          return updateOrganizationData({
            logoURL: logoUrl,
            id: organizationId,
          });
        }}
      />

      <form
        onSubmit={handleSubmit((value) => onSubmit(value.name))}
        className={'flex flex-col space-y-4'}
      >
        <TextField>
          <TextField.Label>
            <Trans i18nKey={'organization:organizationNameInputLabel'} />

            <TextField.Input
              {...nameControl}
              data-cy={'organization-name-input'}
              required
              placeholder={''}
            />
          </TextField.Label>
        </TextField>

        <div className={'flex flex-col gap-3 md:flex-row'}>
          <Button
            type={'button'}
            variant="outline"
            size="small"
            onClick={resetForm}
            disabled={!hasChanges || updateOrganizationMutation.isMutating}
          >
            Discard changes
          </Button>
          <Button
            variant="default"
            size="small"
            data-cy={'update-organization-submit-button'}
            disabled={!hasChanges || updateOrganizationMutation.isMutating}
            loading={updateOrganizationMutation.isMutating}
          >
            <Trans i18nKey={'organization:updateOrganizationSubmitLabel'} />
          </Button>
        </div>
      </form>

      <ConfirmationDialog
        open={dialogProps.open}
        onOpenChange={dialogProps.onOpenChange}
        title="Unsaved changes"
        description="You have unsaved changes. Leave without saving?"
        confirmLabel="Discard & leave"
        cancelLabel="Stay here"
        variant="default"
        onConfirm={dialogProps.onConfirm}
      />
    </div>
  );
};

function UploadLogoForm(props: {
  currentLogoUrl: string | null | undefined;
  organizationId: number;
  onLogoUpdated: (url: string | null) => void;
}) {
  const client = useSupabase();
  const { t } = useTranslation('organization');

  const createToaster = useCallback(
    (promise: Promise<unknown>) => {
      return toast.promise(promise, {
        loading: t(`updateOrganizationLoadingMessage`),
        success: t(`updateOrganizationSuccessMessage`),
        error: t(`updateOrganizationErrorMessage`),
      });
    },
    [t],
  );

  const onValueChange = useCallback(
    async (file: File | null) => {
      const removeExistingStorageFile = () => {
        if (props.currentLogoUrl) {
          return deleteLogo(client, props.currentLogoUrl);
        }

        return Promise.resolve();
      };

      if (file) {
        const promise = removeExistingStorageFile()
          .then(() =>
            uploadLogo({
              client,
              organizationId: props.organizationId,
              logo: file,
            }),
          )
          .then((url) => {
            props.onLogoUpdated(url);
          });

        createToaster(promise);
      } else {
        const promise = removeExistingStorageFile().then(() => {
          props.onLogoUpdated(null);
        });

        createToaster(promise);
      }
    },
    [client, createToaster, props],
  );

  return (
    <ImageUploader value={props.currentLogoUrl} onValueChange={onValueChange}>
      <div className={'flex flex-col space-y-1'}>
        <span className={'text-sm'}>
          <Trans i18nKey={'organization:organizationLogoInputHeading'} />
        </span>

        <span className={'text-xs'}>
          <Trans i18nKey={'organization:organizationLogoInputSubheading'} />
        </span>
      </div>
    </ImageUploader>
  );
}

async function uploadLogo({
  client,
  organizationId,
  logo,
}: {
  client: SupabaseClient;
  organizationId: number;
  logo: File;
}) {
  const bytes = await logo.arrayBuffer();
  const bucket = client.storage.from('logos');
  const fileName = await getLogoName(logo.name, organizationId);

  const result = await bucket.upload(fileName, bytes, {
    upsert: true,
    contentType: logo.type,
  });

  if (!result.error) {
    return bucket.getPublicUrl(fileName).data.publicUrl;
  }

  throw result.error;
}

async function getLogoName(fileName: string, organizationId: number) {
  const { nanoid } = await import('nanoid');
  const uniqueId = nanoid(16);
  const extension = fileName.split('.').pop();

  return `${organizationId}.${extension}?v=${uniqueId}`;
}

function deleteLogo(client: SupabaseClient, url: string) {
  const bucket = client.storage.from('logos');
  const fileName = url.split('/').pop()?.split('?')[0];

  if (!fileName) {
    return Promise.reject(new Error('Invalid file name'));
  }

  return bucket.remove([fileName]);
}

export default UpdateOrganizationForm;
