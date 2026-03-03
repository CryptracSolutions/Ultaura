import { Metadata } from 'next';
import { getUltauraAccount } from '~/lib/ultaura/accounts';
import { getLines } from '~/lib/ultaura/lines';
import { getAllSchedules } from '~/lib/ultaura/schedules';
import { loadAppDataForUser } from '~/lib/server/loaders/load-app-data';
import { CallsPageClient } from './CallsPageClient';
import AppHeader from '../components/AppHeader';
import { PageBody } from '~/core/ui/Page';
import { TrialExpiredBanner } from '~/components/ultaura/TrialExpiredBanner';
import { TrialStatusBadge } from '~/components/ultaura/TrialStatusBadge';
import { PLANS } from '~/lib/ultaura/constants';
import { getTrialStatus } from '~/lib/ultaura/helpers';
import Button from '~/core/ui/Button';

export const metadata: Metadata = {
  title: 'Calls - Ultaura',
};

export default async function CallsPage() {
  const appData = await loadAppDataForUser();
  const organizationId = appData.organization?.id;

  if (!organizationId) {
    return (
      <>
        <AppHeader
          title="Call Schedules"
          description="Manage when Ultaura calls your account"
        />
        <PageBody>
          <p className="text-muted-foreground">Organization not found.</p>
        </PageBody>
      </>
    );
  }

  const account = await getUltauraAccount(organizationId);

  if (!account) {
    return (
      <>
        <AppHeader
          title="Call Schedules"
          description="Manage when Ultaura calls your account"
        />
        <PageBody>
          <div className="max-w-lg mx-auto text-center py-8">
            <h2 className="text-2xl font-semibold mb-4">
              Get Started with Ultaura
            </h2>
            <p className="text-muted-foreground mb-6">
              Set up phone companionship with Ultaura. Start with a 14-day free
              trial.
            </p>
            <Button variant="default" href="/dashboard/settings/subscription">
              Start 14-day free trial
            </Button>
          </div>
        </PageBody>
      </>
    );
  }

  const isSelfUser = account.user_type === 'self';
  const headerDescription = isSelfUser
    ? 'Manage when Ultaura calls you'
    : 'Manage when Ultaura calls your loved ones';

  const [lines, schedules] = await Promise.all([
    getLines(account.id),
    getAllSchedules(account.id),
  ]);

  // Filter to only verified lines
  const verifiedLines = lines.filter((l) => l.phone_verified_at);

  const trialStatus = getTrialStatus(account);
  const isOnTrial = trialStatus.isOnTrial;
  const isTrialExpired = trialStatus.isExpired;
  const trialDaysRemaining = trialStatus.daysRemaining;
  const trialPlanId = (trialStatus.trialPlanId ??
    account.plan_id) as keyof typeof PLANS;
  const trialPlanName = PLANS[trialPlanId]?.displayName ?? 'Trial';

  return (
    <>
      <AppHeader title="Call Schedules" description={headerDescription}>
        {isOnTrial && !isTrialExpired ? (
          <TrialStatusBadge
            daysRemaining={trialDaysRemaining}
            planName={trialPlanName}
          />
        ) : null}
      </AppHeader>
      <PageBody>
        <div className="space-y-6">
          {isTrialExpired ? (
            <TrialExpiredBanner trialPlanName={trialPlanName} />
          ) : null}
          <CallsPageClient
            lines={verifiedLines}
            schedules={schedules}
            disabled={isTrialExpired}
          />
        </div>
      </PageBody>
    </>
  );
}
