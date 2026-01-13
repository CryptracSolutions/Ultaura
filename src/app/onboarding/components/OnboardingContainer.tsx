'use client';

import { useCallback, useEffect, useMemo } from 'react';
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
  'onboarding:plan',
  'onboarding:complete',
];

const FAMILY_STEPS_WITH_INVITES = [
  'onboarding:userType',
  'onboarding:info',
  'onboarding:lovedOneSetup',
  'onboarding:plan',
  'onboarding:invites',
  'onboarding:complete',
];

const FAMILY_STEPS_NO_INVITES = [
  'onboarding:userType',
  'onboarding:info',
  'onboarding:lovedOneSetup',
  'onboarding:plan',
  'onboarding:complete',
];

function OnboardingContainer(
  props: React.PropsWithChildren<{
    csrfToken: string | null;
  }>,
) {
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
      },
      currentStep: 0,
    },
  });

  const nextStep = useCallback(() => {
    form.setValue('currentStep', form.getValues('currentStep') + 1);
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

  const onPlanStepSubmitted = useCallback(
    (planId: PlanId) => {
      form.setValue('data.selectedPlanId', planId);
      nextStep();
    },
    [form, nextStep],
  );

  const onInvitesStepSubmitted = useCallback(
    (invites: Invite[]) => {
      form.setValue('data.invites', invites);
      form.setValue('currentStep', form.getValues('currentStep') + 1);
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

    return ['onboarding:userType'];
  }, [userType]);

  useEffect(() => {
    if (currentStep >= steps.length) {
      form.setValue('currentStep', Math.max(steps.length - 1, 0));
    }
  }, [currentStep, form, steps.length]);

  const stepId = steps[currentStep];

  return (
    <CsrfTokenContext.Provider value={props.csrfToken}>
      <Stepper variant={'default'} currentStep={currentStep} steps={steps} />

      <If condition={stepId === 'onboarding:userType'}>
        <UserTypeStep onSubmit={onUserTypeSubmitted} />
      </If>

      <If condition={stepId === 'onboarding:info'}>
        <OrganizationInfoStep onSubmit={onInfoStepSubmitted} />
      </If>

      <If condition={stepId === 'onboarding:phoneCollection'}>
        <PhoneCollectionStep onSubmit={onPhoneStepSubmitted} />
      </If>

      <If condition={stepId === 'onboarding:birthday'}>
        <BirthdayStep onSubmit={onBirthdayStepSubmitted} />
      </If>

      <If condition={stepId === 'onboarding:lovedOneSetup'}>
        <LovedOneSetupStep onSubmit={onLovedOneStepSubmitted} />
      </If>

      <If condition={stepId === 'onboarding:plan'}>
        <PlanSelectionStep onSubmit={onPlanStepSubmitted} userType={userType ?? undefined} />
      </If>

      <If condition={stepId === 'onboarding:invites'}>
        <OrganizationInvitesStep onSubmit={onInvitesStepSubmitted} />
      </If>

      <If condition={stepId === 'onboarding:complete' && formData}>
        {(formData) => <CompleteOnboardingStep data={formData} />}
      </If>
    </CsrfTokenContext.Provider>
  );
}

export default OnboardingContainer;
