import useSWRMutation from 'swr/mutation';
import useSupabase from './use-supabase';
import configuration from '~/configuration';

interface Credentials {
  email: string;
  password: string;
  inviteCode?: string;
  next?: string;
}

/**
 * @name useSignUpWithEmailAndPassword
 */
function useSignUpWithEmailAndPassword() {
  const client = useSupabase();
  const key = ['auth', 'sign-up-with-email-password'];

  return useSWRMutation(
    key,
    (_, { arg: credentials }: { arg: Credentials }) => {
      const emailRedirectTo = getRedirectUrl({
        inviteCode: credentials.inviteCode,
        next: credentials.next,
      });

      return client.auth
        .signUp({
          ...credentials,
          options: {
            emailRedirectTo,
          },
        })
        .then((response) => {
          if (response.error) {
            throw response.error.message;
          }

          const user = response.data?.user;
          const identities = user?.identities ?? [];

          // if the user has no identities, it means that the email is taken
          if (identities.length === 0) {
            throw new Error('User already registered');
          }

          return response.data;
        });
    },
  );
}

export default useSignUpWithEmailAndPassword;

function getRedirectUrl(params: { inviteCode?: string; next?: string }) {
  const safeNext = getSafeNextPath(params.next);
  const confirmedParams = new URLSearchParams();
  confirmedParams.set('next', safeNext);

  if (params.inviteCode) {
    confirmedParams.set('inviteCode', params.inviteCode);
  }

  const confirmedPath = `/auth/confirmed?${confirmedParams.toString()}`;
  const callbackPath = configuration.paths.authCallback;
  const callbackParams = new URLSearchParams();
  callbackParams.set('next', confirmedPath);

  const fullPath = `${callbackPath}?${callbackParams.toString()}`;

  return new URL(fullPath, window.location.origin).href;
}

function getSafeNextPath(value?: string) {
  if (!value) {
    return configuration.paths.onboarding;
  }

  if (!value.startsWith('/') || value.startsWith('//')) {
    return configuration.paths.onboarding;
  }

  return value;
}
