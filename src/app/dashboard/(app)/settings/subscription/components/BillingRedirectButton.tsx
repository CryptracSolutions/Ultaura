'use client';

import { ArrowUpRightIcon } from '@heroicons/react/24/outline';

import { createBillingPortalSessionAction } from '~/lib/stripe/actions';
import Button from '~/core/ui/Button';

const BillingPortalRedirectButton: React.FCC<{
  customerId: string;
  className?: string;
}> = ({ children, customerId, className }) => {
  const buttonClassName = ['w-full sm:w-auto', className].filter(Boolean).join(' ');

  return (
    <form action={createBillingPortalSessionAction} className="w-full sm:w-auto">
      <input type={'hidden'} name={'customerId'} value={customerId} />

      <Button
        data-cy={'manage-billing-redirect-button'}
        type="submit"
        variant="default"
        size="small"
        className={buttonClassName}
      >
        <span>{children}</span>
        <ArrowUpRightIcon className={'h-3 w-3 ml-2'} />
      </Button>
    </form>
  );
};

export default BillingPortalRedirectButton;
