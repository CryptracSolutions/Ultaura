'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import useCurrentOrganization from '~/lib/organizations/hooks/use-current-organization';

import If from '~/core/ui/If';
import Trans from '~/core/ui/Trans';
import { Section, SectionBody, SectionHeader } from '~/core/ui/Section';

import SubscriptionCard from './SubscriptionCard';
import SubscriptionStatusAlert from './SubscriptionStatusAlert';
import SubscriptionStatusBadge from '~/app/dashboard/(app)/components/organizations/SubscriptionStatusBadge';

import { canChangeBilling } from '~/lib/organizations/permissions';
import PlanSelectionForm from '~/app/dashboard/(app)/settings/subscription/components/PlanSelectionForm';
import IfHasPermissions from '~/components/IfHasPermissions';
import BillingPortalRedirectButton from '~/app/dashboard/(app)/settings/subscription/components/BillingRedirectButton';

const Plans: React.FC = () => {
  const organization = useCurrentOrganization();
  const { i18n } = useTranslation();

  const subscription = organization?.subscription?.data;
  const customerId = organization?.subscription?.customerId;

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
        <Section>
          <SectionHeader
            title={
              <div className={'flex items-center justify-between gap-3'}>
                <span>
                  <Trans i18nKey={'common:subscriptionSettingsTabLabel'} />
                </span>
                <SubscriptionStatusBadge subscription={subscription} />
              </div>
            }
            description={
              <SubscriptionStatusAlert subscription={subscription} values={dates} />
            }
          />

          <SectionBody className={'space-y-4'}>
            <SubscriptionCard subscription={subscription} />
          </SectionBody>

          <IfHasPermissions condition={canChangeBilling}>
            <If condition={customerId}>
              <div
                className={
                  'flex flex-col items-start gap-2 px-container pt-container pb-container sm:items-end'
                }
              >
                <BillingPortalRedirectButton customerId={customerId as string}>
                  <Trans i18nKey={'subscription:manageBilling'} />
                </BillingPortalRedirectButton>

                <span className={'text-xs text-gray-500 dark:text-gray-400 sm:text-right'}>
                  <Trans i18nKey={'subscription:manageBillingDescription'} />
                </span>
              </div>
            </If>
          </IfHasPermissions>
        </Section>
      </div>
    </div>
  );
};

export default Plans;
