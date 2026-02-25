'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import useCurrentOrganization from '~/lib/organizations/hooks/use-current-organization';

import If from '~/core/ui/If';
import Trans from '~/core/ui/Trans';
import Heading from '~/core/ui/Heading';

import SubscriptionCard, { useSubscriptionPlanDetails } from './SubscriptionCard';
import SubscriptionStatusAlert from './SubscriptionStatusAlert';
import PricingTable from '~/components/PricingTable';

import { canChangeBilling } from '~/lib/organizations/permissions';
import PlanSelectionForm from '~/app/dashboard/(app)/settings/subscription/components/PlanSelectionForm';
import IfHasPermissions from '~/components/IfHasPermissions';
import BillingPortalRedirectButton from '~/app/dashboard/(app)/settings/subscription/components/BillingRedirectButton';

const Plans: React.FC = () => {
  const organization = useCurrentOrganization();
  const { i18n } = useTranslation();

  const subscription = organization?.subscription?.data;
  const customerId = organization?.subscription?.customerId;
  const planDetails = useSubscriptionPlanDetails(subscription?.priceId ?? '');

  const dates = useMemo(() => {
    if (!subscription) return { endDate: '', trialEndDate: null };
    const endDate = new Date(subscription.periodEndsAt).toLocaleDateString(i18n.language);
    const trialEndDate = subscription.trialEndsAt
      ? new Date(subscription.trialEndsAt).toLocaleDateString(i18n.language)
      : null;
    return { endDate, trialEndDate };
  }, [subscription, i18n.language]);

  if (!organization) {
    return null;
  }

  if (!subscription) {
    return (
      <PlanSelectionForm customerId={customerId} organization={organization} />
    );
  }

  return (
    <div className={'flex flex-col space-y-4 pb-12'}>
      <div>
        <div
          className={'border w-full rounded-md divide-y divide-border bg-white dark:bg-[#383739]'}
        >
          <div className={'p-6'}>
            <div className={'flex items-start justify-between mb-4'}>
              <div className={'flex flex-col space-y-1'}>
                <Heading type={4}>
                  <Trans i18nKey={'common:subscriptionSettingsTabLabel'} />
                </Heading>

                <SubscriptionStatusAlert subscription={subscription} values={dates} />
              </div>

              {planDetails && (
                <span className={'hidden sm:flex items-center space-x-1 shrink-0'}>
                  <PricingTable.Price>{planDetails.plan.price}</PricingTable.Price>

                  <span className={'lowercase text-gray-500 dark:text-gray-400'}>
                    /{planDetails.plan.name}
                  </span>
                </span>
              )}
            </div>

            <SubscriptionCard subscription={subscription} />
          </div>

          <IfHasPermissions condition={canChangeBilling}>
            <If condition={customerId}>
              <div className={'flex justify-start p-6 sm:justify-end'}>
                <div className={'flex flex-col space-y-2 items-start sm:items-end'}>
                  <BillingPortalRedirectButton
                    customerId={customerId as string}
                  >
                    <Trans i18nKey={'subscription:manageBilling'} />
                  </BillingPortalRedirectButton>

                  <span className={'text-xs text-gray-500 dark:text-gray-400'}>
                    <Trans i18nKey={'subscription:manageBillingDescription'} />
                  </span>
                </div>
              </div>
            </If>
          </IfHasPermissions>
        </div>
      </div>
    </div>
  );
};

export default Plans;
