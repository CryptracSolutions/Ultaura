import type { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '~/database.types';

interface Params {
  organizationName: string;
  userId: string;
  client: SupabaseClient<Database>;
  adminClient: SupabaseClient<Database>;
}

/**
 * @name completeOnboarding
 * @description Handles the submission of the onboarding flow. By default,
 * we use the submission to create the Organization and the user record
 * associated with the User who signed up using its ID
 * @param organizationName
 * @param userId
 * @param client
 * @param adminClient
 */
async function completeOnboarding({ organizationName, userId, client, adminClient }: Params) {
  // Check if user already exists to avoid duplicate key error (use adminClient to bypass RLS)
  const { data: existingUser } = await adminClient
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  return client
    .rpc('create_new_organization', {
      org_name: organizationName,
      create_user: !existingUser, // Don't create user if they already exist
    })
    .single<string>();
}

export default completeOnboarding;
