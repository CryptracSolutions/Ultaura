import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const signUpTriggerMock = vi.fn();
const resendTriggerMock = vi.fn();
const routerReplaceMock = vi.fn();
let capturedFormProps:
  | { onSubmit: (params: { email: string; password: string }) => Promise<void> }
  | null = null;

describe('EmailPasswordSignUpContainer', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();

    signUpTriggerMock.mockReset();
    resendTriggerMock.mockReset();
    capturedFormProps = null;

    vi.stubGlobal('React', {
      createElement: (
        type: unknown,
        props: Record<string, unknown> | null,
        ...children: unknown[]
      ) => {
        const normalizedProps = { ...(props ?? {}), children };

        if (typeof type === 'function') {
          return type(normalizedProps);
        }

        return {
          type,
          props: normalizedProps,
          children,
        };
      },
    });

    const sessionStorageState = new Map<string, string>();
    const replaceStateMock = vi.fn((_: unknown, __: string, url: string) => {
      window.location.href = url;
      window.location.search = new URL(url).search;
    });

    vi.stubGlobal('window', {
      location: {
        href: 'http://localhost:3000/auth/sign-up?inviteCode=invite-123',
        search: '?inviteCode=invite-123',
      },
      history: {
        replaceState: replaceStateMock,
      },
      sessionStorage: {
        getItem: (key: string) => sessionStorageState.get(key) ?? null,
        setItem: (key: string, value: string) => {
          sessionStorageState.set(key, value);
        },
        removeItem: (key: string) => {
          sessionStorageState.delete(key);
        },
      },
    });

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
    vi.doMock('next/navigation', () => ({
      useRouter: () => ({
        replace: routerReplaceMock,
      }),
    }));
    vi.doMock('~/core/ui/Button', () => ({ default: () => null }));
    vi.doMock('~/core/ui/If', () => ({ default: () => null }));
    vi.doMock('~/core/ui/Trans', () => ({ default: () => null }));
    vi.doMock('./AuthErrorMessage', () => ({ default: () => null }));
    vi.doMock('~/app/auth/components/EmailPasswordSignUpForm', () => ({
      default: (props: {
        onSubmit: (params: { email: string; password: string }) => Promise<void>;
      }) => {
        capturedFormProps = props;
        return null;
      },
    }));
    vi.doMock('~/app/auth/components/EmailConfirmationWaiting', () => ({
      default: () => null,
    }));
    vi.doMock('react', () => ({
      default: {
        createElement: (
          type: unknown,
          props: Record<string, unknown> | null,
          ...children: unknown[]
        ) => {
          const normalizedProps = { ...(props ?? {}), children };

          if (typeof type === 'function') {
            return type(normalizedProps);
          }

          return {
            type,
            props: normalizedProps,
            children,
          };
        },
      },
      useCallback: (fn: Function) => fn,
      useEffect: (fn: () => unknown) => fn(),
      useRef: (value: unknown) => ({ current: value }),
      useState: (initialValue: unknown) => [initialValue, vi.fn()],
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

  it('persists pending email confirmation state before the signup request resolves', async () => {
    signUpTriggerMock.mockImplementation(async () => {
      expect(window.location.search).toContain('emailConfirmation=pending');
      expect(
        window.sessionStorage.getItem('ultaura.email-confirmation.pending'),
      ).toContain('invitee@example.com');

      return {
        user: {
          id: 'user-123',
        },
      };
    });

    const mod = await import('../EmailPasswordSignUpContainer');
    mod.default({
      onSignUp: vi.fn(),
      inviteCode: 'invite-123',
      nextPath: '/onboarding',
    });

    expect(capturedFormProps).not.toBeNull();

    await capturedFormProps?.onSubmit({
      email: 'invitee@example.com',
      password: 'StrongPass123!',
    });

    expect(signUpTriggerMock).toHaveBeenCalledWith({
      email: 'invitee@example.com',
      password: 'StrongPass123!',
      inviteCode: 'invite-123',
      next: '/onboarding',
    });
    expect(routerReplaceMock).toHaveBeenCalledWith(
      '/auth/confirmed?pending=1&email=invitee%40example.com&inviteCode=invite-123&next=%2Fonboarding',
    );
  });
});
