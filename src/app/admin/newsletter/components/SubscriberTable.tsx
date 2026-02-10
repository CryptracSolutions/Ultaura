'use client';

import type { ColumnDef } from '@tanstack/react-table';

import DataTable from '~/core/ui/DataTable';
import type { SubscriberRow } from '~/lib/ultaura/newsletter-admin-actions';

const TOPIC_LABELS: Record<string, string> = {
  blog_digest: 'BD',
  elder_care_tips: 'ECT',
  product_updates: 'PU',
};

const ALL_TOPICS = ['blog_digest', 'elder_care_tips', 'product_updates'];

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  unsubscribed: 'bg-gray-100 text-gray-800',
  bounced: 'bg-red-100 text-red-800',
  complained: 'bg-red-100 text-red-800',
};

const columns: Array<ColumnDef<SubscriberRow>> = [
  {
    header: 'Email',
    id: 'email',
    cell: ({ row }) => row.original.email,
  },
  {
    header: 'Name',
    id: 'first_name',
    cell: ({ row }) => {
      const name = row.original.first_name;
      if (!name) return <span className="text-muted-foreground">-</span>;
      return name;
    },
  },
  {
    header: 'Status',
    id: 'status',
    cell: ({ row }) => {
      const status = row.original.status;
      const colorClass = STATUS_COLORS[status] || 'bg-gray-100 text-gray-800';
      return (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
        >
          {status}
        </span>
      );
    },
  },
  {
    header: 'Topics',
    id: 'topics',
    cell: ({ row }) => {
      const topics = row.original.topics;
      const subscribedKeys = new Set(
        topics.filter((t) => t.subscribed).map((t) => t.topic_key),
      );

      return (
        <div className="flex gap-1">
          {ALL_TOPICS.map((key) => {
            const isSubscribed = subscribedKeys.has(key);
            const colorClass = isSubscribed
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-500';
            return (
              <span
                key={key}
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
              >
                {TOPIC_LABELS[key] || key}
              </span>
            );
          })}
        </div>
      );
    },
  },
  {
    header: 'Source',
    id: 'source',
    cell: ({ row }) => row.original.source,
  },
  {
    header: 'Confirmed',
    id: 'confirmed_at',
    cell: ({ row }) => {
      const value = row.original.confirmed_at;
      if (!value) return <span className="text-muted-foreground">-</span>;
      return (
        <span suppressHydrationWarning>
          {new Date(value).toLocaleDateString()}
        </span>
      );
    },
  },
  {
    header: 'Created',
    id: 'created_at',
    cell: ({ row }) => (
      <span suppressHydrationWarning>
        {new Date(row.original.created_at).toLocaleDateString()}
      </span>
    ),
  },
];

export function SubscriberTable({
  subscribers,
  page,
  perPage,
  pageCount,
}: {
  subscribers: SubscriberRow[];
  page: number;
  perPage: number;
  pageCount: number;
}) {
  return (
    <DataTable
      tableProps={{
        'data-cy': 'newsletter-subscribers-table',
      }}
      pageSize={perPage}
      pageIndex={page - 1}
      pageCount={pageCount}
      columns={columns}
      data={subscribers}
    />
  );
}
