'use client';

import { useCallback, useContext, useMemo, useRef, useState } from 'react';

import UserSessionContext from '~/core/session/contexts/user-session';
import useUserSession from '~/core/hooks/use-user-session';
import UserData from '~/core/session/types/user-data';
import Trans from '~/core/ui/Trans';
import If from '~/core/ui/If';

import UpdatePhoneNumberForm from '../components/UpdatePhoneNumberForm';
import SettingsTile from '../../components/SettingsTile';
import UpdateProfileForm from '../components/UpdateProfileForm';
import ProfileDangerZone from '../components/ProfileDangerZone';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { useLeavePageGuard } from '~/core/hooks/use-leave-page-guard';

import { refreshSessionAction } from '../actions';

import configuration from '~/configuration';

const allowAccountDeletion = configuration.features.enableAccountDeletion;
const allowPhoneNumberUpdate = configuration.auth.providers.phoneNumber;

function UpdateProfileFormContainer() {
  const { userSession, setUserSession } = useContext(UserSessionContext);
  const session = useUserSession();
  const resetHandlers = useRef<{ profile?: () => void; phone?: () => void }>({});
  const [dirtyState, setDirtyState] = useState({ profile: false, phone: false });

  const onUpdateProfileData = useCallback(
    async (data: Partial<UserData>) => {
      const userRecordData = userSession?.data;

      if (userRecordData) {
        setUserSession({
          ...userSession,
          data: {
            ...userRecordData,
            ...data,
          },
        });
      }

      await refreshSessionAction();
    },
    [setUserSession, userSession],
  );

  const hasChanges = useMemo(
    () => Object.values(dirtyState).some(Boolean),
    [dirtyState]
  );

  const registerReset = useCallback((key: 'profile' | 'phone', handler: () => void) => {
    resetHandlers.current[key] = handler;
  }, []);

  const updateDirtyState = useCallback((key: 'profile' | 'phone', dirty: boolean) => {
    setDirtyState((prev) => (prev[key] === dirty ? prev : { ...prev, [key]: dirty }));
  }, []);

  const discardAllChanges = useCallback(() => {
    Object.values(resetHandlers.current).forEach((handler) => handler?.());
  }, []);

  const shouldWarnOnNavigate = hasChanges;
  const { dialogProps } = useLeavePageGuard({
    isDirty: shouldWarnOnNavigate,
    onDiscard: discardAllChanges,
  });

  if (!session) {
    return null;
  }

  return (
    <div className={'flex flex-col space-y-8 pb-12'}>
      <SettingsTile
        heading={<Trans i18nKey={'profile:generalTab'} />}
        subHeading={<Trans i18nKey={'profile:generalTabSubheading'} />}
      >
        <UpdateProfileForm
          session={session}
          onUpdateProfileData={onUpdateProfileData}
          onDirtyChange={(dirty) => updateDirtyState('profile', dirty)}
          onRegisterReset={(handler) => registerReset('profile', handler)}
        />
      </SettingsTile>

      <If condition={allowPhoneNumberUpdate}>
        <SettingsTile
          heading={<Trans i18nKey={'profile:updatePhoneNumber'} />}
          subHeading={<Trans i18nKey={'profile:updatePhoneNumberSubheading'} />}
        >
          <UpdatePhoneNumberForm
            session={session}
            onUpdate={async () => {
              await refreshSessionAction();
            }}
            onDirtyChange={(dirty) => updateDirtyState('phone', dirty)}
            onRegisterReset={(handler) => registerReset('phone', handler)}
          />
        </SettingsTile>
      </If>

      <If condition={allowAccountDeletion}>
        <SettingsTile
          heading={<Trans i18nKey={'profile:dangerZone'} />}
          subHeading={<Trans i18nKey={'profile:dangerZoneSubheading'} />}
        >
          <ProfileDangerZone />
        </SettingsTile>
      </If>

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
}

export default UpdateProfileFormContainer;
