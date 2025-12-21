'use client';

import { useCallback, useMemo, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import Button from '~/core/ui/Button';
import Heading from '~/core/ui/Heading';
import Trans from '~/core/ui/Trans';

import { setCookie, getCookie } from '~/core/generic/cookies';
import isBrowser from '~/core/generic/is-browser';

// configure this as you wish
const COOKIE_CONSENT_STATUS = 'cookie_consent_status';

enum ConsentStatus {
  Accepted = 'accepted',
  Rejected = 'rejected',
  Unknown = 'unknown',
}

function CookieBanner() {
  const { status, accept, reject } = useCookieConsent();

  if (status !== ConsentStatus.Unknown) {
    return null;
  }

  return (
    <DialogPrimitive.Root open modal={false}>
      <DialogPrimitive.Content
        className={`fixed shadow-2xl dark:shadow-primary-500/40 w-full
             max-w-lg lg:h-48 bottom-0 lg:bottom-[2rem] lg:left-[2rem]
             lg:rounded-lg border border-gray-200 bg-background dark:border-dark-800
             p-6 zoom-in-95 fade-in animate-in slide-in-from-bottom-16 duration-1000`}
      >
        <div className={'flex flex-col space-y-4'}>
          <div>
            <Heading type={3}>
              <Trans i18nKey={'cookieBanner.title'} />
            </Heading>
          </div>

          <div className={'text-gray-500 dark:text-gray-400'}>
            <Trans i18nKey={'cookieBanner.description'} />
          </div>

          <div className={'flex space-x-2.5 justify-end'}>
            <Button variant={'ghost'} onClick={reject}>
              <Trans i18nKey={'cookieBanner.reject'} />
            </Button>

            <Button autoFocus onClick={accept}>
              <Trans i18nKey={'cookieBanner.accept'} />
            </Button>
          </div>
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Root>
  );
}

export default CookieBanner;

export function useCookieConsent() {
  const initialState = loadConsentStatusFromCookies();
  const [status, setStatus] = useState<ConsentStatus>(initialState);

  const accept = useCallback(() => {
    const status = ConsentStatus.Accepted;

    setStatus(status);
    setCookieValue(status);
  }, []);

  const reject = useCallback(() => {
    const status = ConsentStatus.Rejected;

    setStatus(status);
    setCookieValue(status);
  }, []);

  const clear = useCallback(() => {
    const status = ConsentStatus.Unknown;

    setStatus(status);
    setCookieValue(status);
  }, []);

  return useMemo(() => {
    return {
      clear,
      status,
      accept,
      reject,
    };
  }, [clear, status, accept, reject]);
}

function loadConsentStatusFromCookies() {
  if (!isBrowser()) {
    return ConsentStatus.Unknown;
  }

  const status = getCookie(COOKIE_CONSENT_STATUS) as Maybe<ConsentStatus>;

  return status || ConsentStatus.Unknown;
}

function setCookieValue(status: ConsentStatus) {
  setCookie(COOKIE_CONSENT_STATUS, status, {
    path: '/',
    sameSite: 'strict',
  });
}
