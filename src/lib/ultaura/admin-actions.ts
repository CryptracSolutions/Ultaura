'use server';

import type { SupabaseClient } from '@supabase/supabase-js';

import getSupabaseServerActionClient from '~/core/supabase/action-client';
import getLogger from '~/core/logger';
import requireSession from '~/lib/user/require-session';
import isUserSuperAdmin from '~/app/admin/utils/is-user-super-admin';
import type { Database } from '~/database.types';
import type { DebugLog } from './admin-types';
import { decodeBytea } from './bytea';
import { decryptDebugPayload } from './debug-log-decrypt';
import { writeAdminAuditLog } from './admin/audit-log';

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

type DebugLogRow = Database['public']['Tables']['ultaura_debug_logs']['Row'];

const logger = getLogger();

function stripCipherFields(log: DebugLogRow) {
  const {
    payload_ciphertext: _ciphertext,
    payload_iv: _iv,
    payload_tag: _tag,
    payload_alg: _alg,
    payload_kid: _kid,
    ...rest
  } = log;

  return rest;
}

function coerceJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function normalizeLogFields(log: ReturnType<typeof stripCipherFields>) {
  const payloadSummary = coerceJsonObject(log.payload_summary);
  const metadata = coerceJsonObject(log.metadata);
  const payload = coerceJsonObject(log.payload) ?? {};

  return {
    ...log,
    payload_summary: payloadSummary,
    metadata,
    payload,
  };
}

function formatDecryptFailure(log: DebugLogRow) {
  const normalizedLog = normalizeLogFields(stripCipherFields(log));

  return {
    ...normalizedLog,
    payload: { _error: 'Unable to decrypt debug payload' },
    payload_encrypted: true,
    payload_decrypt_failed: true,
  };
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
  return isUserSuperAdmin({
    client: getSupabaseServerActionClient(),
  });
}

export async function getDebugLogs(
  filters: Filters
): Promise<{ data: DebugLog[]; count: number }> {
  const client = getSupabaseServerActionClient();
  const session = await requireSession(client);

  const isAdmin = await isUserSuperAdmin({ client });

  if (!isAdmin) {
    throw new Error('Unauthorized');
  }

  // Use admin client to bypass RLS since we've already verified the user is an admin
  const adminClient = getSupabaseServerActionClient({
    admin: true,
  }) as SupabaseClient<any>;

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
  const limit = Math.min(filters.limit ?? 50, 200);
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  const decryptedLogs = await Promise.all(
    ((data as DebugLogRow[]) ?? []).map(async (log) => {
      const hasCiphertextFields = Boolean(
        log.payload_ciphertext || log.payload_iv || log.payload_tag
      );
      const ciphertext = decodeBytea(log.payload_ciphertext);
      const iv = decodeBytea(log.payload_iv);
      const tag = decodeBytea(log.payload_tag);
      const hasEncryptedPayload = Boolean(ciphertext && iv && tag);

      if (hasCiphertextFields && !hasEncryptedPayload) {
        logger.warn({
          debugLogId: log.id,
          accountId: log.account_id,
        }, 'Invalid debug log ciphertext format');

        return formatDecryptFailure(log);
      }

      if (hasEncryptedPayload && log.account_id && ciphertext && iv && tag) {
        const decrypted = await decryptDebugPayload(
          adminClient,
          log.account_id,
          log.call_session_id,
          log.id,
          {
            ciphertext,
            iv,
            tag,
          }
        );

        if (decrypted) {
          const normalizedLog = normalizeLogFields(stripCipherFields(log));
          return {
            ...normalizedLog,
            payload: decrypted,
            payload_encrypted: true,
            payload_decrypt_failed: false,
          };
        }

        return formatDecryptFailure(log);
      }

      const normalizedLog = normalizeLogFields(stripCipherFields(log));
      return {
        ...normalizedLog,
        payload_encrypted: hasEncryptedPayload,
        payload_decrypt_failed: hasEncryptedPayload,
      };
    })
  );

  const totalCount = count || 0;
  const encryptedCount = decryptedLogs.filter((log) =>
    Boolean(log.payload_encrypted),
  ).length;
  const decryptFailedCount = decryptedLogs.filter((log) =>
    Boolean(log.payload_decrypt_failed),
  ).length;

  try {
    await writeAdminAuditLog(
      {
        userId: session.user.id,
        email: session.user.email ?? 'unknown',
      },
      {
        action: 'admin.debug_logs.decrypt',
        targetType: 'debug_logs',
        metadata: {
          returnedCount: decryptedLogs.length,
          totalCount,
          encryptedCount,
          decryptFailedCount,
          filters: {
            startDate: filters.startDate ?? null,
            endDate: filters.endDate ?? null,
            callSessionId: filters.callSessionId ?? null,
            eventType: filters.eventType ?? null,
            toolName: filters.toolName ?? null,
            accountId: filters.accountId ?? null,
            limit,
            offset,
          },
        },
      }
    );
  } catch (auditError) {
    logger.warn(
      {
        error: auditError,
        adminUserId: session.user.id,
      },
      'Failed to write debug log decrypt audit entry'
    );
  }

  return { data: decryptedLogs, count: totalCount };
}
