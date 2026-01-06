import { Metadata } from 'next';

import AdminHeader from '~/app/admin/components/AdminHeader';
import getPageFromQueryParams from '~/app/admin/utils/get-page-from-query-param';
import { PageBody } from '~/core/ui/Page';
import { getDebugLogs } from '~/lib/ultaura/admin-actions';
import { DebugLogFilters } from './components/DebugLogFilters';
import { DebugLogTable } from './components/DebugLogTable';

export const metadata: Metadata = {
  title: 'Ultaura Debug Logs',
};

interface DebugLogsPageProps {
  searchParams: {
    page?: string;
    startDate?: string;
    endDate?: string;
    sessionId?: string;
    eventType?: string;
    toolName?: string;
    accountId?: string;
  };
}

export default async function DebugLogsPage({ searchParams }: DebugLogsPageProps) {
  const page = getPageFromQueryParams(searchParams.page);
  const perPage = 50;
  const offset = (page - 1) * perPage;

  const { data, count } = await getDebugLogs({
    startDate: searchParams.startDate,
    endDate: searchParams.endDate,
    callSessionId: searchParams.sessionId,
    eventType: searchParams.eventType,
    toolName: searchParams.toolName,
    accountId: searchParams.accountId,
    limit: perPage,
    offset,
  });

  const pageCount = count ? Math.ceil(count / perPage) : 0;

  return (
    <div className={'flex flex-1 flex-col'}>
      <AdminHeader>Ultaura Debug Logs</AdminHeader>

      <PageBody>
        <div className="flex flex-col gap-6 pb-12">
          <div className="text-sm text-muted-foreground">
            Admin-only view of full call event payloads. Logs auto-delete after 7 days.
          </div>

          <DebugLogFilters currentFilters={searchParams} />

          <DebugLogTable
            logs={data}
            page={page}
            perPage={perPage}
            pageCount={pageCount}
          />
        </div>
      </PageBody>
    </div>
  );
}
