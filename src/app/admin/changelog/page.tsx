import type { Metadata } from 'next';

import AdminHeader from '~/app/admin/components/AdminHeader';
import AdminGuard from '~/app/admin/components/AdminGuard';
import { PageBody } from '~/core/ui/Page';
import { CHANGELOG_CATEGORY_OPTIONS } from '~/lib/ultaura/changelog-shared';
import { getAllChangelogEntries } from '~/lib/ultaura/changelog-admin-actions';
import ChangelogAdminClient, {
  type ChangelogAdminEntry,
  type ChangelogCategoryOption,
} from './components/ChangelogAdminClient';

export const metadata: Metadata = {
  title: 'Admin Changelog',
};

async function ChangelogAdminPage() {
  const categoryOptions = CHANGELOG_CATEGORY_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    description: option.description,
  })) satisfies ChangelogCategoryOption[];

  const defaultCategory = categoryOptions[0]?.value ?? 'announcement';
  const entries = (await getAllChangelogEntries()).map((entry, index) =>
    normalizeEntry(entry, index, defaultCategory),
  );

  return (
    <div className="flex flex-1 flex-col">
      <AdminHeader description="Manage changelog entries and release email sends">
        Changelog
      </AdminHeader>

      <PageBody>
        <div className="flex flex-col gap-6 pb-12">
          <ChangelogAdminClient
            entries={entries}
            categoryOptions={categoryOptions}
          />
        </div>
      </PageBody>
    </div>
  );
}

export default AdminGuard(ChangelogAdminPage);

type ChangelogEntryCompat = {
  id?: string | null;
  title?: string | null;
  description?: string | null;
  summary?: string | null;
  category?: string | null;
  sort_order?: number | string | null;
  sortOrder?: number | string | null;
  status?: string | null;
  published_at?: string | null;
  publishedAt?: string | null;
  publish_batch_id?: string | null;
  publishBatchId?: string | null;
  email_sent?: boolean | null;
  emailSent?: boolean | null;
  email_sent_at?: string | null;
  emailSentAt?: string | null;
};

function normalizeEntry(
  entry: ChangelogEntryCompat,
  index: number,
  defaultCategory: string,
): ChangelogAdminEntry {
  const publishedAt = entry.published_at ?? entry.publishedAt ?? null;
  const status = normalizeStatus(entry.status, publishedAt);

  return {
    id: entry.id ? String(entry.id) : `row-${index}`,
    title: entry.title?.trim() || `Untitled Entry ${index + 1}`,
    description: normalizeText(entry.description ?? entry.summary),
    category: normalizeText(entry.category) ?? defaultCategory,
    sort_order: parseOptionalSortOrder(entry.sort_order ?? entry.sortOrder),
    status,
    published_at: publishedAt,
    publish_batch_id: normalizeText(entry.publish_batch_id ?? entry.publishBatchId),
    email_sent: entry.email_sent ?? entry.emailSent ?? false,
    email_sent_at: entry.email_sent_at ?? entry.emailSentAt ?? null,
  };
}

function normalizeStatus(status: string | null | undefined, publishedAt: string | null) {
  return normalizeText(status)?.toLowerCase() ?? (publishedAt ? 'published' : 'draft');
}

function normalizeText(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseOptionalSortOrder(value: number | string | null | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}
