import Plans from './components/Plans';
import PlansStatusAlertContainer from './components/PlanStatusAlertContainer';
import { withI18n } from '~/i18n/with-i18n';
import { loadAppDataForUser } from '~/lib/server/loaders/load-app-data';
import { getUltauraAccount } from '~/lib/ultaura/accounts';
import { PLANS } from '~/lib/ultaura/constants';
import { getTrialStatus } from '~/lib/ultaura/helpers';
import { TrialStatusCard } from './components/TrialStatusCard';

export const metadata = {
  title: 'Subscription',
};

async function SubscriptionSettingsPage() {
  const appData = await loadAppDataForUser();
  const organizationId = appData.organization?.id;
  const account = organizationId
    ? await getUltauraAccount(organizationId)
    : null;

  const trialStatus = account ? getTrialStatus(account) : null;
  const isOnTrial = trialStatus?.isOnTrial ?? false;
  const isTrialExpired = trialStatus?.isExpired ?? false;
  const trialEndsAt = trialStatus?.trialEndsAt ?? null;
  const trialDaysRemaining = trialStatus?.daysRemaining ?? 0;
  const trialHoursRemaining = trialEndsAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(trialEndsAt).getTime() - Date.now()) / (60 * 60 * 1000),
        ),
      )
    : 0;

  const trialPlanId = (trialStatus?.trialPlanId ??
    account?.plan_id ??
    'comfort') as keyof typeof PLANS;
  const trialPlan = PLANS[trialPlanId];

  return (
    <div className={'flex w-full flex-col space-y-4 pb-12'}>
      <PlansStatusAlertContainer />

      {/* Show trial status card if on active trial */}
      {isOnTrial && !isTrialExpired && trialPlan && (
        <TrialStatusCard
          planName={trialPlan.displayName}
          daysRemaining={trialDaysRemaining}
          hoursRemaining={trialHoursRemaining}
          trialEndsAt={trialEndsAt}
          minutesIncluded={
            trialPlanId === 'payg' || trialPlanId === 'free_trial'
              ? 'Unlimited'
              : trialPlan.minutesIncluded
          }
          linesIncluded={trialPlan.linesIncluded}
        />
      )}

      <Plans />
    </div>
  );
}

export default withI18n(SubscriptionSettingsPage);
