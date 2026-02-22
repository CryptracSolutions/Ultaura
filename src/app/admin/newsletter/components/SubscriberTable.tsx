'use client';

import Badge from '~/core/ui/Badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '~/core/ui/Table';
import AdminPagination from '~/app/admin/components/AdminPagination';
import type { SubscriberRow } from '~/lib/ultaura/newsletter-admin-actions';

const TOPIC_LABELS: Record<string, string> = {
  blog_digest: 'BD',
  elder_care_tips: 'ECT',
  product_updates: 'PU',
};

const ALL_TOPICS = ['blog_digest', 'elder_care_tips', 'product_updates'];

function statusBadgeColor(
  status: string,
): 'success' | 'warn' | 'normal' | 'error' {
  switch (status) {
    case 'confirmed':
      return 'success';
    case 'pending':
      return 'warn';
    case 'unsubscribed':
      return 'normal';
    case 'bounced':
    case 'complained':
      return 'error';
    default:
      return 'normal';
  }
}

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
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Topics</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Confirmed</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subscribers.map((subscriber) => {
            const subscribedKeys = new Set(
              subscriber.topics
                .filter((t) => t.subscribed)
                .map((t) => t.topic_key),
            );

            return (
              <TableRow key={subscriber.email}>
                <TableCell>{subscriber.email}</TableCell>
                <TableCell>
                  {subscriber.first_name ? (
                    subscriber.first_name
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    color={statusBadgeColor(subscriber.status)}
                    size="small"
                  >
                    {subscriber.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {ALL_TOPICS.map((key) => (
                      <Badge
                        key={key}
                        color={subscribedKeys.has(key) ? 'success' : 'normal'}
                        size="small"
                      >
                        {TOPIC_LABELS[key] || key}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{subscriber.source}</TableCell>
                <TableCell>
                  {subscriber.confirmed_at ? (
                    <span suppressHydrationWarning>
                      {new Date(subscriber.confirmed_at).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell suppressHydrationWarning>
                  {new Date(subscriber.created_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <AdminPagination page={page} pageCount={pageCount} perPage={perPage} />
    </div>
  );
}
