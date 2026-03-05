import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTrialInfo } from '~/lib/ultaura/accounts';
import { getLine, getLines } from '~/lib/ultaura/lines';
import { ContactsClient } from './ContactsClient';
import { isUUID } from '~/lib/ultaura/short-id';
import { PageBody } from '~/core/ui/Page';
import { TrialExpiredBanner } from '~/components/ultaura/TrialExpiredBanner';
import { PLANS } from '~/lib/ultaura/constants';
import type { PlanId } from '~/lib/ultaura/types';
import AppHeader from '../../../components/AppHeader';
import { LinePageHeader } from '../components/LinePageHeader';
import { loadAppDataForUser } from '~/lib/server/loaders/load-app-data';
import { isViewerRole } from '~/lib/ultaura/viewer-guards';

export const metadata: Metadata = {
  title: 'Trusted Contacts - Ultaura',
};

interface PageProps {
  params: { lineId: string };
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function TrustedContactsPage({ params, searchParams }: PageProps) {
  const appData = await loadAppDataForUser();
  const isViewer = isViewerRole(appData.role);

  const line = await getLine(params.lineId);

  if (!line) {
    notFound();
  }

  if (isUUID(params.lineId)) {
    const preservedSearchParams = new URLSearchParams();
    Object.entries(searchParams ?? {}).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((entry) => {
          if (entry != null) preservedSearchParams.append(key, entry);
        });
        return;
      }

      if (value != null) {
        preservedSearchParams.set(key, value);
      }
    });

    const query = preservedSearchParams.toString();
    redirect(`/dashboard/lines/${line.short_id}/contacts${query ? `?${query}` : ''}`);
  }

  // If not verified, redirect to verification
  if (!line.phone_verified_at) {
    redirect(`/dashboard/lines/${line.short_id}/verify`);
  }

  const [trialInfo, lines] = await Promise.all([
    getTrialInfo(line.account_id),
    getLines(line.account_id),
  ]);
  const isTrialExpired = trialInfo?.isExpired ?? false;
  const trialPlanId = trialInfo?.trialPlanId ?? null;
  const trialPlanKey = (trialPlanId ?? 'free_trial') as PlanId;
  const trialPlanName = PLANS[trialPlanKey]?.displayName ?? 'Trial';

  return (
    <>
      <AppHeader title="Lines" description="Manage settings for this line" />
      <PageBody>
        <div className="space-y-6">
          <LinePageHeader
            lines={lines}
            currentLineShortId={line.short_id}
          />
          {isTrialExpired ? <TrialExpiredBanner trialPlanName={trialPlanName} /> : null}
          <ContactsClient
            line={{ id: line.id, shortId: line.short_id }}
            disabled={isTrialExpired}
            readOnly={isViewer}
          />
        </div>
      </PageBody>
    </>
  );
}
