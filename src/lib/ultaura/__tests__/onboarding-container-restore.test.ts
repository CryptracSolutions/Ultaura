import { describe, expect, it } from 'vitest';
import {
  resolveCheckoutReturnResolution,
} from '~/app/onboarding/components/checkout-return';

type StoredOnboardingState = {
  currentStep: number;
  data: {
    userType: 'self' | 'family_managed';
    organization: string;
    selectedPlanId: string;
    invites: unknown[];
    selfPhoneE164: string;
    selfTimezone: string;
    selfBirthday: { month: number; day: number } | null;
    lovedOneName: string;
    lovedOnePhoneE164: string;
    lovedOneTimezone: string;
    preferredGrokVoice: string;
    stripeSessionId: string | null;
  };
  billingInterval: 'monthly' | 'annual';
  selectedPlanId: string;
};

function createStoredState(userType: 'self' | 'family_managed'): StoredOnboardingState {
  return {
    currentStep: 4,
    data: {
      userType,
      organization: userType === 'self' ? '' : 'Care Team',
      selectedPlanId: userType === 'self' ? 'care' : 'comfort',
      invites: [],
      selfPhoneE164: '',
      selfTimezone: 'America/Los_Angeles',
      selfBirthday: null,
      lovedOneName: '',
      lovedOnePhoneE164: '',
      lovedOneTimezone: 'America/Los_Angeles',
      preferredGrokVoice: 'Ara',
      stripeSessionId: null,
    },
    billingInterval: 'monthly',
    selectedPlanId: userType === 'self' ? 'care' : 'comfort',
  };
}

describe('OnboardingContainer checkout return resolution', () => {
  it('routes canceled checkout returns back to the plan step', () => {
    const result = resolveCheckoutReturnResolution({
      restoredState: createStoredState('self'),
      checkoutSuccess: false,
      checkoutCanceled: true,
      stripeSessionId: null,
    });

    expect(result).toEqual({
      kind: 'cancel',
      planStepIndex: 4,
    });
  });

  it('routes successful self-user checkout returns to completion', () => {
    const result = resolveCheckoutReturnResolution({
      restoredState: createStoredState('self'),
      checkoutSuccess: true,
      checkoutCanceled: false,
      stripeSessionId: 'cs_test_123',
    });

    expect(result).toEqual({
      kind: 'success',
      nextStepIndex: null,
      stripeSessionId: 'cs_test_123',
    });
  });
});
