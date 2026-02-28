import { beforeEach, describe, expect, it, vi } from 'vitest';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('useAutoSave retry await semantics', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('flush waits for queued retry save before resolving', async () => {
    vi.doMock('react', () => {
      const hookState: unknown[] = [];
      let cursor = 0;

      const nextIndex = () => {
        const current = cursor;
        cursor += 1;
        return current;
      };

      return {
        useState: (initial: unknown) => {
          const index = nextIndex();
          if (!(index in hookState)) {
            hookState[index] = initial;
          }
          const setValue = (next: unknown) => {
            hookState[index] =
              typeof next === 'function'
                ? (next as (value: unknown) => unknown)(hookState[index])
                : next;
          };
          return [hookState[index], setValue];
        },
        useRef: (initial: unknown) => ({ current: initial }),
        useCallback: <T extends (...args: any[]) => any>(fn: T) => fn,
        useEffect: (fn: () => void | (() => void)) => {
          fn();
        },
      };
    });
    vi.doMock('sonner', () => ({
      toast: {
        success: vi.fn(),
        error: vi.fn(),
      },
    }));

    const { useAutoSave } = await import('~/core/hooks/use-auto-save');
    const first = createDeferred<{ success: boolean }>();
    const second = createDeferred<{ success: boolean }>();
    let hook!: ReturnType<typeof useAutoSave<string>>;
    const saveFn = vi.fn((value: string) => {
      if (value === 'first') {
        hook.triggerSave('second');
        return first.promise;
      }
      return second.promise;
    });
    hook = useAutoSave<string>({ saveFn, delay: 0 });

    hook.triggerSave('first');
    const flushPromise = hook.flush();
    await Promise.resolve();
    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(saveFn).toHaveBeenNthCalledWith(1, 'first');

    let flushResolved = false;
    void flushPromise.then(() => {
      flushResolved = true;
    });

    first.resolve({ success: true });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(saveFn).toHaveBeenCalledTimes(2);
    expect(saveFn).toHaveBeenNthCalledWith(2, 'second');
    expect(flushResolved).toBe(false);

    second.resolve({ success: true });
    await flushPromise;
    expect(flushResolved).toBe(true);
  });
});
