'use client';

import { ArrowUpRightIcon } from '@heroicons/react/24/outline';

import { createBillingPortalSessionAction } from '~/lib/stripe/actions';
import Button from '~/core/ui/Button';

const BillingPortalRedirectButton: React.FCC<{
  customerId: string;
  className?: string;
}> = ({ children, customerId, className }) => {
  return (
    <form action={createBillingPortalSessionAction}>
      <input type={'hidden'} name={'customerId'} value={customerId} />

      <Button
        data-cy={'manage-billing-redirect-button'}
        type="submit"
        variant="outline"
        className={className}
      >
        <span>{children}</span>
        <ArrowUpRightIcon className={'h-3 w-3 ml-2'} />
      </Button>
    </form>
  );
};

export default BillingPortalRedirectButton;
