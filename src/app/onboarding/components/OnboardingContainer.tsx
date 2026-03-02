'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import If from '~/core/ui/If';
import Alert from '~/core/ui/Alert';
import Button from '~/core/ui/Button';
import CsrfTokenContext from '~/lib/contexts/csrf';
import Stepper from '~/core/ui/Stepper';

import OrganizationInfoStep, {
  OrganizationInfoStepData,
} from './OrganizationInfoStep';

import PlanSelectionStep from './PlanSelectionStep';

import CompleteOnboardingStep from './CompleteOnboardingStep';
import OrganizationInvitesStep from '~/app/onboarding/components/OrganizationInvitesStep';
import MembershipRole from '~/lib/organizations/types/membership-role';
import type { PlanId, UserType } from '~/lib/ultaura/types';
import UserTypeStep, { UserTypeStepData } from './UserTypeStep';
import PhoneCollectionStep, {
  PhoneCollectionStepData,
} from './PhoneCollectionStep';
import BirthdayStep, { BirthdayStepData } from './BirthdayStep';
import LovedOneSetupStep, { LovedOneSetupStepData } from './LovedOneSetupStep';
import VoiceSelectionStep, {
  VoiceSelectionStepData,
} from './VoiceSelectionStep';
import { DEFAULT_GROK_VOICE, type GrokVoice } from '~/lib/ultaura/voices';
import { createOnboardingCheckout } from '~/lib/ultaura/checkout';
import {
  consumeOnboardingState,
  persistOnboardingState,
} from '~/lib/ultaura/onboarding-state';
import {
  getStepsForUserType,
  resolveCheckoutReturnResolution,
} from './checkout-return';

type Invite = {
  email: string;
  role: MembershipRole;
};

type BillingInterval = 'monthly' | 'annual';

type OnboardingFormData = {
  userType: UserType | null;
  organization: string;
  selectedPlanId: PlanId;
  invites: Invite[];
  selfPhoneE164: string;
  selfTimezone: string;
  selfBirthday: { month: number; day: number } | null;
  selfBirthYear: number | null;
  selfGender: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say' | null;
  lovedOneName: string;
  lovedOnePhoneE164: string;
  lovedOneTimezone: string;
  lovedOneBirthYear: number | null;
  lovedOneGender: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say' | null;
  preferredGrokVoice: GrokVoice;
  stripeSessionId: string | null;
};

type OnboardingFormValues = {
  data: OnboardingFormData;
  currentStep: number;
};

export type StoredOnboardingState = {
  currentStep: number;
  data: OnboardingFormData;
  billingInterval?: BillingInterval;
  selectedPlanId?: string;
  stripeSessionId?: string;
};

const SESSION_STORAGE_KEY = 'ultaura:onboarding-state:v2';
const DEFAULT_BILLING_INTERVAL: BillingInterval = 'monthly';

const DEFAULT_DATA: OnboardingFormData = {
  userType: null,
  organization: '',
  selectedPlanId: 'comfort',
  invites: [],
  selfPhoneE164: '',
  selfTimezone: 'America/Los_Angeles',
  selfBirthday: null,
  selfBirthYear: null,
  selfGender: null,
  lovedOneName: '',
  lovedOnePhoneE164: '',
  lovedOneTimezone: 'America/Los_Angeles',
  lovedOneBirthYear: null,
  lovedOneGender: null,
  preferredGrokVoice: DEFAULT_GROK_VOICE,
  stripeSessionId: null,
};

function getOptionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function getNullableString(value: unknown) {
  return getOptionalString(value) ?? null;
}

function sanitizeLoadedState(value: unknown): StoredOnboardingState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const state = value as Partial<StoredOnboardingState>;

  if (!state.data || typeof state.data !== 'object') {
    return null;
  }

  if (
    typeof state.currentStep !== 'number' ||
    Number.isNaN(state.currentStep)
  ) {
    return null;
  }

  const data = state.data as Partial<OnboardingFormData>;

  return {
    currentStep: Math.max(0, Math.floor(state.currentStep)),
    data: {
      ...DEFAULT_DATA,
      ...data,
      stripeSessionId: getNullableString(data.stripeSessionId),
    },
    billingInterval:
      state.billingInterval === 'annual' || state.billingInterval === 'monthly'
        ? state.billingInterval
        : undefined,
    selectedPlanId: getOptionalString(state.selectedPlanId),
    stripeSessionId: getOptionalString(state.stripeSessionId),
  };
}

function getSessionStorageState() {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return sanitizeLoadedState(JSON.parse(raw));
  } catch {
    return null;
  }
}

function setSessionStorageState(state: StoredOnboardingState) {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state));
}

function clearCheckoutQueryParams() {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.delete('checkout_success');
  url.searchParams.delete('session_id');
  url.searchParams.delete('state');
  url.searchParams.delete('canceled');

  window.history.replaceState(
    {},
    '',
    `${url.pathname}${url.search}${url.hash}`,
  );
}

function OnboardingContainer(
  props: React.PropsWithChildren<{
    csrfToken: string | null;
  }>,
) {
  const searchParams = useSearchParams();
  const checkoutReturnHandledRef = useRef(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [isRestoringReturnState, setIsRestoringReturnState] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [showRestartState, setShowRestartState] = useState(false);
  const form = useForm<OnboardingFormValues>({
    defaultValues: {
      data: DEFAULT_DATA,
      currentStep: 0,
    },
  });

  const nextStep = useCallback(() => {
    form.setValue('currentStep', form.getValues('currentStep') + 1);
  }, [form]);

  const prevStep = useCallback(() => {
    const current = form.getValues('currentStep');
    if (current > 0) {
      form.setValue('currentStep', current - 1);
    }
  }, [form]);

  const applyRestoredState = useCallback(
    (state: StoredOnboardingState) => {
      form.reset({
        currentStep: state.currentStep,
        data: {
          ...DEFAULT_DATA,
          ...state.data,
          selectedPlanId:
            (state.selectedPlanId as PlanId | undefined) ??
            state.data.selectedPlanId,
          stripeSessionId:
            state.stripeSessionId ?? state.data.stripeSessionId ?? null,
        },
      });
    },
    [form],
  );

  const onInfoStepSubmitted = useCallback(
    (organizationInfo: OrganizationInfoStepData) => {
      form.setValue('data.organization', organizationInfo.organization);
      nextStep();
    },
    [form, nextStep],
  );

  const onUserTypeSubmitted = useCallback(
    (data: UserTypeStepData) => {
      const defaultPlan: PlanId = data.userType === 'self' ? 'care' : 'comfort';
      form.setValue('data.userType', data.userType);
      form.setValue('data.selectedPlanId', defaultPlan);
      nextStep();
    },
    [form, nextStep],
  );

  const onPhoneStepSubmitted = useCallback(
    (data: PhoneCollectionStepData) => {
      form.setValue('data.selfPhoneE164', data.phoneE164);
      form.setValue('data.selfTimezone', data.timezone);
      nextStep();
    },
    [form, nextStep],
  );

  const onBirthdayStepSubmitted = useCallback(
    (data: BirthdayStepData) => {
      form.setValue('data.selfBirthday', data.birthday);
      form.setValue('data.selfBirthYear', data.birthYear);
      form.setValue('data.selfGender', data.gender);
      nextStep();
    },
    [form, nextStep],
  );

  const onLovedOneStepSubmitted = useCallback(
    (data: LovedOneSetupStepData) => {
      form.setValue('data.lovedOneName', data.lovedOneName);
      form.setValue('data.lovedOnePhoneE164', data.lovedOnePhoneE164);
      form.setValue('data.lovedOneTimezone', data.lovedOneTimezone);
      form.setValue('data.lovedOneBirthYear', data.lovedOneBirthYear);
      form.setValue('data.lovedOneGender', data.lovedOneGender);
      nextStep();
    },
    [form, nextStep],
  );

  const onVoiceSelectionSubmitted = useCallback(
    (data: VoiceSelectionStepData) => {
      form.setValue('data.preferredGrokVoice', data.preferredGrokVoice);
      nextStep();
    },
    [form, nextStep],
  );

  const onPlanStepSubmitted = useCallback(
    async (planId: PlanId) => {
      setCheckoutError(null);
      setShowRestartState(false);
      setIsStartingCheckout(true);
      form.setValue('data.selectedPlanId', planId);
      form.setValue('data.stripeSessionId', null);

      const currentValues = form.getValues();
      const stateToPersist: StoredOnboardingState = {
        currentStep: currentValues.currentStep,
        data: {
          ...currentValues.data,
          selectedPlanId: planId,
          stripeSessionId: null,
        },
        selectedPlanId: planId,
        billingInterval: DEFAULT_BILLING_INTERVAL,
      };

      setSessionStorageState(stateToPersist);

      const persistedState = await persistOnboardingState(stateToPersist);

      if (!persistedState.success || !persistedState.stateToken) {
        setCheckoutError(
          persistedState.error ?? 'Failed to save onboarding state',
        );
        setIsStartingCheckout(false);
        return;
      }

      const checkoutResult = await createOnboardingCheckout(
        planId,
        DEFAULT_BILLING_INTERVAL,
        persistedState.stateToken,
      );

      if (!checkoutResult.success || !checkoutResult.checkoutUrl) {
        setCheckoutError(
          checkoutResult.error ?? 'Failed to create checkout session',
        );
        setIsStartingCheckout(false);
        return;
      }

      window.location.assign(checkoutResult.checkoutUrl);
    },
    [form],
  );

  const onInvitesStepSubmitted = useCallback(
    (invites: Invite[]) => {
      form.setValue('data.invites', invites);
      setIsCompleting(true);
    },
    [form],
  );

  const currentStep = form.watch('currentStep');
  const formData = form.watch('data');
  const userType = form.watch('data.userType');
  const steps = getStepsForUserType(userType);

  useEffect(() => {
    const currentSnapshot: StoredOnboardingState = {
      currentStep,
      data: formData,
      selectedPlanId: formData.selectedPlanId,
      stripeSessionId: formData.stripeSessionId ?? undefined,
      billingInterval: DEFAULT_BILLING_INTERVAL,
    };

    setSessionStorageState(currentSnapshot);
  }, [currentStep, formData]);

  useEffect(() => {
    if (!searchParams) {
      return;
    }

    const param = searchParams.get('type');
    const currentUserType = form.getValues('data.userType');
    const stepValue = form.getValues('currentStep');
    const hasCheckoutResult = searchParams.has('checkout_success');

    if (!param || currentUserType || stepValue !== 0 || hasCheckoutResult) {
      return;
    }

    const mappedType: UserType | null =
      param === 'self' ? 'self' : param === 'family' ? 'family_managed' : null;

    if (!mappedType) {
      return;
    }

    onUserTypeSubmitted({ userType: mappedType });
  }, [form, onUserTypeSubmitted, searchParams]);

  useEffect(() => {
    if (currentStep >= steps.length) {
      form.setValue('currentStep', Math.max(steps.length - 1, 0));
    }
  }, [currentStep, form, steps.length]);

  useEffect(() => {
    if (!searchParams || checkoutReturnHandledRef.current) {
      return;
    }

    const hasCheckoutParams =
      searchParams.has('checkout_success') ||
      searchParams.has('state') ||
      searchParams.has('session_id') ||
      searchParams.has('canceled');

    if (!hasCheckoutParams) {
      return;
    }

    checkoutReturnHandledRef.current = true;

    const checkoutSuccess = searchParams.get('checkout_success') === 'true';
    const checkoutCanceled =
      searchParams.get('checkout_success') === 'false' ||
      searchParams.get('canceled') === 'true';
    const stateToken = searchParams.get('state');
    const stripeSessionId = searchParams.get('session_id');

    const restore = async () => {
      setIsRestoringReturnState(true);
      setCheckoutError(null);
      const finishRestore = () => {
        setIsRestoringReturnState(false);
        clearCheckoutQueryParams();
      };

      let restoredState = getSessionStorageState();

      if (!restoredState && stateToken) {
        const persistedStateResult = await consumeOnboardingState(stateToken);
        restoredState = persistedStateResult.success
          ? sanitizeLoadedState(persistedStateResult.state)
          : null;
      }

      if (!restoredState) {
        setShowRestartState(true);
        finishRestore();
        return;
      }

      applyRestoredState(restoredState);

      const resolution = resolveCheckoutReturnResolution({
        restoredState,
        checkoutCanceled,
        checkoutSuccess,
        stripeSessionId,
      });

      if (resolution.kind === 'restart') {
        setShowRestartState(true);
        finishRestore();
        return;
      }

      if (resolution.kind === 'cancel') {
        form.setValue('currentStep', resolution.planStepIndex);
        form.setValue('data.stripeSessionId', null);
        setIsCompleting(false);
        setIsStartingCheckout(false);
        toast.info('Checkout canceled. Your onboarding progress was restored.');
        finishRestore();
        return;
      }

      if (resolution.kind === 'success') {
        if (resolution.stripeSessionId) {
          form.setValue('data.stripeSessionId', resolution.stripeSessionId);
        }

        if (resolution.nextStepIndex === null) {
          setIsCompleting(true);
        } else {
          form.setValue('currentStep', resolution.nextStepIndex);
          setIsCompleting(false);
        }

        setIsStartingCheckout(false);
        toast.success('Checkout complete. Restored your onboarding progress.');
        finishRestore();
        return;
      }

      finishRestore();
    };

    void restore();
  }, [applyRestoredState, form, searchParams]);

  const restartOnboarding = useCallback(() => {
    form.reset({
      data: DEFAULT_DATA,
      currentStep: 0,
    });
    setIsCompleting(false);
    setCheckoutError(null);
    setShowRestartState(false);
    setIsStartingCheckout(false);
    setIsRestoringReturnState(false);

    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      window.location.replace('/onboarding');
    }
  }, [form]);

  if (showRestartState) {
    return (
      <CsrfTokenContext.Provider value={props.csrfToken}>
        <div className="mx-auto max-w-lg space-y-4 py-8">
          <Alert type={'warn'}>
            <Alert.Heading>Your checkout session expired</Alert.Heading>
            We could not recover your onboarding details. Restart onboarding to
            continue.
          </Alert>

          <Button type={'button'} onClick={restartOnboarding}>
            Restart onboarding
          </Button>
        </div>
      </CsrfTokenContext.Provider>
    );
  }

  if (isRestoringReturnState) {
    return (
      <CsrfTokenContext.Provider value={props.csrfToken}>
        <div className="mx-auto max-w-lg py-8">
          <Alert type={'info'}>
            <Alert.Heading>Restoring your onboarding session</Alert.Heading>
            One moment while we restore your progress.
          </Alert>
        </div>
      </CsrfTokenContext.Provider>
    );
  }

  const stepId = steps[currentStep];

  return (
    <CsrfTokenContext.Provider value={props.csrfToken}>
      {!isCompleting && currentStep > 0 && (
        <Stepper
          variant={'default'}
          currentStep={currentStep - 1}
          steps={steps.slice(1)}
        />
      )}

      <div key={stepId} className="animate-fade-in-up">
        <If condition={stepId === 'onboarding:userType'}>
          <UserTypeStep onSubmit={onUserTypeSubmitted} />
        </If>

        <If condition={stepId === 'onboarding:info'}>
          <OrganizationInfoStep
            onSubmit={onInfoStepSubmitted}
            onGoBack={prevStep}
          />
        </If>

        <If condition={stepId === 'onboarding:phoneCollection'}>
          <PhoneCollectionStep
            onSubmit={onPhoneStepSubmitted}
            onGoBack={prevStep}
          />
        </If>

        <If condition={stepId === 'onboarding:personal'}>
          <BirthdayStep
            onSubmit={onBirthdayStepSubmitted}
            onGoBack={prevStep}
          />
        </If>

        <If condition={stepId === 'onboarding:lovedOneSetup'}>
          <LovedOneSetupStep
            onSubmit={onLovedOneStepSubmitted}
            onGoBack={prevStep}
          />
        </If>

        <If condition={stepId === 'onboarding:voiceSelection'}>
          <VoiceSelectionStep
            onSubmit={onVoiceSelectionSubmitted}
            onGoBack={prevStep}
            value={formData?.preferredGrokVoice ?? DEFAULT_GROK_VOICE}
          />
        </If>

        <If condition={stepId === 'onboarding:plan' && !isCompleting}>
          <PlanSelectionStep
            onSubmit={onPlanStepSubmitted}
            userType={userType ?? undefined}
            onGoBack={prevStep}
            isLastStep={currentStep + 1 >= steps.length}
            isSubmitting={isStartingCheckout}
            errorMessage={checkoutError}
          />
        </If>

        <If condition={stepId === 'onboarding:invites' && !isCompleting}>
          <OrganizationInvitesStep
            onSubmit={onInvitesStepSubmitted}
            onGoBack={prevStep}
          />
        </If>

        <If condition={isCompleting && formData}>
          {(submissionData) => <CompleteOnboardingStep data={submissionData} />}
        </If>
      </div>
    </CsrfTokenContext.Provider>
  );
}

export default OnboardingContainer;
