import { useCallback } from 'react';

import useSupabase from '~/core/hooks/use-supabase';
import { signOutAction } from '~/lib/ultaura/auth-actions';

function useSignOut() {
  const client = useSupabase();

  return useCallback(async () => {
    await signOutAction();
    await client.auth.signOut();
  }, [client.auth]);
}

export default useSignOut;
