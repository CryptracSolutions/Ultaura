import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let authStateChangeCallback:
  | ((event: string, session: { user?: { id: string; email?: string; phone?: string } } | null) => void)
  | null = null;

const routerRefreshMock = vi.fn();
const setUserSessionMock = vi.fn();
const unsubscribeMock = vi.fn();
const windowAssignMock = vi.fn();
let pathname = '/';

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  authStateChangeCallback = null;
  pathname = '/';

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

  vi.stubGlobal('window', {
    location: {
      get pathname() {
        return pathname;
      },
      assign: windowAssignMock,
    },
  });

  vi.doMock('react', () => ({
    default: {
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
    },
    useEffect: (fn: () => void | (() => void)) => {
      fn();
    },
    useCallback: (fn: Function) => fn,
    useContext: () => ({
      setUserSession: setUserSessionMock,
    }),
  }));

  vi.doMock('next/navigation', () => ({
    useRouter: () => ({
      refresh: routerRefreshMock,
    }),
  }));

  vi.doMock('~/core/generic/is-browser', () => ({
    __esModule: true,
    default: () => true,
  }));

  vi.doMock('~/core/hooks/use-supabase', () => ({
    __esModule: true,
    default: () => ({
      auth: {
        onAuthStateChange: (
          callback: (event: string, session: { user?: { id: string; email?: string; phone?: string } } | null) => void,
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

  vi.doMock('~/core/session/contexts/user-session', () => ({
    __esModule: true,
    default: {},
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('AuthChangeListener', () => {
  it('does not refresh auth routes on sign-in', async () => {
    pathname = '/auth/sign-up';

    const mod = await import('~/components/AuthChangeListener');
    mod.default({ children: null });

    authStateChangeCallback?.('SIGNED_IN', {
      user: {
        id: 'user-1',
        email: 'invitee@example.com',
      },
    });

    expect(routerRefreshMock).not.toHaveBeenCalled();
  });

  it('still refreshes non-auth routes on sign-in', async () => {
    pathname = '/dashboard';

    const mod = await import('~/components/AuthChangeListener');
    mod.default({ children: null });

    authStateChangeCallback?.('SIGNED_IN', {
      user: {
        id: 'user-1',
        email: 'invitee@example.com',
      },
    });

    expect(routerRefreshMock).toHaveBeenCalledOnce();
  });
});
