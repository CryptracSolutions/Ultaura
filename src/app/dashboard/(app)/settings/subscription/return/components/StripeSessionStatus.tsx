'use client';

import type { Stripe } from 'stripe';
import { CheckIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

import Heading from '~/core/ui/Heading';
import Trans from '~/core/ui/Trans';
import configuration from '~/configuration';
import { COMPACT_OUTLINE_BUTTON_CLASS } from '~/app/dashboard/(app)/components/compact-action-classes';

/**
 * Retrieves the session status for a Stripe checkout session.
 * Since we should only arrive here for a successful checkout, we only check
 * for the `paid` status.
 *
 * @param {Stripe.Checkout.Session['status']} status - The status of the Stripe checkout session.
 * @param {string} customerEmail - The email address of the customer associated with the session.
 *
 * @returns {ReactElement} - The component to render based on the session status.
 */
export function StripeSessionStatus({
  customerEmail,
}: React.PropsWithChildren<{
  status: Stripe.Checkout.Session['status'];
  customerEmail: string;
}>) {
  return <SuccessSessionStatus customerEmail={customerEmail} />;
}

function SuccessSessionStatus({
  customerEmail,
}: React.PropsWithChildren<{
  customerEmail: string;
}>) {
  return (
    <section
      data-cy={'payment-return-success'}
      className={
        'max-w-xl mx-auto rounded-xl p-16 fade-in xl:drop-shadow-sm border' +
        ' border-gray-100 dark:border-dark-800' +
        ' bg-background animate-in ease-out slide-in-from-bottom-8' +
        ' zoom-in-50 duration-1000'
      }
    >
      <div
        className={
          'flex flex-col space-y-4 items-center justify-center text-center'
        }
      >
        <CheckIcon
          className={
            'w-16 bg-green-500 p-1 text-white rounded-full ring-8' +
            ' ring-green-500/30 dark:ring-green-500/50'
          }
        />

        <Heading type={3}>
          <span className={'font-semibold mr-4'}>
            <Trans i18nKey={'subscription:checkoutSuccessTitle'} />
          </span>
          🎉
        </Heading>

        <div
          className={'flex flex-col space-y-4 text-gray-500 dark:text-gray-400'}
        >
          <p>
            <Trans
              i18nKey={'subscription:checkoutSuccessDescription'}
              values={{ customerEmail }}
            />
          </p>
        </div>

        <Link
          data-cy={'checkout-success-back-button'}
          href={configuration.paths.appHome}
          className={COMPACT_OUTLINE_BUTTON_CLASS}
        >
          <span className={'flex space-x-2.5 items-center'}>
            <span>
              <Trans i18nKey={'subscription:checkoutSuccessBackButton'} />
            </span>

            <ChevronRightIcon className={'h-3 w-3'} />
          </span>
        </Link>
      </div>
    </section>
  );
}
