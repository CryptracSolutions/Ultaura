import Trans from '~/core/ui/Trans';

import Plans from './components/Plans';
import PlansStatusAlertContainer from './components/PlanStatusAlertContainer';
import { withI18n } from '~/i18n/with-i18n';
import Heading from '~/core/ui/Heading';
import { loadAppDataForUser } from '~/lib/server/loaders/load-app-data';
import { getUltauraAccount } from '~/lib/ultaura/accounts';
import { PLANS } from '~/lib/ultaura/constants';
import { TrialStatusCard } from './components/TrialStatusCard';

export const metadata = {
  title: 'Subscription',
};

async function SubscriptionSettingsPage() {
  // Fetch Ultaura account for trial status
  const appData = await loadAppDataForUser();
  const organizationId = appData.organization?.id;
  const account = organizationId ? await getUltauraAccount(organizationId) : null;

  // Calculate trial status
  const isOnTrial = account?.status === 'trial';
  const trialEndsAt = account?.trial_ends_at ?? null;
  const msRemaining = trialEndsAt ? new Date(trialEndsAt).getTime() - Date.now() : 0;
  const isTrialExpired = isOnTrial && !!trialEndsAt && msRemaining <= 0;
  const trialDaysRemaining = isOnTrial && trialEndsAt
    ? Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)))
    : 0;
  const trialHoursRemaining = isOnTrial && trialEndsAt
    ? Math.max(0, Math.ceil(msRemaining / (60 * 60 * 1000)))
    : 0;

  const trialPlanId = (account?.trial_plan_id ?? account?.plan_id ?? 'comfort') as keyof typeof PLANS;
  const trialPlan = PLANS[trialPlanId];

  return (
    <div className={'flex flex-col space-y-4 w-full pb-12'}>
      <div className={'flex flex-col px-2 space-y-1'}>
        <Heading type={4}>
          <Trans i18nKey={'common:subscriptionSettingsTabLabel'} />
        </Heading>

        <span className={'text-gray-500 dark:text-gray-400'}>
          <Trans i18nKey={'subscription:subscriptionTabSubheading'} />
        </span>
      </div>

      <PlansStatusAlertContainer />

      {/* Show trial status card if on active trial */}
      {isOnTrial && !isTrialExpired && trialPlan && (
        <TrialStatusCard
          planName={trialPlan.displayName}
          daysRemaining={trialDaysRemaining}
          hoursRemaining={trialHoursRemaining}
          trialEndsAt={trialEndsAt}
          minutesIncluded={trialPlanId === 'payg' ? 'Unlimited' : trialPlan.minutesIncluded}
          linesIncluded={trialPlan.linesIncluded}
        />
      )}

      <Plans />
    </div>
  );
}

export default withI18n(SubscriptionSettingsPage);
