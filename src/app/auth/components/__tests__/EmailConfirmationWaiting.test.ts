import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Setter = ReturnType<typeof vi.fn>;

let states: Array<{ value: unknown; setter: Setter }> = [];
let effects: Array<() => unknown> = [];
let initialStatusOverride: 'waiting' | 'verified' | 'timeout' | undefined;

const SIGNUP_EMAIL = 'senior@example.com';
const OTHER_EMAIL = 'different@example.com';
const CONFIRMED_AT = '2026-03-09T12:00:00.000Z';

const getUserMock = vi.fn();
const getSessionMock = vi.fn();
const unsubscribeMock = vi.fn();
const routerReplaceMock = vi.fn();
let authStateChangeCallback: ((event: string, session: unknown) => void) | null =
  null;

function createSession(params: {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}) {
  return {
    user: { id: 'user-1' },
    access_token: params.accessToken,
    refresh_token: params.refreshToken,
    expires_at: params.expiresAt,
  };
}

function createUser(params?: {
  email?: string;
  emailConfirmedAt?: string | null;
}) {
  return {
    email: params?.email ?? SIGNUP_EMAIL,
    email_confirmed_at: params?.emailConfirmedAt ?? null,
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();

  states = [];
  effects = [];
  initialStatusOverride = undefined;
  authStateChangeCallback = null;

  getUserMock.mockReset();
  getUserMock.mockResolvedValue({
    data: {
      user: createUser(),
    },
  });
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue({
    data: {
      session: null,
    },
  });
  unsubscribeMock.mockReset();
  routerReplaceMock.mockReset();

  vi.stubGlobal('React', {
    createElement: (...args: unknown[]) => ({
      type: args[0],
      props: args[1] ?? {},
      children: args.slice(2),
    }),
  });

  let stateIndex = 0;

  vi.doMock('react', () => ({
    default: {
      createElement: (...args: unknown[]) => ({
        type: args[0],
        props: args[1] ?? {},
        children: args.slice(2),
      }),
    },
    useCallback: (fn: Function) => fn,
    useState: (init: unknown) => {
      const nextInit =
        stateIndex === 0 && initialStatusOverride !== undefined
          ? initialStatusOverride
          : init;

      if (stateIndex >= states.length) {
        states.push({ value: nextInit, setter: vi.fn() });
      }

      const slot = states[stateIndex++];
      return [slot.value, slot.setter];
    },
    useEffect: (fn: () => unknown) => {
      effects.push(fn);
    },
    useRef: (init: unknown) => ({ current: init }),
  }));

  vi.doMock('next/navigation', () => ({
    useRouter: () => ({
      replace: routerReplaceMock,
    }),
  }));

  vi.doMock('framer-motion', () => ({
    motion: {
      div: 'div',
    },
    useReducedMotion: () => true,
  }));

  vi.doMock('~/core/hooks/use-supabase', () => ({
    default: () => ({
      auth: {
        getUser: getUserMock,
        getSession: getSessionMock,
        onAuthStateChange: (
          callback: (event: string, session: unknown) => void,
        ) => {
          authStateChangeCallback = callback;
          return {
            data: {
              subscription: {
                unsubscribe: unsubscribeMock,
              },
            },
          };
        },
      },
    }),
  }));

  vi.doMock('~/core/ui/Trans', () => ({
    default: 'trans',
  }));
  vi.doMock('~/core/ui/If', () => ({
    default: 'if',
  }));
  vi.doMock('~/core/ui/Alert', () => ({
    default: 'alert',
  }));
  vi.doMock('~/core/ui/Button', () => ({
    default: 'button',
  }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function renderComponent(overrides: Partial<Parameters<any>[0]> = {}) {
  const props = {
    email: SIGNUP_EMAIL,
    resendCooldown: 0,
    resendSuccess: false,
    resendError: null,
    isResending: false,
    onResend: vi.fn(),
    ...overrides,
  };

  const mod = await import('../EmailConfirmationWaiting');
  const tree = mod.default(props as never);
  return { tree, props };
}

function runMountEffect() {
  const mount = effects[0];
  if (!mount) {
    throw new Error('Expected mount effect');
  }

  return mount();
}

function findNode(
  node: unknown,
  predicate: (value: { type: unknown; props: Record<string, unknown> }) => boolean,
): { type: unknown; props: Record<string, unknown>; children: unknown[] } | null {
  if (!node || typeof node !== 'object') {
    return null;
  }

  const maybeNode = node as {
    type?: unknown;
    props?: Record<string, unknown>;
    children?: unknown[];
  };

  const normalized = {
    type: maybeNode.type,
    props: maybeNode.props ?? {},
    children: maybeNode.children ?? [],
  };

  if (predicate(normalized)) {
    return normalized;
  }

  const propChildren = normalized.props.children;
  const allChildren = [...normalized.children];
  if (Array.isArray(propChildren)) {
    allChildren.push(...propChildren);
  } else if (propChildren !== undefined) {
    allChildren.push(propChildren);
  }

  for (const child of allChildren) {
    const found = findNode(child, predicate);
    if (found) {
      return found;
    }
  }

  return null;
}

describe('EmailConfirmationWaiting', () => {
  it('does not verify when auth event fires but getUser is still unconfirmed', async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: createSession({
          accessToken: 'token-1',
          refreshToken: 'refresh-1',
          expiresAt: 100,
        }),
      },
    });

    getUserMock.mockResolvedValue({
      data: {
        user: createUser(),
      },
    });

    await renderComponent();
    runMountEffect();
    await vi.advanceTimersByTimeAsync(0);

    authStateChangeCallback?.('SIGNED_IN', {
      ...createSession({
        accessToken: 'token-2',
        refreshToken: 'refresh-2',
        expiresAt: 200,
      }),
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(getUserMock).toHaveBeenCalledOnce();
    expect(states[0].setter).not.toHaveBeenCalledWith('verified');
  });

  it('does not verify when confirmed user email does not match signup email', async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: createSession({
          accessToken: 'token-1',
          refreshToken: 'refresh-1',
          expiresAt: 100,
        }),
      },
    });

    getUserMock.mockResolvedValue({
      data: {
        user: createUser({
          email: OTHER_EMAIL,
          emailConfirmedAt: CONFIRMED_AT,
        }),
      },
    });

    await renderComponent();
    runMountEffect();
    await vi.advanceTimersByTimeAsync(0);

    authStateChangeCallback?.('SIGNED_IN', {
      ...createSession({
        accessToken: 'token-2',
        refreshToken: 'refresh-2',
        expiresAt: 200,
      }),
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(states[0].setter).not.toHaveBeenCalledWith('verified');
  });

  it('verifies when polling sees a local session fingerprint change and getUser confirms', async () => {
    getSessionMock
      .mockResolvedValueOnce({
        data: {
          session: createSession({
            accessToken: 'token-1',
            refreshToken: 'refresh-1',
            expiresAt: 100,
          }),
        },
      })
      .mockResolvedValueOnce({
        data: {
          session: createSession({
            accessToken: 'token-2',
            refreshToken: 'refresh-2',
            expiresAt: 200,
          }),
        },
      });

    getUserMock.mockResolvedValue({
      data: {
        user: createUser({
          emailConfirmedAt: CONFIRMED_AT,
        }),
      },
    });

    await renderComponent();
    runMountEffect();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(4000);
    await vi.advanceTimersByTimeAsync(0);

    expect(getUserMock).toHaveBeenCalledOnce();
    expect(states[0].setter).toHaveBeenCalledWith('verified');
  });

  it('shows a manual continue button in verified state and does not auto-redirect by default', async () => {
    initialStatusOverride = 'verified';
    const { tree } = await renderComponent();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(routerReplaceMock).not.toHaveBeenCalled();

    const continueButton = findNode(
      tree,
      (node) => node.type === 'button' && typeof node.props.onClick === 'function',
    );

    expect(continueButton).not.toBeNull();
    (continueButton?.props.onClick as () => void)();
    expect(routerReplaceMock).toHaveBeenCalledWith(
      '/auth/confirmed?next=%2Fonboarding',
    );
  });

  it('keeps timeout and resend behavior', async () => {
    const { props: waitingProps } = await renderComponent();
    runMountEffect();
    await vi.advanceTimersByTimeAsync(300_000);
    expect(states[0].setter).toHaveBeenCalledWith('timeout');

    initialStatusOverride = 'timeout';
    const { tree: timeoutTree, props: timeoutProps } = await renderComponent({
      onResend: waitingProps.onResend,
      resendCooldown: 0,
    });

    const resendButton = findNode(
      timeoutTree,
      (node) =>
        typeof node.type === 'function' &&
        node.type.name === 'ResendButton' &&
        typeof node.props.onResend === 'function',
    );

    expect(resendButton).not.toBeNull();
    (resendButton?.props.onResend as () => void)();
    expect(timeoutProps.onResend).toHaveBeenCalledOnce();
  });
});
