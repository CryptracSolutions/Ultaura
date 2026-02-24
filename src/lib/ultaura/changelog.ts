export * from './changelog-shared';

import {
  type ChangelogDismissal,
  type ChangelogEntry,
  type ChangelogListQueryOptions,
  type ChangelogQueryClient,
  type PublishedChangelogDashboardItemsResult,
  type PublishedChangelogResult,
  mapChangelogDismissalRow,
  mapChangelogRow,
  toWhatsNewDashboardItem,
  ULTAURA_CHANGELOG_DISMISSALS_TABLE,
  ULTAURA_CHANGELOG_TABLE,
} from './changelog-shared';

export async function listChangelogEntries(
  client: ChangelogQueryClient,
  options?: ChangelogListQueryOptions,
): Promise<ChangelogEntry[]> {
  const ids = dedupeNonEmptyStrings(options?.ids ?? []);

  let query = client
    .from(ULTAURA_CHANGELOG_TABLE as any)
    .select('*')
    .order('published_at', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (typeof options?.published === 'boolean') {
    query = query.eq('published', options.published);
  }

  if (options?.publishBatchId) {
    query = query.eq('publish_batch_id', options.publishBatchId);
  }

  if (ids.length > 0) {
    query = query.in('id', ids);
  }

  if (typeof options?.limit === 'number' && Number.isFinite(options.limit)) {
    query = query.limit(Math.max(1, Math.floor(options.limit)));
  }

  const { data, error } = await query;

  if (error) {
    const logger = await getLogger();
    logger.error({ error, options }, 'Failed to list changelog entries');
    return [];
  }

  return ((data as Array<Record<string, unknown>> | null) ?? [])
    .map(mapChangelogRow)
    .filter((entry) => Boolean(entry.id))
    .sort(sortChangelogEntries);
}

export async function getPublishedChangelog(
  options?: { limit?: number | null },
): Promise<PublishedChangelogResult> {
  const client = await getServerComponentClient();
  const limit = options?.limit === undefined ? 5 : options.limit;

  const [entries, countResult] = await Promise.all([
    listChangelogEntries(client, { published: true, limit }),
    client
      .from(ULTAURA_CHANGELOG_TABLE as any)
      .select('id', { count: 'exact', head: true })
      .eq('published', true),
  ]);

  const totalCount = typeof countResult.count === 'number' ? countResult.count : entries.length;
  const latest = entries[0] ?? null;

  return {
    entries,
    totalCount,
    latestEntryId: latest?.id ?? null,
    latestPublishedAt: latest?.publishedAt ?? latest?.createdAt ?? null,
  };
}

export async function getPublishedChangelogDashboardItems(
  options?: { limit?: number | null },
): Promise<PublishedChangelogDashboardItemsResult> {
  const result = await getPublishedChangelog(options);

  return {
    items: result.entries.map(toWhatsNewDashboardItem),
    totalCount: result.totalCount,
    latestEntryId: result.latestEntryId,
    latestPublishedAt: result.latestPublishedAt,
  };
}

export async function getUserChangelogDismissal(
  userId: string,
): Promise<ChangelogDismissal | null> {
  if (!userId?.trim()) {
    return null;
  }

  const client = await getServerComponentClient();
  const { data, error } = await client
    .from(ULTAURA_CHANGELOG_DISMISSALS_TABLE as any)
    .select('id, user_id, dismissed_at, last_seen_entry_id, last_seen_published_at, created_at, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    const logger = await getLogger();
    logger.error({ error, userId }, 'Failed to load changelog dismissal');
    return null;
  }

  if (!data) {
    return null;
  }

  return mapChangelogDismissalRow(data as Record<string, unknown>);
}

export const getChangelogDismissal = getUserChangelogDismissal;

function dedupeNonEmptyStrings(values: string[]) {
  const seen = new Set<string>();
  const dedupedValues: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    dedupedValues.push(trimmed);
  }

  return dedupedValues;
}

function sortChangelogEntries(a: ChangelogEntry, b: ChangelogEntry) {
  const aPublished = a.publishedAt ? Date.parse(a.publishedAt) : Number.NaN;
  const bPublished = b.publishedAt ? Date.parse(b.publishedAt) : Number.NaN;

  if (Number.isFinite(aPublished) && Number.isFinite(bPublished) && aPublished !== bPublished) {
    return bPublished - aPublished;
  }

  if (a.sortOrder !== b.sortOrder) {
    return a.sortOrder - b.sortOrder;
  }

  return b.createdAt.localeCompare(a.createdAt);
}

async function getLogger() {
  const loggerModule = await import('~/core/logger');
  return loggerModule.default();
}

async function getServerComponentClient(): Promise<ChangelogQueryClient> {
  const clientModule = await import('~/core/supabase/server-component-client');
  return clientModule.default() as ChangelogQueryClient;
}
