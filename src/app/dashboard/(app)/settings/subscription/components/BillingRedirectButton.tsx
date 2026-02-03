'use client';

import { ArrowUpRightIcon } from '@heroicons/react/24/outline';

import { createBillingPortalSessionAction } from '~/lib/stripe/actions';
import { COMPACT_OUTLINE_BUTTON_CLASS } from '~/app/dashboard/(app)/components/compact-action-classes';

const BillingPortalRedirectButton: React.FCC<{
  customerId: string;
  className?: string;
}> = ({ children, customerId, className }) => {
  return (
    <form action={createBillingPortalSessionAction}>
      <input type={'hidden'} name={'customerId'} value={customerId} />

      <button
        data-cy={'manage-billing-redirect-button'}
        type="submit"
        className={[COMPACT_OUTLINE_BUTTON_CLASS, className]
          .filter(Boolean)
          .join(' ')}
      >
        <span className={'flex items-center space-x-2'}>
          <span>{children}</span>

          <ArrowUpRightIcon className={'h-3 w-3'} />
        </span>
      </button>
    </form>
  );
};

export default BillingPortalRedirectButton;
