import { Metadata } from 'next';
import { getUltauraAccount } from '~/lib/ultaura/accounts';
import { getLines } from '~/lib/ultaura/lines';
import {
  getAllReminders,
  getScheduledReminderStatsByLine,
} from '~/lib/ultaura/reminders';
import { getEffectiveReminderLimit, getTrialStatus } from '~/lib/ultaura/helpers';
import { loadAppDataForUser } from '~/lib/server/loaders/load-app-data';
import { RemindersPageClient } from './RemindersPageClient';
import AppHeader from '../components/AppHeader';
import { PageBody } from '~/core/ui/Page';
import { TrialExpiredBanner } from '~/components/ultaura/TrialExpiredBanner';
import { TrialStatusBadge } from '~/components/ultaura/TrialStatusBadge';
import { PLANS } from '~/lib/ultaura/constants';
import Button from '~/core/ui/Button';

export const metadata: Metadata = {
  title: 'Reminders - Ultaura',
};

export default async function RemindersPage() {
  const appData = await loadAppDataForUser();
  const organizationId = appData.organization?.id;

  if (!organizationId) {
    return (
      <>
        <AppHeader title="Reminders" description="Set up helpful reminders for any routine, task, or event" />
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
        <AppHeader title="Reminders" description="Set up helpful reminders for any routine, task, or event" />
        <PageBody>
          <div className="max-w-lg mx-auto text-center py-8">
            <h2 className="text-2xl font-semibold mb-4">Get Started with Ultaura</h2>
            <p className="text-muted-foreground mb-6">
              Set up phone companionship and reminders. Start with a 14-day free trial.
            </p>
            <Button variant="default" href="/dashboard/settings/subscription">
              Start 14-day free trial
            </Button>
          </div>
        </PageBody>
      </>
    );
  }

  const [lines, reminders] = await Promise.all([
    getLines(account.id),
    getAllReminders(account.id),
  ]);

  const trialStatus = getTrialStatus(account);
  const isOnTrial = trialStatus.isOnTrial;
  const isTrialExpired = trialStatus.isExpired;
  const trialDaysRemaining = trialStatus.daysRemaining;
  const trialPlanId = (trialStatus.trialPlanId ?? 'free_trial') as keyof typeof PLANS;
  const trialPlanName = PLANS[trialPlanId]?.displayName ?? 'Trial';

  // Compute effective plan and reminder limits per line
  const reminderLimitPerLine = getEffectiveReminderLimit(account);
  const reminderStatsByLine = await getScheduledReminderStatsByLine(
    account.id,
    lines.map((line) => line.id),
  );
  const reminderLimits: Record<string, { limit: number | null; count: number }> = {};
  lines.forEach((line) => {
    reminderLimits[line.id] = {
      limit: reminderLimitPerLine,
      count: reminderStatsByLine[line.id] ?? 0,
    };
  });

  return (
    <>
      <AppHeader title="Reminders" description="Set up helpful reminders for any routine, task, or event">
        {isOnTrial && !isTrialExpired ? (
          <TrialStatusBadge daysRemaining={trialDaysRemaining} planName={trialPlanName} />
        ) : null}
      </AppHeader>
      <PageBody>
        <div className="space-y-6">
          {isTrialExpired ? <TrialExpiredBanner trialPlanName={trialPlanName} /> : null}
          <RemindersPageClient
            lines={lines}
            reminders={reminders}
            disabled={isTrialExpired}
            reminderLimits={reminderLimits}
          />
        </div>
      </PageBody>
    </>
  );
}
