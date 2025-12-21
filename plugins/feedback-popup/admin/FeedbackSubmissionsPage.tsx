import type { Metadata } from 'next';
import { SupabaseClient } from '@supabase/supabase-js';

import { withAdminSession } from '~/core/generic/actions-utils';
import AdminHeader from '~/app/admin/components/AdminHeader';
import FeedbackDataTable from '~/plugins/feedback-popup/admin/FeedbackDataTable';
import FeedbackSubmission from '~/plugins/feedback-popup/lib/feedback-submission';
import { getFeedbackSubmissions } from '~/plugins/feedback-popup/lib/queries';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import { PageBody } from '~/core/ui/Page';
import { TextFieldInput } from '~/core/ui/TextField';

interface FeedbackSubmissionsPageSearchParams {
  page?: number;
  query?: string;
  type?: FeedbackSubmission['type'];
}

export const metadata: Metadata = {
  title: 'Feedback Submissions',
};

async function FeedbackSubmissionsPage({
  searchParams,
}: {
  searchParams: FeedbackSubmissionsPageSearchParams;
}) {
  const adminClient = getSupabaseServerComponentClient({
    admin: true,
  });

  const { submissions, count, perPage, page } = await loadFeedbackSubmissions(
    adminClient,
    searchParams,
  );

  return (
    <div className={'flex flex-1 flex-col'}>
      <AdminHeader>Feedback Submissions</AdminHeader>

      <PageBody>
        <div className={'flex flex-col space-y-4'}>
          <SearchBar defaultValue={searchParams.query} />

          <FeedbackDataTable
            count={count ?? 0}
            perPage={perPage}
            page={page}
            submissions={submissions}
          />
        </div>
      </PageBody>
    </div>
  );
}

export default withAdminSession(FeedbackSubmissionsPage);

async function loadFeedbackSubmissions(
  adminClient: SupabaseClient,
  params: FeedbackSubmissionsPageSearchParams,
) {
  const perPage = 8;
  const page = params.page ?? 1;

  const submissionsResponse = await getFeedbackSubmissions(adminClient, {
    query: params.query,
    page,
    perPage,
  });

  if (submissionsResponse.error) {
    throw submissionsResponse.error;
  }

  const data = submissionsResponse.data;

  return {
    submissions: data,
    count: submissionsResponse.count,
    perPage,
    page,
  };
}

function SearchBar({
  defaultValue,
}: React.PropsWithChildren<{
  defaultValue?: string;
}>) {
  return (
    <form method={'GET'}>
      <TextFieldInput
        name={'query'}
        defaultValue={defaultValue}
        placeholder={'Search...'}
      />
    </form>
  );
}
