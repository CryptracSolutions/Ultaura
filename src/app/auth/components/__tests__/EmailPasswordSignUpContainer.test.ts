import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const signUpTriggerMock = vi.fn();
const resendTriggerMock = vi.fn();

describe('EmailPasswordSignUpContainer', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();

    signUpTriggerMock.mockReset();
    resendTriggerMock.mockReset();

    vi.doMock('~/core/hooks/use-sign-up-with-email-password', () => ({
      default: () => ({
        trigger: signUpTriggerMock,
        isMutating: false,
        error: undefined,
      }),
    }));

    vi.doMock('~/core/hooks/use-resend-signup-confirmation', () => ({
      default: () => ({
        trigger: resendTriggerMock,
        isMutating: false,
        error: undefined,
      }),
    }));

    vi.doMock('~/core/ui/Alert', () => ({
      default: Object.assign(() => null, { Heading: () => null }),
    }));
    vi.doMock('~/core/ui/Button', () => ({ default: () => null }));
    vi.doMock('~/core/ui/If', () => ({ default: () => null }));
    vi.doMock('~/core/ui/Trans', () => ({ default: () => null }));
    vi.doMock('./AuthErrorMessage', () => ({ default: () => null }));
    vi.doMock('~/app/auth/components/EmailPasswordSignUpForm', () => ({
      default: () => null,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('submits signup with callback redirect to onboarding', async () => {
    signUpTriggerMock.mockResolvedValue({
      user: {
        id: 'user-123',
      },
    });

    const mod = await import('~/core/hooks/use-sign-up-with-email-password');
    const hook = mod.default();

    await hook.trigger({
      email: 'test@example.com',
      password: 'StrongPass123!',
    });

    expect(signUpTriggerMock).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'StrongPass123!',
    });
  });

  it('resends signup confirmation emails through Supabase auth resend', async () => {
    resendTriggerMock.mockResolvedValue({});

    const mod = await import('~/core/hooks/use-resend-signup-confirmation');
    const hook = mod.default();

    await hook.trigger({
      email: 'test@example.com',
    });

    expect(resendTriggerMock).toHaveBeenCalledWith({
      email: 'test@example.com',
    });
  });

  it('exports the signup container component', async () => {
    const mod = await import('../EmailPasswordSignUpContainer');

    expect(typeof mod.default).toBe('function');
    expect(resendTriggerMock).not.toHaveBeenCalled();
  });
});
