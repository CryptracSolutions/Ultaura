import useSWR from 'swr';
import useSupabase from '~/core/hooks/use-supabase';

/**
 * @name useUser
 */
function useUser() {
  const client = useSupabase();
  const key = 'user';

  return useSWR([key], async () => {
    try {
      const result = await client.auth.getUser();

      if (result.error) {
        return null;
      }

      return result.data.user ?? null;
    } catch {
      return null;
    }
  });
}

export default useUser;
