'use client';

import { useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import Trans from '~/core/ui/Trans';
import Button from '~/core/ui/Button';

import useSignOut from '~/core/hooks/use-sign-out';
import useRefresh from '~/core/hooks/use-refresh';
import { acceptInviteAction } from '~/lib/memberships/actions';

function ExistingUserInviteForm(props: {
  email: string;
  code: string;
  mode?: 'accept' | 'wrongAccount';
  invitedEmail?: string;
}) {
  const router = useRouter();
  const signOut = useSignOut();
  const refresh = useRefresh();
  const [isSubmitting, startTransition] = useTransition();

  const onSignOut = useCallback(async () => {
    await signOut();
    refresh();
  }, [refresh, signOut]);

  const onInviteAccepted = useCallback(async () => {
    return startTransition(async () => {
      try {
        const result = await acceptInviteAction({
          code: props.code,
          redirectOnSuccess: false,
        });

        router.replace(result.destination);
      } catch {
        router.replace('/auth/invite-error');
      }
    });
  }, [props.code, router, startTransition]);

  const isWrongAccount = props.mode === 'wrongAccount';

  return (
    <>
      <div className={'flex flex-col space-y-4'}>
        {!isWrongAccount ? (
          <>
            <p className={'text-center text-sm'}>
              <Trans
                i18nKey={'auth:clickToAcceptAs'}
                values={{ email: props.email }}
                components={{ b: <b /> }}
              />
            </p>

            <Button
              block
              loading={isSubmitting}
              onClick={onInviteAccepted}
              data-cy={'accept-invite-submit-button'}
              type={'submit'}
            >
              <Trans i18nKey={'auth:acceptInvite'} />
            </Button>
          </>
        ) : (
          <div className={'space-y-2 text-center'}>
            <p className={'text-sm font-medium'}>
              This invite is for{' '}
              <span className={'font-semibold'}>
                {props.invitedEmail || 'another account'}
              </span>
              .
            </p>
            <p className={'text-sm text-muted-foreground'}>
              Sign out and continue with that email to access the shared
              dashboard.
            </p>
          </div>
        )}

        <div>
          <div className={'flex flex-col space-y-4'}>
            <p className={'text-center'}>
              <span
                className={
                  'text-center text-sm text-gray-700 dark:text-gray-300'
                }
              >
                <Trans i18nKey={'auth:acceptInviteWithDifferentAccount'} />
              </span>
            </p>

            <div className={'flex justify-center'}>
              <Button
                data-cy={'invite-sign-out-button'}
                disabled={isSubmitting}
                variant={'ghost'}
                size={'sm'}
                onClick={onSignOut}
                type={'button'}
              >
                <Trans i18nKey={'auth:signOut'} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default ExistingUserInviteForm;
