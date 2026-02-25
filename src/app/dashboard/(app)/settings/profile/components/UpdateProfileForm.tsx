import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import Link from 'next/link';

import type { SupabaseClient } from '@supabase/supabase-js';

import useUpdateProfileMutation from '~/lib/user/hooks/use-update-profile';

import TextField from '~/core/ui/TextField';
import Trans from '~/core/ui/Trans';
import useSupabase from '~/core/hooks/use-supabase';

import type UserSession from '~/core/session/types/user-session';
import type UserData from '~/core/session/types/user-data';

import configuration from '~/configuration';
import ImageUploader from '~/core/ui/ImageUploader';
import { USERS_TABLE } from '~/lib/db-tables';
import { useAutoSave } from '~/core/hooks/use-auto-save';

const AVATARS_BUCKET = 'avatars';

function UpdateProfileForm({
  session,
  onUpdateProfileData,
}: {
  session: UserSession;
  onUpdateProfileData: (user: Partial<UserData>) => void;
}) {
  const updateProfileMutation = useUpdateProfileMutation();
  const { t } = useTranslation();

  const currentPhotoURL = session.data?.photoUrl ?? '';
  const currentDisplayName = session?.data?.displayName ?? '';

  const user = session.auth?.user;
  const email = user?.email ?? '';

  const { register, reset, watch } = useForm({
    defaultValues: {
      displayName: currentDisplayName,
    },
  });

  const autoSave = useAutoSave<string>({
    saveFn: async (displayName: string) => {
      if (!user?.id) return { success: false, error: 'Not authenticated' };
      try {
        await updateProfileMutation.trigger({ id: user.id, displayName });
        onUpdateProfileData({ id: user.id, displayName });
        return { success: true };
      } catch {
        return { success: false, error: t('profile:updateProfileError') };
      }
    },
    toastSuccess: t('profile:updateProfileSuccess'),
  });

  const displayNameControl = register('displayName', {
    value: currentDisplayName,
    maxLength: 100,
    minLength: 2,
  });

  const watchedDisplayName = watch('displayName');
  const prevRef = useRef(currentDisplayName);

  useEffect(() => {
    if (watchedDisplayName !== prevRef.current && watchedDisplayName.length >= 2) {
      prevRef.current = watchedDisplayName;
      autoSave.triggerSave(watchedDisplayName);
    }
  }, [watchedDisplayName, autoSave.triggerSave]);

  useEffect(() => {
    prevRef.current = currentDisplayName;
    reset({ displayName: currentDisplayName ?? '' });
  }, [currentDisplayName, currentPhotoURL, reset]);

  return (
    <div className={'flex flex-col space-y-8'}>
      <UploadProfileAvatarForm
        currentPhotoURL={currentPhotoURL}
        userId={user?.id}
        onAvatarUpdated={(photoUrl) => onUpdateProfileData({ photoUrl })}
      />

      <div
        data-cy={'update-profile-form'}
        className={'flex flex-col space-y-4'}
      >
        <TextField>
          <TextField.Label>
            <Trans i18nKey={'profile:displayNameLabel'} />

            <TextField.Input
              {...displayNameControl}
              data-cy={'profile-display-name'}
              minLength={2}
              placeholder={''}
              maxLength={100}
            />
          </TextField.Label>
        </TextField>

        <TextField>
          <TextField.Label>
            <Trans i18nKey={'profile:emailLabel'} />

            <TextField.Input disabled value={email} />
          </TextField.Label>

          <p className={'text-xs text-muted-foreground'}>
            <Trans i18nKey={'profile:updateEmailFromEmailTabHintPrefix'} />{' '}
            <Link
              href={'../' + configuration.paths.settings.email}
              className={'font-medium text-primary hover:underline'}
            >
              <Trans i18nKey={'profile:updateEmailFromEmailTabHintLinkLabel'} />
            </Link>
          </p>
        </TextField>
      </div>
    </div>
  );
}

function UploadProfileAvatarForm(props: {
  currentPhotoURL: string | null;
  userId: string;
  onAvatarUpdated: (url: string | null) => void;
}) {
  const client = useSupabase();
  const { t } = useTranslation('profile');

  const createToaster = useCallback(
    (promise: Promise<unknown>) => {
      return toast.promise(promise, {
        success: t(`updateProfileSuccess`),
        error: t(`updateProfileError`),
        loading: t(`updateProfileLoading`),
      });
    },
    [t],
  );

  const onValueChange = useCallback(
    async (file: File | null) => {
      const removeExistingStorageFile = () => {
        if (props.currentPhotoURL) {
          return (
            deleteProfilePhoto(client, props.currentPhotoURL) ??
            Promise.resolve()
          );
        }

        return Promise.resolve();
      };

      if (file) {
        const promise = removeExistingStorageFile().then(() =>
          uploadUserProfilePhoto(client, file, props.userId).then(
            (photoUrl) => {
              props.onAvatarUpdated(photoUrl);

              return client
                .from(USERS_TABLE)
                .update({
                  photo_url: photoUrl,
                })
                .eq('id', props.userId)
                .throwOnError();
            },
          ),
        );

        createToaster(promise);
      } else {
        const promise = removeExistingStorageFile().then(() => {
          props.onAvatarUpdated(null);

          return client
            .from(USERS_TABLE)
            .update({
              photo_url: null,
            })
            .eq('id', props.userId)
            .throwOnError();
        });

        createToaster(promise);
      }
    },
    [client, createToaster, props],
  );

  return (
    <ImageUploader value={props.currentPhotoURL} onValueChange={onValueChange}>
      <div className={'flex flex-col space-y-1'}>
        <span className={'text-sm'}>
          <Trans i18nKey={'profile:profilePictureHeading'} />
        </span>

        <span className={'text-xs'}>
          <Trans i18nKey={'profile:profilePictureSubheading'} />
        </span>
      </div>
    </ImageUploader>
  );
}

async function uploadUserProfilePhoto(
  client: SupabaseClient,
  photoFile: File,
  userId: string,
) {
  const bytes = await photoFile.arrayBuffer();
  const bucket = client.storage.from(AVATARS_BUCKET);
  const extension = photoFile.name.split('.').pop();
  const fileName = await getAvatarFileName(userId, extension);

  const result = await bucket.upload(fileName, bytes, {
    upsert: true,
  });

  if (!result.error) {
    return bucket.getPublicUrl(fileName).data.publicUrl;
  }

  throw result.error;
}

function deleteProfilePhoto(client: SupabaseClient, url: string) {
  const bucket = client.storage.from(AVATARS_BUCKET);
  const fileName = url.split('/').pop()?.split('?')[0];

  if (!fileName) {
    return;
  }

  return bucket.remove([fileName]);
}

async function getAvatarFileName(
  userId: string,
  extension: string | undefined,
) {
  const { nanoid } = await import('nanoid');
  const uniqueId = nanoid(16);

  return `${userId}.${extension}?v=${uniqueId}`;
}

export default UpdateProfileForm;
