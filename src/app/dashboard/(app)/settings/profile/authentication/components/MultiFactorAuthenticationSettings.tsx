'use client';

import { useCallback, useState } from 'react';
import useMutation from 'swr/mutation';
import { Factor } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { Info, Shield, Smartphone } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '~/core/ui/Tooltip';

import useFetchAuthFactors from '~/core/hooks/use-fetch-factors';
import Spinner from '~/core/ui/Spinner';
import Alert from '~/core/ui/Alert';
import If from '~/core/ui/If';
import Modal from '~/core/ui/Modal';
import Badge from '~/core/ui/Badge';
import Button from '~/core/ui/Button';
import Trans from '~/core/ui/Trans';

import useSupabase from '~/core/hooks/use-supabase';
import useFactorsMutationKey from '~/core/hooks/use-user-factors-mutation-key';

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
      <div className={'flex flex-col space-y-4'}>
        <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3.5">
          <Info className="h-[18px] w-[18px] text-primary flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs text-primary leading-snug">
              <Trans i18nKey={'profile:multiFactorAuthDescription'} />
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row">
          <Button onClick={() => setIsModalOpen(true)} size="small">
            <Shield className="h-4 w-4 mr-2" />
            <Trans i18nKey={'profile:setupTotpButtonLabel'} />
          </Button>
          <Button
            onClick={() => setIsPhoneModalOpen(true)}
            size="small"
          >
            <Smartphone className="h-4 w-4 mr-2" />
            <Trans i18nKey={'profile:setupPhoneMfaButtonLabel'} />
          </Button>
        </div>
      </div>
    );
  }

  const canAddNewFactors = allFactors.length < MAX_FACTOR_COUNT;

  return (
    <div className={'flex flex-col space-y-4'}>
      <FactorsTable factors={allFactors} setUnenrolling={setUnenrolling} />

      <If
        condition={canAddNewFactors}
        fallback={
          <p className="text-sm text-muted-foreground">
            <Trans i18nKey={'profile:maxFactorsReached'} />
          </p>
        }
      >
        <div className="flex flex-col gap-3 md:flex-row">
          <Button onClick={() => setIsModalOpen(true)} size="small">
            <Shield className="h-4 w-4 mr-2" />
            <Trans i18nKey={'profile:setupTotpButtonLabel'} />
          </Button>
          <Button
            onClick={() => setIsPhoneModalOpen(true)}
            size="small"
          >
            <Smartphone className="h-4 w-4 mr-2" />
            <Trans i18nKey={'profile:setupPhoneMfaButtonLabel'} />
          </Button>
        </div>
      </If>

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
    <Modal
      heading={<Trans i18nKey={'profile:unenrollFactorModalHeading'} />}
      isOpen={!!props.factorId}
      setIsOpen={props.setIsModalOpen}
    >
      <div className={'flex flex-col space-y-4'}>
        <div className={'text-sm'}>
          <Trans i18nKey={'profile:unenrollFactorModalBody'} />
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            type="button"
            onClick={() => props.setIsModalOpen(false)}
            disabled={unEnroll.isMutating}
          >
            <Trans i18nKey={'common:cancel'} />
          </Button>

          <Button
            variant="destructive"
            type="button"
            onClick={() => onUnenrollRequested(props.factorId)}
            disabled={unEnroll.isMutating}
            loading={unEnroll.isMutating}
          >
            <Trans i18nKey={'profile:unenrollFactorModalButtonLabel'} />
          </Button>
        </div>
      </div>
    </Modal>
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

          <TableHead />
        </TableRow>
      </TableHeader>

      <TableBody>
        {factors.map((factor) => (
          <TableRow key={factor.id}>
            <TableCell>
              <span className={'block truncate'}>{factor.friendly_name}</span>
            </TableCell>

            <TableCell>
              <Badge size={'small'} className={'inline-flex uppercase'}>
                {factor.factor_type === 'phone' ? (
                  <Trans i18nKey={'profile:factorTypeSms'} />
                ) : (
                  <Trans i18nKey={'profile:factorTypeTotp'} />
                )}
              </Badge>
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

            <TableCell className={'flex justify-end'}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setUnenrolling(factor.id)}
                  >
                    <XMarkIcon className={'h-4'} />
                  </Button>
                </TooltipTrigger>

                <TooltipContent>
                  <Trans i18nKey={'profile:unenrollTooltip'} />
                </TooltipContent>
              </Tooltip>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
