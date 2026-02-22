import { Metadata } from 'next';

import AdminHeader from '~/app/admin/components/AdminHeader';
import AdminGuard from '~/app/admin/components/AdminGuard';
import getPageFromQueryParams from '~/app/admin/utils/get-page-from-query-param';
import { PageBody } from '~/core/ui/Page';
import {
  listSubscribers,
  getSubscriberStats,
} from '~/lib/ultaura/newsletter-admin-actions';
import SubscriberStatsCards from './components/SubscriberStatsCards';
import { SubscriberFilters } from './components/SubscriberFilters';
import { SubscriberTable } from './components/SubscriberTable';

export const metadata: Metadata = {
  title: 'Newsletter Subscribers',
};

interface NewsletterPageProps {
  searchParams: {
    page?: string;
    perPage?: string;
    status?: string;
    source?: string;
    topic?: string;
  };
}

async function NewsletterPage({
  searchParams,
}: NewsletterPageProps) {
  const page = getPageFromQueryParams(searchParams.page);
  const perPage = searchParams.perPage ? Number(searchParams.perPage) : 25;

  const [stats, { subscribers, total, effectivePerPage }] = await Promise.all([
    getSubscriberStats(),
    listSubscribers({
      page,
      perPage,
      status: searchParams.status,
      source: searchParams.source,
      topic: searchParams.topic,
    }),
  ]);

  const pageCount = total ? Math.ceil(total / effectivePerPage) : 0;

  return (
    <div className={'flex flex-1 flex-col'}>
      <AdminHeader description="Subscribers, topics, and email campaigns">Newsletter</AdminHeader>

      <PageBody>
        <div className="flex flex-col gap-6 pb-12">
          <SubscriberStatsCards stats={stats} />

          <SubscriberFilters currentFilters={searchParams} />

          <SubscriberTable
            subscribers={subscribers}
            page={page}
            perPage={effectivePerPage}
            pageCount={pageCount}
          />
        </div>
      </PageBody>
    </div>
  );
}

export default AdminGuard(NewsletterPage);
