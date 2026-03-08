import useMutation from 'swr/mutation';

import useSupabase from './use-supabase';

function useResendSignupConfirmation() {
  const client = useSupabase();

  return useMutation(
    ['auth', 'resend-signup-confirmation'],
    async (_, { arg }: { arg: { email: string } }) => {
      const { data, error } = await client.auth.resend({
        email: arg.email,
        type: 'signup',
      });

      if (error) {
        throw error;
      }

      return data;
    },
  );
}

export default useResendSignupConfirmation;
