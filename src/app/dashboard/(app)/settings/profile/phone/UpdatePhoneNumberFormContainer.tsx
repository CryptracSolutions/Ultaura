'use client';

import useUserSession from '~/core/hooks/use-user-session';
import UpdatePhoneNumberForm from '../components/UpdatePhoneNumberForm';
import { refreshSessionAction } from '../actions';

function UpdatePhoneNumberFormContainer() {
  const session = useUserSession();

  if (!session) {
    return null;
  }

  return (
    <UpdatePhoneNumberForm
      session={session}
      onUpdate={() => refreshSessionAction()}
    />
  );
}

export default UpdatePhoneNumberFormContainer;
