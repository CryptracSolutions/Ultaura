import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTrialInfo } from '~/lib/ultaura/accounts';
import { getLine } from '~/lib/ultaura/lines';
import { ContactsClient } from './ContactsClient';
import { isUUID } from '~/lib/ultaura/short-id';
import { PageBody } from '~/core/ui/Page';
import { TrialExpiredBanner } from '~/components/ultaura/TrialExpiredBanner';
import { PLANS } from '~/lib/ultaura/constants';
import type { PlanId } from '~/lib/ultaura/types';
import { LinePageHeader } from '../components/LinePageHeader';

export const metadata: Metadata = {
  title: 'Trusted Contacts - Ultaura',
};

interface PageProps {
  params: { lineId: string };
}

export default async function TrustedContactsPage({ params }: PageProps) {
  const line = await getLine(params.lineId);

  if (!line) {
    notFound();
  }

  if (isUUID(params.lineId)) {
    redirect(`/dashboard/lines/${line.short_id}/contacts`);
  }

  // If not verified, redirect to verification
  if (!line.phone_verified_at) {
    redirect(`/dashboard/lines/${line.short_id}/verify`);
  }

  const trialInfo = await getTrialInfo(line.account_id);
  const isTrialExpired = trialInfo?.isExpired ?? false;
  const trialPlanId = trialInfo?.trialPlanId ?? null;
  const trialPlanKey = (trialPlanId ?? 'free_trial') as PlanId;
  const trialPlanName = PLANS[trialPlanKey]?.displayName ?? 'Trial';

  return (
    <PageBody>
      <div className="space-y-6">
        <LinePageHeader
          lineName={line.display_name}
          lineShortId={line.short_id}
          phoneE164={line.phone_e164}
          timezone={line.timezone}
          status={line.status}
          isVerified={!!line.phone_verified_at}
        />
        {isTrialExpired ? <TrialExpiredBanner trialPlanName={trialPlanName} /> : null}
        <ContactsClient line={{ id: line.id, shortId: line.short_id }} disabled={isTrialExpired} />
      </div>
    </PageBody>
  );
}
