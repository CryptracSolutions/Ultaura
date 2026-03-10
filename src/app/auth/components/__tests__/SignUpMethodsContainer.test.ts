import { beforeEach, describe, expect, it, vi } from 'vitest';

type Setter = ReturnType<typeof vi.fn<any[], unknown>>;

type CapturedEmailPasswordProps = {
  onSignUp: (userId?: string) => Promise<void> | void;
  inviteCode?: string;
  nextPath?: string;
};

let states: Array<{ value: unknown; setter: Setter }> = [];
let capturedEmailPasswordProps: CapturedEmailPasswordProps | null = null;

const routerReplaceMock = vi.fn();
const acceptInviteActionMock = vi.fn();

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  states = [];
  capturedEmailPasswordProps = null;

  vi.stubGlobal('React', {
    createElement: (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) => {
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

  let stateIndex = 0;

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
    useState: (initialValue: unknown) => {
      const value =
        typeof initialValue === 'function'
          ? (initialValue as () => unknown)()
          : initialValue;

      if (stateIndex >= states.length) {
        states.push({
          value,
          setter: vi.fn<any[], unknown>((next: unknown) => {
            states[stateIndex - 1].value =
              typeof next === 'function'
                ? (next as (current: unknown) => unknown)(states[stateIndex - 1].value)
                : next;
          }),
        });
      }

      const slot = states[stateIndex++];
      return [slot.value, slot.setter];
    },
    useCallback: (fn: Function) => fn,
  }));

  vi.doMock('next/navigation', () => ({
    useRouter: () => ({
      replace: routerReplaceMock,
    }),
  }));

  vi.doMock('~/configuration', () => ({
    __esModule: true,
    default: {
      auth: {
        requireEmailConfirmation: true,
        providers: {
          emailPassword: true,
          phoneNumber: true,
          emailLink: false,
          emailOtp: false,
          oAuth: [],
        },
      },
      paths: {
        appHome: '/dashboard',
      },
    },
  }));

  vi.doMock('~/core/ui/If', () => ({
    default: ({ condition, children }: { condition: boolean; children: unknown }) =>
      condition ? children : null,
  }));
  vi.doMock('~/core/ui/Trans', () => ({
    default: 'trans',
  }));

  vi.doMock('~/app/auth/components/EmailPasswordSignUpContainer', () => ({
    __esModule: true,
    default: (props: CapturedEmailPasswordProps) => {
      capturedEmailPasswordProps = props;
      return {
        type: 'email-password-sign-up-container',
        props,
        children: [],
      };
    },
  }));

  vi.doMock('~/app/auth/components/PhoneNumberSignInContainer', () => ({
    __esModule: true,
    default: () => null,
  }));
  vi.doMock('~/app/auth/components/EmailLinkAuth', () => ({
    __esModule: true,
    default: () => null,
  }));
  vi.doMock('~/app/auth/components/EmailOtpContainer', () => ({
    __esModule: true,
    default: () => null,
  }));
  vi.doMock('~/app/auth/components/OAuthProviders', () => ({
    __esModule: true,
    default: () => null,
  }));

  vi.doMock('~/lib/memberships/actions', () => ({
    acceptInviteAction: acceptInviteActionMock,
  }));
});

describe('SignUpMethodsContainer', () => {
  it('does not navigate after invite-aware email signup while email confirmation is required', async () => {
    acceptInviteActionMock.mockResolvedValue({
      success: true,
      needsEmailVerification: true,
      destination: '/dashboard',
    });

    const mod = await import('../SignUpMethodsContainer');
    mod.default({ inviteCode: 'invite-123', next: '/dashboard' });

    expect(capturedEmailPasswordProps).toBeTruthy();

    await capturedEmailPasswordProps?.onSignUp('new-user-id');

    expect(acceptInviteActionMock).toHaveBeenCalledWith({
      code: 'invite-123',
      userId: 'new-user-id',
      redirectOnSuccess: false,
    });
    expect(routerReplaceMock).not.toHaveBeenCalled();
  });
});
