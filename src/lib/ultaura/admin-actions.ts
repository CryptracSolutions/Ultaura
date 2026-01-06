'use server';

import type { SupabaseClient } from '@supabase/supabase-js';

import GlobalRole from '~/core/session/types/global-role';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import requireSession from '~/lib/user/require-session';
import type { Database } from '~/database.types';
import type { DebugLog } from './admin-types';

type Filters = {
  startDate?: string;
  endDate?: string;
  callSessionId?: string;
  eventType?: string;
  toolName?: string;
  accountId?: string;
  limit?: number;
  offset?: number;
};

function isUserAdmin(user: { email?: string | null; app_metadata?: { role?: string } }) {
  const email = user.email ?? '';
  const isUltauraAdmin = email.endsWith('@ultaura.com');
  const isSuperAdmin = user.app_metadata?.role === GlobalRole.SuperAdmin;
  return isUltauraAdmin || isSuperAdmin;
}

function normalizeDateStart(value: string) {
  if (value.includes('T')) return value;
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function normalizeDateEnd(value: string) {
  if (value.includes('T')) return value;
  return new Date(`${value}T23:59:59.999Z`).toISOString();
}

export async function isUltauraAdmin(): Promise<boolean> {
  const client = getSupabaseServerActionClient();
  const session = await requireSession(client);

  return isUserAdmin(session.user);
}

export async function getDebugLogs(
  filters: Filters
): Promise<{ data: DebugLog[]; count: number }> {
  const client = getSupabaseServerActionClient();
  const session = await requireSession(client);

  if (!isUserAdmin(session.user)) {
    throw new Error('Unauthorized');
  }

  // Use admin client to bypass RLS since we've already verified the user is an admin
  const adminClient = getSupabaseServerActionClient({ admin: true }) as SupabaseClient<any>;

  let query = adminClient
    .from('ultaura_debug_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters.startDate) {
    query = query.gte('created_at', normalizeDateStart(filters.startDate));
  }
  if (filters.endDate) {
    query = query.lte('created_at', normalizeDateEnd(filters.endDate));
  }
  if (filters.callSessionId) {
    query = query.eq('call_session_id', filters.callSessionId);
  }
  if (filters.eventType) {
    query = query.eq('event_type', filters.eventType);
  }
  if (filters.toolName) {
    query = query.eq('tool_name', filters.toolName);
  }
  if (filters.accountId) {
    query = query.eq('account_id', filters.accountId);
  }

  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? 50;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  return { data: (data as DebugLog[]) || [], count: count || 0 };
}
