'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect } from 'react';

import { ChevronRightIcon } from '@heroicons/react/24/outline';

import isBrowser from '~/core/generic/is-browser';
import { createCheckoutAction } from '~/lib/stripe/actions';
import {
  COMPACT_OUTLINE_BUTTON_CLASS,
  COMPACT_PRIMARY_BUTTON_CLASS,
} from '~/app/dashboard/(app)/components/compact-action-classes';

const CheckoutRedirectButton: React.FCC<{
  disabled?: boolean;
  stripePriceId?: string;
  recommended?: boolean;
  organizationUid: string;
  onCheckoutCreated?: (clientSecret: string) => void;
}> = ({ children, onCheckoutCreated, ...props }) => {
  const [state, formAction] = useFormState(createCheckoutAction, {
    clientSecret: '',
  });

  useEffect(() => {
    if (state.clientSecret && onCheckoutCreated) {
      onCheckoutCreated(state.clientSecret);
    }
  }, [state.clientSecret, onCheckoutCreated]);

  return (
    <form data-cy={'checkout-form'} action={formAction}>
      <CheckoutFormData
        organizationUid={props.organizationUid}
        priceId={props.stripePriceId}
      />

      <SubmitCheckoutButton
        disabled={props.disabled}
        recommended={props.recommended}
      >
        {children}
      </SubmitCheckoutButton>
    </form>
  );
};

export default CheckoutRedirectButton;

function SubmitCheckoutButton(
  props: React.PropsWithChildren<{
    recommended?: boolean;
    disabled?: boolean;
  }>,
) {
  const { pending } = useFormStatus();
  const buttonClassName = props.recommended
    ? COMPACT_PRIMARY_BUTTON_CLASS
    : COMPACT_OUTLINE_BUTTON_CLASS;

  return (
    <button
      className={buttonClassName}
      disabled={props.disabled || pending}
      type="submit"
    >
      <span className={'flex items-center space-x-2'}>
        {pending ? (
          <>
            <span className="w-3 h-3 block animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>{props.children}</span>
          </>
        ) : (
          <span>{props.children}</span>
        )}

        <ChevronRightIcon className={'h-3 w-3'} />
      </span>
    </button>
  );
}

function CheckoutFormData(
  props: React.PropsWithChildren<{
    organizationUid: Maybe<string>;
    priceId: Maybe<string>;
  }>,
) {
  return (
    <>
      <input
        type="hidden"
        name={'organizationUid'}
        defaultValue={props.organizationUid}
      />

      <input type="hidden" name={'returnUrl'} defaultValue={getReturnUrl()} />
      <input type="hidden" name={'priceId'} defaultValue={props.priceId} />
    </>
  );
}

function getReturnUrl() {
  return isBrowser()
    ? [window.location.origin, window.location.pathname].join('')
    : undefined;
}
