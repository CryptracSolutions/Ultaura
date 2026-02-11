import { Metadata } from 'next';
import { getUltauraAccount } from '~/lib/ultaura/accounts';
import { getLines } from '~/lib/ultaura/lines';
import { getAllReminders, getPendingReminderCount } from '~/lib/ultaura/reminders';
import type { PlanId } from '~/lib/ultaura/types';
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

  // Filter to only verified lines
  const verifiedLines = lines.filter((l) => l.phone_verified_at);

  const isOnTrial = account.status === 'trial';
  const trialEndsAt = account.trial_ends_at ?? account.cycle_end ?? null;
  const msRemaining = trialEndsAt ? new Date(trialEndsAt).getTime() - Date.now() : 0;
  const isTrialExpired = isOnTrial && !!trialEndsAt && msRemaining <= 0;
  const trialDaysRemaining =
    isOnTrial && trialEndsAt ? Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000))) : 0;

  const trialPlanId = (account.trial_plan_id ?? account.plan_id) as keyof typeof PLANS;
  const trialPlanName = PLANS[trialPlanId]?.displayName ?? 'Trial';

  // Compute effective plan and reminder limits per line
  const isTrialActive = isOnTrial && !isTrialExpired;
  const effectivePlanIdRaw = isTrialActive
    ? (account.trial_plan_id ?? account.plan_id ?? 'free_trial')
    : (account.plan_id ?? 'free_trial');
  const effectivePlanId: PlanId = effectivePlanIdRaw in PLANS
    ? (effectivePlanIdRaw as PlanId)
    : 'free_trial';
  const reminderLimitPerLine = PLANS[effectivePlanId]?.remindersPerLine ?? 10;

  const reminderCounts = await Promise.all(
    verifiedLines.map((line) => getPendingReminderCount(line.id)),
  );
  const reminderLimits: Record<string, { limit: number | null; count: number }> = {};
  verifiedLines.forEach((line, i) => {
    reminderLimits[line.id] = { limit: reminderLimitPerLine, count: reminderCounts[i] };
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
            lines={verifiedLines}
            reminders={reminders}
            disabled={isTrialExpired}
            reminderLimits={reminderLimits}
          />
        </div>
      </PageBody>
    </>
  );
}
