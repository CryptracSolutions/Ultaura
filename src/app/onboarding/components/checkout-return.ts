import configuration from '~/configuration';
import type { UserType } from '~/lib/ultaura/types';

export type CheckoutReturnResolution =
  | {
      kind: 'restart';
    }
  | {
      kind: 'cancel';
      planStepIndex: number;
    }
  | {
      kind: 'success';
      nextStepIndex: number | null;
      stripeSessionId: string | null;
    }
  | {
      kind: 'none';
    };

const enableTeamAccounts = configuration.features.enableTeamAccounts;

const SELF_USER_STEPS = [
  'onboarding:userType',
  'onboarding:phoneCollection',
  'onboarding:personal',
  'onboarding:voiceSelection',
  'onboarding:plan',
] as const;

const FAMILY_USER_BASE_STEPS = [
  'onboarding:userType',
  'onboarding:info',
  'onboarding:lovedOneSetup',
  'onboarding:voiceSelection',
  'onboarding:plan',
] as const;

const FAMILY_STEPS_WITH_INVITES = [
  ...FAMILY_USER_BASE_STEPS,
  'onboarding:invites',
];

const FAMILY_STEPS_NO_INVITES = FAMILY_USER_BASE_STEPS;

export function getStepsForUserType(userType: UserType | null) {
  if (userType === 'self') {
    return SELF_USER_STEPS;
  }

  if (userType === 'family_managed') {
    return enableTeamAccounts
      ? FAMILY_STEPS_WITH_INVITES
      : FAMILY_STEPS_NO_INVITES;
  }

  return SELF_USER_STEPS;
}

export function resolveCheckoutReturnResolution(params: {
  restoredState: {
    data: {
      userType: UserType | null;
    };
  };
  checkoutSuccess: boolean;
  checkoutCanceled: boolean;
  stripeSessionId: string | null;
}): CheckoutReturnResolution {
  const restoredSteps = getStepsForUserType(params.restoredState.data.userType);
  const planStepIndex = restoredSteps.indexOf('onboarding:plan');

  if (planStepIndex < 0) {
    return {
      kind: 'restart',
    };
  }

  if (params.checkoutCanceled) {
    return {
      kind: 'cancel',
      planStepIndex,
    };
  }

  if (params.checkoutSuccess) {
    const nextStepIndex = planStepIndex + 1;
    return {
      kind: 'success',
      nextStepIndex:
        nextStepIndex >= restoredSteps.length ? null : nextStepIndex,
      stripeSessionId: params.stripeSessionId,
    };
  }

  return {
    kind: 'none',
  };
}
