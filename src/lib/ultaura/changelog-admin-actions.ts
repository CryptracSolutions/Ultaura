'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import getLogger from '~/core/logger';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import { writeAdminAuditLog } from '~/lib/ultaura/admin/audit-log';
import { hasSuperAdminRole } from '~/lib/ultaura/admin-auth';
import {
  CHANGELOG_CATEGORIES,
  ChangelogEmailRouteRequestSchema,
  type ChangelogEmailRouteResponse,
  type ChangelogEntry,
  mapChangelogRow,
  normalizeChangelogCategory,
  ULTAURA_CHANGELOG_TABLE,
} from '~/lib/ultaura/changelog-shared';
import { listChangelogEntries } from '~/lib/ultaura/changelog';

const logger = getLogger();
const INTERNAL_SECRET_HEADER = 'x-webhook-secret';

const changelogEntryInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2000),
  category: z.enum(CHANGELOG_CATEGORIES),
  sort_order: z.number().int().nullable().optional(),
});

const changelogEntryUpdateSchema = changelogEntryInputSchema.partial();

type AdminUser = {
  id: string;
  email?: string | null;
};

type AdminAuditEntry = Parameters<typeof writeAdminAuditLog>[1];

export interface ChangelogEntryInput {
  title: string;
  description: string;
  category: (typeof CHANGELOG_CATEGORIES)[number];
  sortOrder: number;
}

export async function getAllChangelogEntries() {
  const { adminClient, user } = await assertSuperAdmin();

  const { data, error } = await adminClient
    .from(ULTAURA_CHANGELOG_TABLE as any)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    logger.error({ error }, 'Failed to load changelog entries for admin');
    throw new Error('Failed to load changelog entries');
  }

  const entries = ((data as Array<Record<string, unknown>> | null) ?? []).map(mapChangelogRow);

  await safeWriteChangelogAuditLog(user, {
    action: 'changelog.entries.list',
    targetType: 'changelog_entry',
    metadata: { count: entries.length },
  });

  return entries.map(toAdminEntryCompat);
}

export async function createChangelogEntry(data: unknown) {
  const { adminClient, user } = await assertSuperAdmin();
  const parsed = changelogEntryInputSchema.safeParse(normalizeCreateInput(data));

  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid entry' };
  }

  const now = new Date().toISOString();
  const payload = {
    title: parsed.data.title,
    description: parsed.data.description,
    category: parsed.data.category,
    sort_order: parsed.data.sort_order ?? 0,
    published: false,
    published_at: null,
    publish_batch_id: null,
    email_sent: false,
    updated_at: now,
  };

  const { data: inserted, error } = await adminClient
    .from(ULTAURA_CHANGELOG_TABLE as any)
    .insert(payload)
    .select('*')
    .single();

  if (error || !inserted) {
    logger.error({ error }, 'Failed to create changelog entry');
    return { success: false as const, error: 'Failed to create changelog entry' };
  }

  const entry = mapChangelogRow(inserted as Record<string, unknown>);

  await safeWriteChangelogAuditLog(user, {
    action: 'changelog.entry.create',
    targetType: 'changelog_entry',
    targetId: entry.id,
    metadata: {
      title: entry.title,
      category: entry.category,
      sortOrder: entry.sortOrder,
    },
  });

  revalidateAppChangelogPaths();

  return { success: true as const, entry };
}

export async function updateChangelogEntry(id: string, data: unknown) {
  const { adminClient, user } = await assertSuperAdmin();
  const parsed = changelogEntryUpdateSchema.safeParse(normalizeUpdateInput(data));

  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid entry update' };
  }

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof parsed.data.title === 'string') {
    payload.title = parsed.data.title;
  }
  if (typeof parsed.data.description === 'string') {
    payload.description = parsed.data.description;
  }
  if (parsed.data.category) {
    payload.category = parsed.data.category;
  }
  if ('sort_order' in parsed.data) {
    payload.sort_order = parsed.data.sort_order ?? 0;
  }

  const updatedColumns = Object.keys(payload);
  if (updatedColumns.length === 1) {
    return { success: false as const, error: 'No changes provided' };
  }

  const { data: updated, error } = await adminClient
    .from(ULTAURA_CHANGELOG_TABLE as any)
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !updated) {
    logger.error({ error, id }, 'Failed to update changelog entry');
    return { success: false as const, error: 'Failed to update changelog entry' };
  }

  const entry = mapChangelogRow(updated as Record<string, unknown>);

  await safeWriteChangelogAuditLog(user, {
    action: 'changelog.entry.update',
    targetType: 'changelog_entry',
    targetId: entry.id,
    metadata: {
          title: entry.title,
          category: entry.category,
          changedFields: updatedColumns,
        },
      });

  revalidateAppChangelogPaths();

  return { success: true as const, entry };
}

export async function deleteChangelogEntry(id: string) {
  const { adminClient, user } = await assertSuperAdmin();

  const { data: deleted, error } = await adminClient
    .from(ULTAURA_CHANGELOG_TABLE as any)
    .delete()
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    logger.error({ error, id }, 'Failed to delete changelog entry');
    return { success: false as const, error: 'Failed to delete changelog entry' };
  }

  const deletedEntry = deleted ? mapChangelogRow(deleted as Record<string, unknown>) : null;

  await safeWriteChangelogAuditLog(user, {
    action: 'changelog.entry.delete',
    targetType: 'changelog_entry',
    targetId: id,
    metadata: deletedEntry
      ? {
          title: deletedEntry.title,
          category: deletedEntry.category,
          published: deletedEntry.published,
          emailSent: deletedEntry.emailSent,
        }
      : undefined,
  });

  revalidateAppChangelogPaths();

  return { success: true as const };
}

export async function publishAndSendChangelog(entryIds?: string[]) {
  const { adminClient, user } = await assertSuperAdmin();
  const requestedIds = dedupeNonEmptyStrings(entryIds ?? []);

  let drafts: ChangelogEntry[] = [];

  if (requestedIds.length > 0) {
    drafts = await listChangelogEntries(adminClient as any, {
      ids: requestedIds,
      published: false,
      limit: null,
    });
  } else {
    const { data, error } = await adminClient
      .from(ULTAURA_CHANGELOG_TABLE as any)
      .select('*')
      .eq('published', false)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error({ error }, 'Failed to load draft changelog entries');
      return {
        success: false as const,
        publishedCount: 0,
        batchId: null,
        email: null,
        error: 'Failed to load draft changelog entries',
      };
    }

    drafts = ((data as Array<Record<string, unknown>> | null) ?? []).map(mapChangelogRow);
  }

  const draftIds = drafts.map((entry) => entry.id).filter(Boolean);

  if (draftIds.length === 0) {
    await safeWriteChangelogAuditLog(user, {
      action: 'changelog.publish',
      targetType: 'changelog_batch',
      metadata: { noDrafts: true },
    });

    return {
      success: false as const,
      publishedCount: 0,
      batchId: null,
      email: null,
      error: 'No draft changelog entries to publish',
    };
  }

  const batchId = randomUUID();
  const now = new Date().toISOString();

  const { error: publishError } = await adminClient
    .from(ULTAURA_CHANGELOG_TABLE as any)
    .update({
      published: true,
      published_at: now,
      publish_batch_id: batchId,
      updated_at: now,
    })
    .in('id', draftIds)
    .eq('published', false);

  if (publishError) {
    logger.error({ error: publishError, draftIds, batchId }, 'Failed to publish changelog drafts');

    await safeWriteChangelogAuditLog(user, {
      action: 'changelog.publish',
      targetType: 'changelog_batch',
      targetId: batchId,
      metadata: {
        publishedCount: 0,
        attemptedCount: draftIds.length,
        publishError: true,
      },
    });

    return {
      success: false as const,
      publishedCount: 0,
      batchId,
      email: null,
      error: 'Failed to publish changelog drafts',
    };
  }

  const routeCall = await callInternalChangelogEmailRoute({ batchId, entryIds: draftIds });
  const emailSummary = buildChangelogEmailSummary(routeCall.response);

  let emailMarkedSent = false;
  let finalError = routeCall.error;

  const fullEmailSuccess = didChangelogEmailRouteFullySucceed(routeCall.response);

  if (fullEmailSuccess) {
    const { error: markError } = await adminClient
      .from(ULTAURA_CHANGELOG_TABLE as any)
      .update({ email_sent: true, updated_at: new Date().toISOString() })
      .in('id', draftIds)
      .eq('publish_batch_id', batchId)
      .eq('published', true);

    if (markError) {
      logger.error({ error: markError, batchId, draftIds }, 'Failed to mark changelog email_sent=true');
      finalError = 'Emails sent, but failed to mark entries as emailed';
    } else {
      emailMarkedSent = true;
    }
  } else if (!finalError) {
    finalError = 'Some changelog emails failed to send';
  }

  await safeWriteChangelogAuditLog(user, {
    action: 'changelog.publish',
    targetType: 'changelog_batch',
    targetId: batchId,
    metadata: {
      publishedCount: draftIds.length,
      entryIds: draftIds,
      emailMarkedSent,
      routeStatus: routeCall.status,
      email: emailSummary,
      routeSuccess: routeCall.response?.success ?? false,
      error: finalError,
    },
  });

  revalidateAppChangelogPaths();

  return {
    success: fullEmailSuccess && emailMarkedSent,
    publishedCount: draftIds.length,
    batchId,
    email: emailSummary,
    error: finalError ?? undefined,
  };
}

export async function resendChangelogEmails(options?: { batchId?: string | null }) {
  const { adminClient, user } = await assertSuperAdmin();
  const requestedBatchId = options?.batchId?.trim() || null;

  let targetBatchId = requestedBatchId;
  let batchEntries: ChangelogEntry[] = [];

  if (targetBatchId) {
    batchEntries = (
      await listChangelogEntries(adminClient as any, {
        published: true,
        publishBatchId: targetBatchId,
        limit: null,
      })
    ).filter((entry) => !entry.emailSent && entry.publishBatchId === targetBatchId);
  } else {
    const publishedEntries = await listChangelogEntries(adminClient as any, {
      published: true,
      limit: null,
    });

    const unsentPublishedEntries = publishedEntries.filter(
      (entry) => entry.published && !entry.emailSent && Boolean(entry.publishBatchId),
    );

    targetBatchId = unsentPublishedEntries[0]?.publishBatchId ?? null;
    batchEntries = targetBatchId
      ? unsentPublishedEntries.filter((entry) => entry.publishBatchId === targetBatchId)
      : [];
  }

  const batchId = targetBatchId;
  const entryBatchIds = dedupeNonEmptyStrings(batchEntries.map((entry) => entry.id));

  if (!batchId || entryBatchIds.length === 0) {
    await safeWriteChangelogAuditLog(user, {
      action: 'changelog.email.resend',
      targetType: 'changelog_batch',
      targetId: requestedBatchId ?? undefined,
      metadata: {
        requestedBatchId,
        resolvedBatchId: batchId,
        noUnsentEntries: true,
      },
    });

    return {
      success: false as const,
      batchId,
      entryCount: 0,
      email: null,
      error: requestedBatchId
        ? 'No published unsent changelog entries found for the requested batch'
        : 'No published unsent changelog batches found',
    };
  }

  const routeCall = await callInternalChangelogEmailRoute({ batchId, entryIds: entryBatchIds });
  const emailSummary = buildChangelogEmailSummary(routeCall.response);

  let emailMarkedSent = false;
  let finalError = routeCall.error;

  const fullEmailSuccess = didChangelogEmailRouteFullySucceed(routeCall.response);

  if (fullEmailSuccess) {
    const { error: markError } = await adminClient
      .from(ULTAURA_CHANGELOG_TABLE as any)
      .update({ email_sent: true, updated_at: new Date().toISOString() })
      .in('id', entryBatchIds)
      .eq('publish_batch_id', batchId)
      .eq('published', true)
      .eq('email_sent', false);

    if (markError) {
      logger.error(
        { error: markError, batchId, entryIds: entryBatchIds },
        'Failed to mark retried changelog email_sent=true',
      );
      finalError = 'Emails sent, but failed to mark entries as emailed';
    } else {
      emailMarkedSent = true;
    }
  } else if (!finalError) {
    finalError = 'Some changelog emails failed to send';
  }

  await safeWriteChangelogAuditLog(user, {
    action: 'changelog.email.resend',
    targetType: 'changelog_batch',
    targetId: batchId,
    metadata: {
      requestedBatchId,
      entryCount: entryBatchIds.length,
      entryIds: entryBatchIds,
      emailMarkedSent,
      routeStatus: routeCall.status,
      email: emailSummary,
      routeSuccess: routeCall.response?.success ?? false,
      error: finalError,
    },
  });

  revalidateAppChangelogPaths();

  return {
    success: fullEmailSuccess && emailMarkedSent,
    batchId,
    entryCount: entryBatchIds.length,
    email: emailSummary,
    error: finalError ?? undefined,
  };
}

export async function retryLatestUnsentChangelogEmail() {
  return resendChangelogEmails();
}

export async function create(input: unknown) {
  const result = await createChangelogEntry(input);

  if (!result.success) {
    return { success: false as const, error: result.error };
  }

  return {
    success: true as const,
    data: toAdminEntryCompat(result.entry),
    message: 'Changelog entry created.',
  };
}

export async function update(input: { id: string } & Record<string, unknown>) {
  const { id, ...changes } = input;
  const result = await updateChangelogEntry(id, changes);

  if (!result.success) {
    return { success: false as const, error: result.error };
  }

  return {
    success: true as const,
    data: toAdminEntryCompat(result.entry),
    message: 'Changelog entry updated.',
  };
}

async function deleteChangelogAlias(input: { id: string }) {
  const result = await deleteChangelogEntry(input.id);

  if (!result.success) {
    return { success: false as const, error: result.error };
  }

  return {
    success: true as const,
    message: 'Changelog entry deleted.',
  };
}

export { deleteChangelogAlias as remove };

async function assertSuperAdmin() {
  const actionClient = getSupabaseServerActionClient();
  const { data, error } = await actionClient.auth.getUser();
  const user = data?.user ?? null;

  if (error || !user || !hasSuperAdminRole(user)) {
    throw new Error('Unauthorized');
  }

  return {
    user: user as AdminUser,
    adminClient: getSupabaseServerActionClient({ admin: true }),
  };
}

async function safeWriteChangelogAuditLog(user: AdminUser, entry: AdminAuditEntry) {
  try {
    await writeAdminAuditLog(
      {
        userId: user.id,
        email: user.email ?? 'unknown',
      },
      entry,
    );
  } catch (error) {
    logger.warn(
      {
        error,
        action: entry.action,
        targetId: entry.targetId,
      },
      'Failed to write changelog admin audit log',
    );
  }
}

async function callInternalChangelogEmailRoute(payload: { batchId: string; entryIds: string[] }) {
  const secret = process.env.ULTAURA_INTERNAL_API_SECRET;
  if (!secret) {
    return {
      status: null as number | null,
      response: null as ChangelogEmailRouteResponse | null,
      error: 'ULTAURA_INTERNAL_API_SECRET is not configured',
    };
  }

  const requestBody = ChangelogEmailRouteRequestSchema.parse(payload);

  try {
    const response = await fetch(`${getAppBaseUrl()}/api/internal/changelog-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [INTERNAL_SECRET_HEADER]: secret,
      },
      body: JSON.stringify(requestBody),
      cache: 'no-store',
    });

    const parsed = await response.json().catch(() => null);

    const routeResponse = isChangelogEmailRouteResponse(parsed) ? parsed : null;

    if (!routeResponse) {
      return {
        status: response.status,
        response: null,
        error: response.ok ? 'Invalid changelog email response' : 'Internal changelog email route failed',
      };
    }

    return {
      status: response.status,
      response: routeResponse,
      error: routeResponse.success ? null : routeResponse.error ?? 'Some changelog emails failed to send',
    };
  } catch (error) {
    logger.error({ error, payload }, 'Failed to call internal changelog email route');
    return {
      status: null,
      response: null,
      error: 'Failed to call internal changelog email route',
    };
  }
}

function isChangelogEmailRouteResponse(value: unknown): value is ChangelogEmailRouteResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.success === 'boolean';
}

function buildChangelogEmailSummary(response: ChangelogEmailRouteResponse | null) {
  if (!response) {
    return null;
  }

  return {
    attempted: response.recipientsAttempted ?? 0,
    sent: response.recipientsSent ?? 0,
    failed: response.recipientsFailed ?? 0,
    dedupedFrom: response.dedupedFrom ?? 0,
  };
}

function didChangelogEmailRouteFullySucceed(response: ChangelogEmailRouteResponse | null) {
  return response?.success === true && (response.recipientsFailed ?? 0) === 0;
}

function normalizeCreateInput(input: unknown) {
  const record = asRecord(input);
  return {
    title: getString(record?.title) ?? '',
    description: getString(record?.description) ?? getString(record?.summary) ?? '',
    category: normalizeChangelogCategory(record?.category),
    sort_order: getNullableInteger(record?.sort_order ?? record?.sortOrder),
  };
}

function normalizeUpdateInput(input: unknown) {
  const record = asRecord(input);
  if (!record) {
    return {};
  }

  const result: Record<string, unknown> = {};

  if ('title' in record) {
    result.title = getString(record.title) ?? '';
  }

  if ('description' in record || 'summary' in record) {
    result.description = getString(record.description) ?? getString(record.summary) ?? '';
  }

  if ('category' in record) {
    result.category = normalizeChangelogCategory(record.category);
  }

  if ('sort_order' in record || 'sortOrder' in record) {
    result.sort_order = getNullableInteger(record.sort_order ?? record.sortOrder);
  }

  return result;
}

function toAdminEntryCompat(entry: ChangelogEntry) {
  return {
    id: entry.id,
    title: entry.title,
    description: entry.description,
    category: entry.category,
    sort_order: entry.sortOrder,
    sortOrder: entry.sortOrder,
    published: entry.published,
    status: entry.published ? 'published' : 'draft',
    published_at: entry.publishedAt,
    publishedAt: entry.publishedAt,
    publish_batch_id: entry.publishBatchId,
    publishBatchId: entry.publishBatchId,
    email_sent: entry.emailSent,
    emailSent: entry.emailSent,
    email_sent_at: null,
    emailSentAt: null,
    created_at: entry.createdAt,
    createdAt: entry.createdAt,
    updated_at: entry.updatedAt,
    updatedAt: entry.updatedAt,
  };
}

function dedupeNonEmptyStrings(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
}

function getString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function getNullableInteger(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function getAppBaseUrl() {
  const candidate =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'http://localhost:3000';

  return candidate.replace(/\/$/, '');
}

function revalidateAppChangelogPaths() {
  revalidatePath('/admin/changelog');
  revalidatePath('/dashboard', 'page');
}
