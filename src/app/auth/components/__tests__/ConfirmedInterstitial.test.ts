import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Setter = ReturnType<typeof vi.fn<any[], unknown>>;

let states: Array<{ value: unknown; setter: Setter }> = [];
let effects: Array<() => void | (() => void)> = [];
const routerReplaceMock = vi.fn();

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.clearAllMocks();
  states = [];
  effects = [];

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
    useState: (initialValue: unknown) => {
      if (stateIndex >= states.length) {
        states.push({
          value: initialValue,
          setter: vi.fn<any[], unknown>(),
        });
      }

      const slot = states[stateIndex++];
      return [slot.value, slot.setter];
    },
    useEffect: (fn: () => void | (() => void)) => {
      effects.push(fn);
    },
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

  vi.doMock('~/core/ui/Trans', () => ({
    default: 'trans',
  }));

  vi.doMock('~/core/ui/Spinner', () => ({
    __esModule: true,
    default: () => ({ type: 'spinner', props: {}, children: [] }),
  }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function findNode(
  node: unknown,
  predicate: (value: { type: unknown; props: Record<string, unknown>; children: unknown[] }) => boolean,
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

describe('ConfirmedInterstitial', () => {
  it('does not auto-redirect when autoRedirect is false and waits for manual continue', async () => {
    const mod = await import('~/app/auth/confirmed/ConfirmedInterstitial');
    const tree = mod.default({ next: '/dashboard', autoRedirect: false });

    const mountEffect = effects[0];
    mountEffect?.();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(routerReplaceMock).not.toHaveBeenCalled();

    const continueButton = findNode(
      tree,
      (node) => node.type === 'button' && typeof node.props.onClick === 'function',
    );

    expect(continueButton).not.toBeNull();
    (continueButton?.props.onClick as () => void)();
    expect(routerReplaceMock).toHaveBeenCalledWith('/dashboard');
  });

  it('keeps auto-redirect behavior when autoRedirect is true', async () => {
    const mod = await import('~/app/auth/confirmed/ConfirmedInterstitial');
    mod.default({ next: '/onboarding', autoRedirect: true });

    const mountEffect = effects[0];
    mountEffect?.();

    await vi.advanceTimersByTimeAsync(3_000);
    expect(routerReplaceMock).toHaveBeenCalledWith('/onboarding');
  });
});
