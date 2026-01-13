import { Metadata } from 'next';
import Link from 'next/link';
import AppHeader from '../components/AppHeader';
import { PageBody } from '~/core/ui/Page';
import { loadAppDataForUser } from '~/lib/server/loaders/load-app-data';
import { getUltauraAccount, getTrialInfo } from '~/lib/ultaura/accounts';
import { getLines } from '~/lib/ultaura/lines';
import { getWellnessAlerts } from '~/lib/ultaura/alerts';
import { getNotificationPreferences } from '~/lib/ultaura/insights';
import { TrialExpiredBanner } from '~/components/ultaura/TrialExpiredBanner';
import { TrialStatusBadge } from '~/components/ultaura/TrialStatusBadge';
import { PLANS } from '~/lib/ultaura/constants';
import type { PlanId } from '~/lib/ultaura/types';
import { WellnessAlertsList } from './WellnessAlertsList';
import { AlertSettings } from './AlertSettings';

export const metadata: Metadata = {
  title: 'Alerts - Ultaura',
};

export default async function AlertsPage() {
  const appData = await loadAppDataForUser();
  const organizationId = appData.organization?.id;

  if (!organizationId) {
    return (
      <>
        <AppHeader
          title="Alerts"
          description="Stay on top of wellness alerts for your loved ones"
        />
        <PageBody>
          <div className="py-8">
            <p className="text-muted-foreground">Organization not found.</p>
          </div>
        </PageBody>
      </>
    );
  }

  const account = await getUltauraAccount(organizationId);

  if (!account) {
    return (
      <>
        <AppHeader
          title="Alerts"
          description="Stay on top of wellness alerts for your loved ones"
        />
        <PageBody>
          <div className="max-w-lg rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">Enable alerts</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Start a trial to unlock wellness alerts and notification settings.
            </p>
            <Link
              href="/dashboard/settings/subscription"
              className="mt-4 inline-flex items-center text-sm font-medium text-primary hover:underline"
            >
              Start trial ->
            </Link>
          </div>
        </PageBody>
      </>
    );
  }

  const [lines, alerts, trialInfo] = await Promise.all([
    getLines(account.id),
    getWellnessAlerts(account.id, { limit: 100 }),
    getTrialInfo(account.id),
  ]);

  const settings = await Promise.all(
    lines.map(async (line) => ({
      line,
      preferences: await getNotificationPreferences(account.id, line.id),
    }))
  );

  const isTrialExpired = trialInfo?.isExpired ?? false;
  const isTrialActive = (trialInfo?.isOnTrial ?? false) && !isTrialExpired;
  const trialPlanKey = (trialInfo?.trialPlanId ?? 'free_trial') as PlanId;
  const trialPlanName = PLANS[trialPlanKey]?.displayName ?? 'Trial';

  return (
    <>
      <AppHeader
        title="Alerts"
        description="Stay on top of wellness alerts for your loved ones"
      >
        {isTrialActive && trialInfo ? (
          <TrialStatusBadge
            daysRemaining={trialInfo.daysRemaining}
            planName={trialPlanName}
          />
        ) : null}
      </AppHeader>
      <PageBody>
        <div className="space-y-6 pb-12">
          {isTrialExpired ? <TrialExpiredBanner trialPlanName={trialPlanName} /> : null}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <WellnessAlertsList
                alerts={alerts}
                lines={lines}
                disabled={isTrialExpired}
              />
            </div>
            <div className="lg:col-span-1">
              <AlertSettings
                settings={settings}
                disabled={isTrialExpired}
              />
            </div>
          </div>
        </div>
      </PageBody>
    </>
  );
}
