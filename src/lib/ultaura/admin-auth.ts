import type { User } from '@supabase/supabase-js';

import GlobalRole from '~/core/session/types/global-role';

export function hasSuperAdminRole(user: Pick<User, 'app_metadata'> | null | undefined) {
  return user?.app_metadata?.role === GlobalRole.SuperAdmin;
}
