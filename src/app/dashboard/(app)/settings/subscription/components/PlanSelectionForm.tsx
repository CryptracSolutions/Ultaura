'use client';

import React from 'react';

import type Organization from '~/lib/organizations/types/organization';
import { canChangeBilling } from '~/lib/organizations/permissions';

import If from '~/core/ui/If';
import Trans from '~/core/ui/Trans';
import Alert from '~/core/ui/Alert';

import { UltauraPricingTable } from '~/components/ultaura/PricingTable';
import IfHasPermissions from '~/components/IfHasPermissions';
import BillingPortalRedirectButton from '../components/BillingRedirectButton';

const PlanSelectionForm: React.FCC<{
  organization: WithId<Organization>;
  customerId: Maybe<string>;
}> = ({ organization, customerId }) => {
  return (
    <div className={'flex flex-col space-y-6 pb-12'}>
      <IfHasPermissions
        condition={canChangeBilling}
        fallback={<NoPermissionsAlert />}
      >
        <div className={'flex w-full flex-col space-y-8 justify-center'}>
          <UltauraPricingTable organizationUid={organization.uuid} />

          <If condition={customerId}>
            <div className={'flex flex-col space-y-2'}>
              <BillingPortalRedirectButton customerId={customerId as string}>
                <Trans i18nKey={'subscription:manageBilling'} />
              </BillingPortalRedirectButton>

              <span className={'text-xs text-gray-500 dark:text-gray-400'}>
                <Trans i18nKey={'subscription:manageBillingDescription'} />
              </span>
            </div>
          </If>
        </div>
      </IfHasPermissions>
    </div>
  );
};

export default PlanSelectionForm;

function NoPermissionsAlert() {
  return (
    <Alert type={'warn'}>
      <Alert.Heading>
        <Trans i18nKey={'subscription:noPermissionsAlertHeading'} />
      </Alert.Heading>

      <Trans i18nKey={'subscription:noPermissionsAlertBody'} />
    </Alert>
  );
}

