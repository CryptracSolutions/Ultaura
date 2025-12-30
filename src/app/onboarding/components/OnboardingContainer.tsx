'use client';

import { useCallback } from 'react';
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
import type { PlanId } from '~/lib/ultaura/types';

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
const STEPS: Array<string> = enableTeamAccounts
  ? ['onboarding:info', 'onboarding:plan', 'onboarding:invites', 'onboarding:complete']
  : ['onboarding:info', 'onboarding:plan', 'onboarding:complete'];

function OnboardingContainer(
  props: React.PropsWithChildren<{
    csrfToken: string | null;
  }>,
) {
  const form = useForm({
    defaultValues: {
      data: {
        organization: '',
        selectedPlanId: 'comfort' as PlanId,
        invites: [] as Invite[],
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

  const isStep = useCallback(
    (step: number) => currentStep === step,
    [currentStep],
  );

  const invitesStep = enableTeamAccounts ? 2 : null;
  const completeStep = enableTeamAccounts ? 3 : 2;

  return (
    <CsrfTokenContext.Provider value={props.csrfToken}>
      <Stepper variant={'default'} currentStep={currentStep} steps={STEPS} />

      <If condition={isStep(0)}>
        <OrganizationInfoStep onSubmit={onInfoStepSubmitted} />
      </If>

      <If condition={isStep(1)}>
        <PlanSelectionStep onSubmit={onPlanStepSubmitted} />
      </If>

      <If condition={enableTeamAccounts && invitesStep !== null && isStep(invitesStep)}>
        <OrganizationInvitesStep onSubmit={onInvitesStepSubmitted} />
      </If>

      <If condition={isStep(completeStep) && formData}>
        {(formData) => <CompleteOnboardingStep data={formData} />}
      </If>
    </CsrfTokenContext.Provider>
  );
}

export default OnboardingContainer;
