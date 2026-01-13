import useSWR from 'swr';

import useSupabase from '~/core/hooks/use-supabase';
import useCurrentOrganization from '~/lib/organizations/hooks/use-current-organization';
import type { UltauraAccountRow } from '~/lib/ultaura/types';

export default function useUltauraAccount() {
  const client = useSupabase();
  const organization = useCurrentOrganization();

  const key = organization?.id ? ['ultaura-account', organization.id] : null;

  return useSWR<UltauraAccountRow | null>(key, async () => {
    if (!organization?.id) {
      return null;
    }

    const { data, error } = await client
      .from('ultaura_accounts')
      .select('*')
      .eq('organization_id', organization.id)
      .maybeSingle();

    if (error) {
      console.error('[Ultaura] Failed to fetch account', error);
      return null;
    }

    return data;
  });
}
