import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getLine, getTrialInfo } from '~/lib/ultaura/actions';
import { VerifyPhoneClient } from './VerifyPhoneClient';
import AppHeader from '../../../components/AppHeader';
import { PageBody } from '~/core/ui/Page';
import { TrialExpiredBanner } from '~/components/ultaura/TrialExpiredBanner';
import { TrialStatusBadge } from '~/components/ultaura/TrialStatusBadge';
import { PLANS } from '~/lib/ultaura/constants';

export const metadata: Metadata = {
  title: 'Verify Phone - Ultaura',
};

interface PageProps {
  params: { lineId: string };
}

export default async function VerifyPhonePage({ params }: PageProps) {
  const line = await getLine(params.lineId);

  if (!line) {
    redirect('/dashboard/lines');
  }

  // Already verified
  if (line.phone_verified_at) {
    redirect(`/dashboard/lines/${params.lineId}`);
  }

  // Format phone for display
  const formattedPhone = formatPhoneNumber(line.phone_e164);

  const trialInfo = await getTrialInfo(line.account_id);
  const isTrialExpired = trialInfo?.isExpired ?? false;
  const isTrialActive = (trialInfo?.isOnTrial ?? false) && !isTrialExpired;
  const trialPlanId = trialInfo?.trialPlanId ?? null;
  const trialPlanName = trialPlanId ? (PLANS[trialPlanId]?.displayName ?? 'Trial') : 'Trial';

  return (
    <>
      <AppHeader title="Verify Phone" description="Confirm ownership of this phone number">
        {isTrialActive && trialInfo ? (
          <TrialStatusBadge daysRemaining={trialInfo.daysRemaining} planName={trialPlanName} />
        ) : null}
      </AppHeader>
      <PageBody>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-full space-y-6">
            {isTrialExpired ? <TrialExpiredBanner trialPlanName={trialPlanName} /> : null}
            <VerifyPhoneClient lineId={line.id} phoneNumber={formattedPhone} disabled={isTrialExpired} />
          </div>
        </div>
      </PageBody>
    </>
  );
}

function formatPhoneNumber(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    const areaCode = digits.slice(1, 4);
    const exchange = digits.slice(4, 7);
    const subscriber = digits.slice(7);
    return `(${areaCode}) ${exchange}-${subscriber}`;
  }
  return e164;
}
