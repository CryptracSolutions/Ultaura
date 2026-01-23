'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import If from '~/core/ui/If';
import CsrfTokenContext from '~/lib/contexts/csrf';
import Stepper from '~/core/ui/Stepper';

import OrganizationInfoStep, {
  OrganizationInfoStepData,
} from './OrganizationInfoStep';

import PlanSelectionStep from './PlanSelectionStep';

import CompleteOnboardingStep from './CompleteOnboardingStep';
import OrganizationInvitesStep from '~/app/onboarding/components/OrganizationInvitesStep';
import MembershipRole from '~/lib/organizations/types/membership-role';
import configuration from '~/configuration';
import type { PlanId, UserType } from '~/lib/ultaura/types';
import UserTypeStep, { UserTypeStepData } from './UserTypeStep';
import PhoneCollectionStep, { PhoneCollectionStepData } from './PhoneCollectionStep';
import BirthdayStep, { BirthdayStepData } from './BirthdayStep';
import LovedOneSetupStep, { LovedOneSetupStepData } from './LovedOneSetupStep';
import VoiceSelectionStep, { VoiceSelectionStepData } from './VoiceSelectionStep';
import { DEFAULT_GROK_VOICE } from '~/lib/ultaura/voices';

type Invite = {
  email: string;
  role: MembershipRole;
};

const enableTeamAccounts = configuration.features.enableTeamAccounts;

/**
 * Represents the list of steps for a user onboarding process.
 * The Array represents the list of step names to render within
 * the Stepper component. You can either use the i18n key or the label itself.
 *
 * Update this array to add/remove steps from the onboarding process.
 *
 * @type {Array<string>}
 */
const SELF_USER_STEPS = [
  'onboarding:userType',
  'onboarding:phoneCollection',
  'onboarding:birthday',
  'onboarding:voiceSelection',
  'onboarding:plan',
];

const FAMILY_STEPS_WITH_INVITES = [
  'onboarding:userType',
  'onboarding:info',
  'onboarding:lovedOneSetup',
  'onboarding:voiceSelection',
  'onboarding:plan',
  'onboarding:invites',
];

const FAMILY_STEPS_NO_INVITES = [
  'onboarding:userType',
  'onboarding:info',
  'onboarding:lovedOneSetup',
  'onboarding:voiceSelection',
  'onboarding:plan',
];

function OnboardingContainer(
  props: React.PropsWithChildren<{
    csrfToken: string | null;
  }>,
) {
  const [isCompleting, setIsCompleting] = useState(false);
  const form = useForm({
    defaultValues: {
      data: {
        userType: null as UserType | null,
        organization: '',
        selectedPlanId: 'comfort' as PlanId,
        invites: [] as Invite[],
        selfPhoneE164: '',
        selfTimezone: 'America/Los_Angeles',
        selfBirthday: null as { month: number; day: number } | null,
        lovedOneName: '',
        lovedOnePhoneE164: '',
        lovedOneTimezone: 'America/Los_Angeles',
        preferredGrokVoice: DEFAULT_GROK_VOICE,
      },
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
      nextStep();
    },
    [form, nextStep],
  );

  const onLovedOneStepSubmitted = useCallback(
    (data: LovedOneSetupStepData) => {
      form.setValue('data.lovedOneName', data.lovedOneName);
      form.setValue('data.lovedOnePhoneE164', data.lovedOnePhoneE164);
      form.setValue('data.lovedOneTimezone', data.lovedOneTimezone);
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
    (planId: PlanId, stepsCount: number) => {
      form.setValue('data.selectedPlanId', planId);
      const current = form.getValues('currentStep');
      // If plan is the last step, trigger completion
      if (current + 1 >= stepsCount) {
        setIsCompleting(true);
      } else {
        nextStep();
      }
    },
    [form, nextStep],
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

  const isStep = useCallback(
    (step: number) => currentStep === step,
    [currentStep],
  );

  const steps = useMemo(() => {
    if (userType === 'self') {
      return SELF_USER_STEPS;
    }

    if (userType === 'family_managed') {
      return enableTeamAccounts ? FAMILY_STEPS_WITH_INVITES : FAMILY_STEPS_NO_INVITES;
    }

    // Default to showing SELF_USER_STEPS as preview before user selects type
    return SELF_USER_STEPS;
  }, [userType]);

  useEffect(() => {
    if (currentStep >= steps.length) {
      form.setValue('currentStep', Math.max(steps.length - 1, 0));
    }
  }, [currentStep, form, steps.length]);

  const stepId = steps[currentStep];

  return (
    <CsrfTokenContext.Provider value={props.csrfToken}>
      {!isCompleting && (
        <Stepper variant={'default'} currentStep={currentStep} steps={steps} />
      )}

      <div
        key={stepId}
        className="animate-fade-in-up"
      >
        <If condition={stepId === 'onboarding:userType'}>
          <UserTypeStep onSubmit={onUserTypeSubmitted} />
        </If>

        <If condition={stepId === 'onboarding:info'}>
          <OrganizationInfoStep onSubmit={onInfoStepSubmitted} onGoBack={prevStep} />
        </If>

        <If condition={stepId === 'onboarding:phoneCollection'}>
          <PhoneCollectionStep onSubmit={onPhoneStepSubmitted} onGoBack={prevStep} />
        </If>

        <If condition={stepId === 'onboarding:birthday'}>
          <BirthdayStep onSubmit={onBirthdayStepSubmitted} onGoBack={prevStep} />
        </If>

        <If condition={stepId === 'onboarding:lovedOneSetup'}>
          <LovedOneSetupStep onSubmit={onLovedOneStepSubmitted} onGoBack={prevStep} />
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
            onSubmit={(planId) => onPlanStepSubmitted(planId, steps.length)}
            userType={userType ?? undefined}
            onGoBack={prevStep}
            isLastStep={currentStep + 1 >= steps.length}
          />
        </If>

        <If condition={stepId === 'onboarding:invites' && !isCompleting}>
          <OrganizationInvitesStep onSubmit={onInvitesStepSubmitted} onGoBack={prevStep} />
        </If>

        <If condition={isCompleting && formData}>
          {(formData) => <CompleteOnboardingStep data={formData} />}
        </If>
      </div>
    </CsrfTokenContext.Provider>
  );
}

export default OnboardingContainer;
