'use client';

import { useCallback, useState } from 'react';
import useMutation from 'swr/mutation';
import { Factor } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Shield, Smartphone, Trash2 } from 'lucide-react';

import useFetchAuthFactors from '~/core/hooks/use-fetch-factors';
import Spinner from '~/core/ui/Spinner';
import Alert from '~/core/ui/Alert';
import If from '~/core/ui/If';
import Badge from '~/core/ui/Badge';
import Button from '~/core/ui/Button';
import Trans from '~/core/ui/Trans';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';

import useSupabase from '~/core/hooks/use-supabase';
import useFactorsMutationKey from '~/core/hooks/use-user-factors-mutation-key';
import { ResponsiveActionMenu } from '~/components/ultaura/ResponsiveActionMenu';
import TableContainer from '~/core/ui/TableContainer';

import SettingsTile from '../../../components/SettingsTile';
import MultiFactorAuthSetupModal from '../../components/MultiFactorAuthSetupModal';
import PhoneMfaSetupModal from '../../components/PhoneMfaSetupModal';
import { clearTrustedDeviceAction } from '~/lib/ultaura/trusted-device-actions';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/core/ui/Table';

const MAX_FACTOR_COUNT = 10;

function MultiFactorAuthenticationSettings() {
  const [isMfaModalOpen, setIsMfaModalOpen] = useState(false);
  const [isPhoneMfaModalOpen, setIsPhoneMfaModalOpen] = useState(false);

  return (
    <div className="pb-12">
      <SettingsTile
        heading={<Trans i18nKey={'profile:multiFactorAuth'} />}
        subHeading={<Trans i18nKey={'profile:multiFactorAuthSubheading'} />}
      >
        <MultiFactorAuthFactorsList
          setIsModalOpen={setIsMfaModalOpen}
          setIsPhoneModalOpen={setIsPhoneMfaModalOpen}
        />
      </SettingsTile>

      <MultiFactorAuthSetupModal
        isOpen={isMfaModalOpen}
        setIsOpen={setIsMfaModalOpen}
      />

      <PhoneMfaSetupModal
        isOpen={isPhoneMfaModalOpen}
        setIsOpen={setIsPhoneMfaModalOpen}
      />
    </div>
  );
}

export default MultiFactorAuthenticationSettings;

function MultiFactorAuthFactorsList({
  setIsModalOpen,
  setIsPhoneModalOpen,
}: {
  setIsModalOpen: (isOpen: boolean) => void;
  setIsPhoneModalOpen: (isOpen: boolean) => void;
}) {
  const { data: factors, isLoading, error } = useFetchAuthFactors();
  const [unEnrolling, setUnenrolling] = useState<string>();

  if (isLoading) {
    return (
      <div className={'flex items-center space-x-4'}>
        <Spinner />

        <div>
          <Trans i18nKey={'profile:loadingFactors'} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Alert type={'error'}>
          <Trans i18nKey={'profile:factorsListError'} />
        </Alert>
      </div>
    );
  }

  const allFactors = factors?.all ?? [];

  if (!allFactors.length) {
    return (
      <EmptyFactorsState
        setIsModalOpen={setIsModalOpen}
        setIsPhoneModalOpen={setIsPhoneModalOpen}
      />
    );
  }

  const canAddNewFactors = allFactors.length < MAX_FACTOR_COUNT;

  return (
    <div className={'flex flex-col space-y-4'}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Authenticated Steps</p>

        <If
          condition={canAddNewFactors}
          fallback={
            <p className="text-sm text-muted-foreground sm:text-right">
              <Trans i18nKey={'profile:maxFactorsReached'} />
            </p>
          }
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              size="small"
              className="w-full sm:w-auto"
              onClick={() => setIsModalOpen(true)}
            >
              <Shield className="mr-2 h-4 w-4" />
              <Trans i18nKey={'profile:setupTotpButtonLabel'} />
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => setIsPhoneModalOpen(true)}
              size="small"
            >
              <Smartphone className="mr-2 h-4 w-4" />
              <Trans i18nKey={'profile:setupPhoneMfaButtonLabel'} />
            </Button>
          </div>
        </If>
      </div>

      <FactorsTable factors={allFactors} setUnenrolling={setUnenrolling} />

      <If condition={unEnrolling}>
        {(factorId) => (
          <ConfirmUnenrollFactorModal
            factorId={factorId}
            setIsModalOpen={() => setUnenrolling(undefined)}
          />
        )}
      </If>
    </div>
  );
}

function EmptyFactorsState({
  setIsModalOpen,
  setIsPhoneModalOpen,
}: {
  setIsModalOpen: (isOpen: boolean) => void;
  setIsPhoneModalOpen: (isOpen: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          size="small"
          className="w-full sm:w-auto"
          onClick={() => setIsModalOpen(true)}
        >
          <Shield className="mr-2 h-4 w-4" />
          <Trans i18nKey={'profile:setupTotpButtonLabel'} />
        </Button>

        <Button
          type="button"
          size="small"
          className="w-full sm:w-auto"
          onClick={() => setIsPhoneModalOpen(true)}
        >
          <Smartphone className="mr-2 h-4 w-4" />
          <Trans i18nKey={'profile:setupPhoneMfaButtonLabel'} />
        </Button>
      </div>

      <TableContainer>
        <div className="flex flex-col gap-5 px-4 py-5 sm:px-5">
          <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Shield className="h-5 w-5" />
          </div>

          <div className="space-y-1.5">
            <p className="text-sm leading-relaxed text-muted-foreground">
              <Trans i18nKey={'profile:multiFactorAuthDescription'} />
            </p>
          </div>
        </div>
        </div>
      </TableContainer>
    </div>
  );
}

function ConfirmUnenrollFactorModal(
  props: React.PropsWithChildren<{
    factorId: string;
    setIsModalOpen: (isOpen: boolean) => void;
  }>,
) {
  const { t } = useTranslation();
  const unEnroll = useUnenrollFactor();

  const onUnenrollRequested = useCallback(
    async (factorId: string) => {
      if (unEnroll.isMutating) return;

      const promise = unEnroll.trigger(factorId).then(async () => {
        props.setIsModalOpen(false);

        // After the unenroll succeeds, also clear trusted device
        try {
          await clearTrustedDeviceAction();
        } catch {
          // Silently ignore — trusted device cleanup is best-effort
        }
      });

      toast.promise(promise, {
        loading: t(`profile:unenrollingFactor`),
        success: t(`profile:unenrollFactorSuccess`),
        error: t(`profile:unenrollFactorError`),
      });
    },
    [props, t, unEnroll],
  );

  return (
    <ConfirmationDialog
      open={!!props.factorId}
      onOpenChange={props.setIsModalOpen}
      title={t('profile:unenrollFactorModalHeading')}
      description={t('profile:unenrollFactorModalBody')}
      confirmLabel={t('profile:unenrollFactorModalButtonLabel')}
      cancelLabel={t('common:cancel')}
      variant="destructive"
      onConfirm={() => onUnenrollRequested(props.factorId)}
    />
  );
}

function FactorsTable({
  setUnenrolling,
  factors,
}: React.PropsWithChildren<{
  setUnenrolling: (factorId: string) => void;
  factors: Factor[];
}>) {
  return (
    <TableContainer>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Trans i18nKey={'profile:factorName'} />
            </TableHead>
            <TableHead>
              <Trans i18nKey={'profile:factorType'} />
            </TableHead>
            <TableHead>
              <Trans i18nKey={'profile:factorStatus'} />
            </TableHead>

            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {factors.map((factor) => (
            <TableRow key={factor.id}>
              <TableCell>
                <span className={'block truncate'}>{factor.friendly_name}</span>
              </TableCell>

              <TableCell>
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {factor.factor_type === 'phone' ? (
                    <Trans i18nKey={'profile:factorTypeSms'} />
                  ) : (
                    <Trans i18nKey={'profile:factorTypeTotp'} />
                  )}
                </span>
              </TableCell>

              <TableCell>
                <Badge
                  size={'small'}
                  className={'inline-flex capitalize'}
                  color={factor.status === 'verified' ? 'success' : 'normal'}
                >
                  {factor.status}
                </Badge>
              </TableCell>

              <TableCell className="text-right">
                <div className="flex justify-end">
                  <ResponsiveActionMenu
                    title={factor.friendly_name ?? 'Factor actions'}
                    actions={[
                      {
                        label: 'Remove',
                        icon: <Trash2 className="h-5 w-5" />,
                        onClick: () => setUnenrolling(factor.id),
                        variant: 'destructive',
                      },
                    ]}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function useUnenrollFactor() {
  const client = useSupabase();
  const key = useFactorsMutationKey();

  return useMutation(key, async (_, { arg: factorId }: { arg: string }) => {
    const { data, error } = await client.auth.mfa.unenroll({
      factorId,
    });

    if (error) {
      throw error;
    }

    return data;
  });
}
