'use server';

import { createError, ErrorCodes, type ActionResult } from '@ultaura/schemas';
import { revalidatePath } from 'next/cache';

import getLogger from '~/core/logger';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import requireSession from '~/lib/user/require-session';

import {
  DismissChangelogInputSchema,
  type DismissChangelogInput,
  type ChangelogEntry,
  toWhatsNewDashboardItem,
  type WhatsNewDashboardItem,
  ULTAURA_CHANGELOG_DISMISSALS_TABLE,
} from '~/lib/ultaura/changelog-shared';
import {
  getPublishedChangelog,
  listChangelogEntries,
} from '~/lib/ultaura/changelog';

export async function loadAllPublishedChangelogDashboardItems(): Promise<
  ActionResult<WhatsNewDashboardItem[]>
> {
  try {
    const result = await getPublishedChangelog({ limit: null });
    return {
      success: true,
      data: result.entries.map(toWhatsNewDashboardItem),
    };
  } catch (error) {
    getLogger().error({ error }, 'Failed to load all published changelog dashboard items');

    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to load updates'),
    };
  }
}

export async function dismissChangelog(
  userId?: string,
  input?: DismissChangelogInput,
): Promise<ActionResult<void>> {
  const logger = getLogger();
  const client = getSupabaseServerActionClient();
  const session = await requireSession(client as any);
  const effectiveUserId = (userId ?? session.user.id)?.trim();

  if (!effectiveUserId) {
    return {
      success: false,
      error: createError(ErrorCodes.UNAUTHORIZED, 'Unauthorized'),
    };
  }

  if (effectiveUserId !== session.user.id) {
    return {
      success: false,
      error: createError(ErrorCodes.FORBIDDEN, 'Cannot dismiss changelog for another user'),
    };
  }

  let payload = input ?? null;

  if (!payload) {
    const latestPublishedEntry = await getLatestPublishedChangelogEntry(client);
    const lastSeenPublishedAt = getChangelogEntryPublishedAt(latestPublishedEntry);

    payload = lastSeenPublishedAt
      ? {
          lastSeenEntryId: latestPublishedEntry?.id ?? null,
          lastSeenPublishedAt,
        }
      : null;
  }

  if (!payload) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'No published changelog entries found'),
    };
  }

  const parsed = DismissChangelogInputSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      error: createError(
        ErrorCodes.INVALID_INPUT,
        parsed.error.issues[0]?.message || 'Invalid changelog dismissal payload',
      ),
    };
  }

  const now = new Date().toISOString();
  const { error } = await client
    .from(ULTAURA_CHANGELOG_DISMISSALS_TABLE as any)
    .upsert(
      {
        user_id: effectiveUserId,
        dismissed_at: now,
        last_seen_entry_id: parsed.data.lastSeenEntryId,
        last_seen_published_at: parsed.data.lastSeenPublishedAt,
        updated_at: now,
      },
      { onConflict: 'user_id' },
    );

  if (error) {
    logger.error({ error, userId: effectiveUserId }, 'Failed to dismiss changelog');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to dismiss changelog'),
    };
  }

  revalidatePath('/dashboard', 'page');

  return {
    success: true,
    data: undefined,
  };
}

export async function dismissChangelogItem(
  input: string | DismissChangelogInput,
): Promise<ActionResult<void>> {
  if (typeof input === 'string') {
    const entryId = input.trim();
    const client = getSupabaseServerActionClient();
    const latestPublishedEntry = await getLatestPublishedChangelogEntry(client);
    const publishedAt = getChangelogEntryPublishedAt(latestPublishedEntry);

    if (!publishedAt) {
      return {
        success: false,
        error: createError(ErrorCodes.NOT_FOUND, 'No published changelog entries found'),
      };
    }

    return dismissChangelog(undefined, {
      lastSeenEntryId: entryId || (latestPublishedEntry?.id ?? null),
      lastSeenPublishedAt: publishedAt,
    });
  }

  return dismissChangelog(undefined, input);
}

async function getLatestPublishedChangelogEntry(client: unknown): Promise<ChangelogEntry | null> {
  return (
    await listChangelogEntries(client as any, {
      published: true,
      limit: 1,
    })
  )[0] ?? null;
}

function getChangelogEntryPublishedAt(entry: ChangelogEntry | null) {
  return entry?.publishedAt ?? entry?.createdAt ?? null;
}
