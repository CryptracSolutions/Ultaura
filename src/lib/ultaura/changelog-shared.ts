import { z } from 'zod';

import { brandColors } from '~/lib/brand-colors';

export const ULTAURA_CHANGELOG_TABLE = 'ultaura_changelog_entries';
export const ULTAURA_CHANGELOG_DISMISSALS_TABLE = 'ultaura_changelog_dismissals';
const EPOCH_ISO_STRING = new Date(0).toISOString();

export const CHANGELOG_CATEGORIES = [
  'new_feature',
  'improvement',
  'fix',
  'announcement',
] as const;

export type ChangelogCategory = (typeof CHANGELOG_CATEGORIES)[number];

export interface ChangelogCategoryMeta {
  label: string;
  description: string;
  dashboardBadgeClassName: string;
  emailTextColor: string;
}

export const CHANGELOG_CATEGORY_META: Record<ChangelogCategory, ChangelogCategoryMeta> = {
  new_feature: {
    label: 'New Feature',
    description: 'New capabilities and launches',
    dashboardBadgeClassName: 'border-green-200 bg-green-50 text-green-700',
    emailTextColor: brandColors.changelog.newFeature,
  },
  improvement: {
    label: 'Improvement',
    description: 'Quality-of-life improvements and refinements',
    dashboardBadgeClassName: 'border-blue-200 bg-blue-50 text-blue-700',
    emailTextColor: brandColors.changelog.improvement,
  },
  fix: {
    label: 'Fix',
    description: 'Bug fixes and reliability improvements',
    dashboardBadgeClassName: 'border-amber-200 bg-amber-50 text-amber-700',
    emailTextColor: brandColors.changelog.fix,
  },
  announcement: {
    label: 'Announcement',
    description: 'Product or operational announcements',
    dashboardBadgeClassName: 'border-violet-200 bg-violet-50 text-violet-700',
    emailTextColor: brandColors.changelog.announcement,
  },
};

export const CHANGELOG_CATEGORY_OPTIONS = CHANGELOG_CATEGORIES.map((value) => ({
  value,
  label: CHANGELOG_CATEGORY_META[value].label,
  description: CHANGELOG_CATEGORY_META[value].description,
}));

export interface ChangelogEntry {
  id: string;
  title: string;
  description: string;
  category: ChangelogCategory;
  published: boolean;
  publishedAt: string | null;
  publishBatchId: string | null;
  emailSent: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChangelogDismissal {
  id: string;
  userId: string;
  dismissedAt: string;
  lastSeenEntryId: string | null;
  lastSeenPublishedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublishedChangelogResult {
  entries: ChangelogEntry[];
  totalCount: number;
  latestEntryId: string | null;
  latestPublishedAt: string | null;
}

export interface WhatsNewDashboardItem {
  id: string;
  category: ChangelogCategory;
  title: string;
  description: string;
  publishedAt: string;
}

export interface ChangelogEmailEntry {
  title: string;
  description: string;
  category: ChangelogCategory;
}

export interface PublishedChangelogDashboardItemsResult {
  items: WhatsNewDashboardItem[];
  totalCount: number;
  latestEntryId: string | null;
  latestPublishedAt: string | null;
}

export interface ChangelogListQueryOptions {
  ids?: string[];
  published?: boolean;
  publishBatchId?: string;
  limit?: number | null;
}

export const DismissChangelogInputSchema = z.object({
  lastSeenEntryId: z.string().uuid().nullable(),
  lastSeenPublishedAt: z.string().datetime({ offset: true }),
});

export type DismissChangelogInput = z.infer<typeof DismissChangelogInputSchema>;

export const ChangelogEmailRouteRequestSchema = z.object({
  batchId: z.string().uuid(),
  entryIds: z.array(z.string().uuid()).min(1).max(100),
});

export type ChangelogEmailRouteRequest = z.infer<typeof ChangelogEmailRouteRequestSchema>;

export interface ChangelogEmailRouteFailure {
  email: string;
  message: string;
}

export interface ChangelogEmailRouteResponse {
  success: boolean;
  batchId?: string;
  entryCount?: number;
  recipientsAttempted?: number;
  recipientsSent?: number;
  recipientsFailed?: number;
  dedupedFrom?: number;
  error?: string;
  failures?: ChangelogEmailRouteFailure[];
}

export type ChangelogQueryClient = {
  from: (table: string) => any;
  auth?: {
    getUser?: () => Promise<{
      data?: { user?: { id?: string | null } | null } | null;
      error?: unknown;
    }>;
  };
};

export function isChangelogCategory(value: unknown): value is ChangelogCategory {
  return typeof value === 'string' && (CHANGELOG_CATEGORIES as readonly string[]).includes(value);
}

export function normalizeChangelogCategory(value: unknown): ChangelogCategory {
  if (value === 'feature') {
    return 'new_feature';
  }

  return isChangelogCategory(value) ? value : 'announcement';
}

export function mapChangelogRow(row: Record<string, unknown>): ChangelogEntry {
  const publishedAt = readNullableString(row, ['published_at']);
  const createdAt = readString(row, ['created_at']) ?? EPOCH_ISO_STRING;

  return {
    id: readString(row, ['id']) ?? '',
    title: readString(row, ['title']) ?? 'Untitled update',
    description: readString(row, ['description']) ?? '',
    category: normalizeChangelogCategory(row.category),
    published:
      readBoolean(row, ['published']) ??
      (typeof publishedAt === 'string' && publishedAt.length > 0),
    publishedAt,
    publishBatchId: readNullableString(row, ['publish_batch_id']),
    emailSent: readBoolean(row, ['email_sent']) ?? false,
    sortOrder: readNumber(row, ['sort_order']) ?? 0,
    createdAt,
    updatedAt: readString(row, ['updated_at']) ?? createdAt,
  };
}

export function mapChangelogDismissalRow(
  row: Record<string, unknown>,
): ChangelogDismissal | null {
  const id = readString(row, ['id']);
  const userId = readString(row, ['user_id']);
  const dismissedAt = readString(row, ['dismissed_at']);
  const lastSeenPublishedAt = readString(row, ['last_seen_published_at']);
  const createdAt = readString(row, ['created_at']) ?? dismissedAt;
  const updatedAt = readString(row, ['updated_at']) ?? dismissedAt;

  if (!id || !userId || !dismissedAt || !lastSeenPublishedAt || !createdAt || !updatedAt) {
    return null;
  }

  return {
    id,
    userId,
    dismissedAt,
    lastSeenEntryId: readNullableString(row, ['last_seen_entry_id']),
    lastSeenPublishedAt,
    createdAt,
    updatedAt,
  };
}

export function toChangelogEmailEntry(entry: ChangelogEntry): ChangelogEmailEntry {
  return {
    title: entry.title,
    description: entry.description,
    category: entry.category,
  };
}

export function toWhatsNewDashboardItem(entry: ChangelogEntry): WhatsNewDashboardItem {
  return {
    id: entry.id,
    category: entry.category,
    title: entry.title,
    description: entry.description,
    publishedAt: entry.publishedAt ?? entry.createdAt,
  };
}

function readString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string') {
      return value;
    }
  }

  return null;
}

function readNullableString(
  row: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string') {
      return value;
    }

    if (value === null) {
      return null;
    }
  }

  return null;
}

function readBoolean(row: Record<string, unknown>, keys: string[]): boolean | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'boolean') {
      return value;
    }
  }

  return null;
}

function readNumber(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}
