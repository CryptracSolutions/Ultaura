import 'server-only';

import { headers } from 'next/headers';

import getSupabaseServerActionClient from '~/core/supabase/action-client';
import getLogger from '~/core/logger';

interface AuditLogEntry {
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
}

interface AdminContext {
  userId: string;
  email: string;
}

export async function writeAdminAuditLog(
  admin: AdminContext,
  entry: AuditLogEntry,
) {
  const logger = getLogger();
  const client = getSupabaseServerActionClient({ admin: true });

  let ip: string | null = null;
  let userAgent: string | null = null;

  try {
    const hdrs = headers();
    ip =
      hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      hdrs.get('x-real-ip') ||
      null;
    userAgent = hdrs.get('user-agent') || null;
  } catch {
    // headers() may not be available in all contexts
  }

  const { error } = await client.from('ultaura_admin_audit_log' as any).insert({
    admin_user_id: admin.userId,
    admin_email: admin.email,
    action: entry.action,
    target_type: entry.targetType ?? null,
    target_id: entry.targetId ?? null,
    metadata: entry.metadata ?? null,
    request_id: entry.requestId ?? null,
    ip,
    user_agent: userAgent,
  });

  if (error) {
    logger.error(
      { error, action: entry.action },
      'Failed to write admin audit log',
    );
  }
}

export async function getCurrentAdminContext(): Promise<AdminContext | null> {
  const client = getSupabaseServerActionClient();
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return {
    userId: data.user.id,
    email: data.user.email ?? 'unknown',
  };
}

export async function getRecentAuditLogs(limit = 50, offset = 0) {
  const client = getSupabaseServerActionClient({ admin: true });

  const { data, error, count } = await client
    .from('ultaura_admin_audit_log' as any)
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  return { logs: data ?? [], count: count ?? 0 };
}

export async function getAuditLogsByTarget(
  targetType: string,
  targetId: string,
  limit = 20,
) {
  const client = getSupabaseServerActionClient({ admin: true });

  const { data, error } = await client
    .from('ultaura_admin_audit_log' as any)
    .select('*')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
}
