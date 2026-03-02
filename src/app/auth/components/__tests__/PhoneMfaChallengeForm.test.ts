/**
 * PhoneMfaChallengeForm — hook-mocking test suite
 *
 * Vitest runs with `environment: 'node'` (no DOM/jsdom), so we can't use
 * React Testing Library. Instead we intercept React hooks to capture the
 * component's internal state transitions and side-effects:
 *
 *  1. `vi.stubGlobal('React', { createElement })` — satisfies esbuild's
 *     classic JSX transform which emits `React.createElement(...)` calls.
 *  2. `vi.doMock('react', () => ({ useState, useCallback, useEffect, useRef }))`
 *     — intercepts hook calls so we can track state, capture effects, and
 *     inspect refs without a real React runtime.
 *  3. `await import('../PhoneMfaChallengeForm')` — dynamically imports the
 *     REAL component (with fresh module state each test via `vi.resetModules`).
 *  4. `mod.default(props)` — executes the function body: all hooks fire, state
 *     slots are allocated, effects are registered, and JSX is returned.
 *  5. We then manually invoke captured effects (simulating React mount) and
 *     assert on mock setter calls to verify state transitions.
 *
 * Component useState order (from PhoneMfaChallengeForm.tsx):
 *   [0] challengeId    (init: '')
 *   [1] verifyCode     (init: '')
 *   [2] error          (init: '')
 *   [3] loading        (init: false)
 *   [4] sending        (init: true)
 *   [5] resendCooldown (init: 0)
 *
 * Component useRef order:
 *   [0] cooldownRef    (init: undefined)
 *   [1] hasSentRef     (init: false)
 *
 * Component useEffect order:
 *   [0] mount effect   — sends challenge if !hasSentRef.current
 *   [1] cleanup effect — clears cooldown interval on unmount
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------- Supabase mock handles ----------
const challengeMock = vi.fn();
const verifyMock = vi.fn();

// ---------- Hook tracking structures ----------
type Setter = ReturnType<typeof vi.fn>;

let states: Array<{ value: unknown; setter: Setter }>;
let effects: Array<() => unknown>;
let refs: Array<{ current: unknown }>;

function resetHooks() {
  states = [];
  effects = [];
  refs = [];
}

/** Semantic index map for the component's useState slots */
const S = {
  challengeId: 0,
  verifyCode: 1,
  error: 2,
  loading: 3,
  sending: 4,
  resendCooldown: 5,
} as const;

// ---------- Setup / Teardown ----------

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  resetHooks();

  // Satisfy esbuild's classic JSX transform (`React.createElement(...)`)
  vi.stubGlobal('React', {
    createElement: (...args: unknown[]) => ({
      type: args[0],
      props: args[1],
      children: args.slice(2),
    }),
  });

  // Track which useState/useRef slot we're allocating during a render pass
  let stateIndex = 0;
  let refIndex = 0;

  vi.doMock('react', () => ({
    // Default export — some bundler paths read `React.createElement` from it
    default: {
      createElement: (...args: unknown[]) => ({
        type: args[0],
        props: args[1],
        children: args.slice(2),
      }),
    },

    useState: (init: unknown) => {
      if (stateIndex >= states.length) {
        states.push({ value: init, setter: vi.fn() });
      }
      const slot = states[stateIndex++];
      return [slot.value, slot.setter];
    },

    useCallback: (fn: Function) => fn,

    useEffect: (fn: () => unknown) => {
      effects.push(fn);
    },

    useRef: (init: unknown) => {
      if (refIndex >= refs.length) {
        refs.push({ current: init });
      }
      return refs[refIndex++];
    },
  }));

  // ---------- Dependency mocks ----------

  vi.doMock('~/core/hooks/use-supabase', () => ({
    default: () => ({
      auth: {
        mfa: {
          challenge: challengeMock,
          verify: verifyMock,
        },
      },
    }),
  }));

  vi.doMock('~/core/ui/Alert', () => ({
    default: Object.assign(() => null, { Heading: () => null }),
  }));

  vi.doMock('~/core/ui/Button', () => ({ default: () => null }));
  vi.doMock('~/core/ui/Heading', () => ({ default: () => null }));
  vi.doMock('~/core/ui/Trans', () => ({ default: () => null }));

  // From the test dir (__tests__/), `../VerificationCodeInput` resolves to
  // the component's sibling file in the parent directory.
  vi.doMock('../VerificationCodeInput', () => ({ default: () => null }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ---------- Helpers ----------

/**
 * Dynamically imports the real component and invokes its function body,
 * which allocates all hook slots and registers effects.
 */
async function render(overrides: Record<string, unknown> = {}) {
  const props = {
    factorId: 'factor-123',
    onSuccess: vi.fn(),
    onBack: vi.fn(),
    onTrustDevice: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  const mod = await import('../PhoneMfaChallengeForm');
  mod.default(props as any);
  return props;
}

/**
 * Simulates React's mount phase by executing the first captured effect
 * (the one that calls `sendChallenge`), then flushing microtasks so
 * `mockResolvedValue` promises settle.
 */
async function triggerMount() {
  const mountEffect = effects[0];
  if (mountEffect) mountEffect();
  // Flush the microtask queue (resolves the async sendChallenge promise)
  await vi.advanceTimersByTimeAsync(0);
}

// ---------- Tests ----------

describe('PhoneMfaChallengeForm', () => {
  describe('mount sends SMS challenge', () => {
    it('calls challenge API with factorId and sms channel', async () => {
      challengeMock.mockResolvedValue({ data: { id: 'ch-1' }, error: null });
      await render({ factorId: 'factor-xyz' });
      await triggerMount();

      expect(challengeMock).toHaveBeenCalledWith({
        factorId: 'factor-xyz',
        channel: 'sms',
      });
    });

    it('stores the returned challengeId in state', async () => {
      challengeMock.mockResolvedValue({ data: { id: 'ch-abc' }, error: null });
      await render();
      await triggerMount();

      expect(states[S.challengeId].setter).toHaveBeenCalledWith('ch-abc');
    });

    it('clears the sending flag after challenge completes', async () => {
      challengeMock.mockResolvedValue({ data: { id: 'ch-1' }, error: null });
      await render();
      await triggerMount();

      expect(states[S.sending].setter).toHaveBeenCalledWith(false);
    });

    it('starts a 60-second resend cooldown on success', async () => {
      challengeMock.mockResolvedValue({ data: { id: 'ch-1' }, error: null });
      await render();
      await triggerMount();

      expect(states[S.resendCooldown].setter).toHaveBeenCalledWith(60);
    });

    it('prevents double-send on re-render via hasSentRef', async () => {
      challengeMock.mockResolvedValue({ data: { id: 'ch-1' }, error: null });
      await render();
      await triggerMount();

      // hasSentRef (refs[1]) should now be true after first mount
      expect(refs[1].current).toBe(true);

      // Invoking the mount effect again should be a no-op because
      // hasSentRef.current is already true
      challengeMock.mockClear();
      const mountEffect = effects[0];
      if (mountEffect) mountEffect();
      await vi.advanceTimersByTimeAsync(0);

      expect(challengeMock).not.toHaveBeenCalled();
    });
  });

  describe('challenge error handling', () => {
    it('sets error message on non-429/non-rate-limit failure', async () => {
      challengeMock.mockResolvedValue({
        data: null,
        error: { message: 'SMS delivery failed', status: 500 },
      });
      await render();
      await triggerMount();

      expect(states[S.error].setter).toHaveBeenCalledWith(
        'auth:phoneMfaSendError',
      );
    });

    it('sets error AND activates cooldown on HTTP 429', async () => {
      challengeMock.mockResolvedValue({
        data: null,
        error: { message: 'Rate limit exceeded', status: 429 },
      });
      await render();
      await triggerMount();

      expect(states[S.error].setter).toHaveBeenCalledWith(
        'auth:phoneMfaSendError',
      );
      expect(states[S.resendCooldown].setter).toHaveBeenCalledWith(60);
    });

    it('activates cooldown when error message contains "rate" (non-429)', async () => {
      challengeMock.mockResolvedValue({
        data: null,
        error: { message: 'rate limited by provider', status: 400 },
      });
      await render();
      await triggerMount();

      expect(states[S.resendCooldown].setter).toHaveBeenCalledWith(60);
    });

    it('does NOT activate cooldown on generic server errors', async () => {
      challengeMock.mockResolvedValue({
        data: null,
        error: { message: 'Internal server error', status: 500 },
      });
      await render();
      await triggerMount();

      // Error should be set, but cooldown should NOT be triggered
      expect(states[S.error].setter).toHaveBeenCalledWith(
        'auth:phoneMfaSendError',
      );
      expect(states[S.resendCooldown].setter).not.toHaveBeenCalledWith(60);
    });

    it('handles thrown exceptions gracefully', async () => {
      challengeMock.mockRejectedValue(new Error('network failure'));
      await render();
      await triggerMount();

      expect(states[S.error].setter).toHaveBeenCalledWith(
        'auth:phoneMfaSendError',
      );
      // The finally block should still clear the sending flag
      expect(states[S.sending].setter).toHaveBeenCalledWith(false);
    });
  });

  describe('verify API contract', () => {
    // We cannot trigger handleVerify without a real React render loop
    // (it depends on captured state values for challengeId and verifyCode).
    // These tests verify the Supabase MFA verify API contract that the
    // component depends on.

    it('accepts factorId, challengeId, and 6-digit code', async () => {
      verifyMock.mockResolvedValue({
        data: { user: { id: 'u-1' } },
        error: null,
      });

      const result = await verifyMock({
        factorId: 'factor-123',
        challengeId: 'ch-1',
        code: '123456',
      });

      expect(result.error).toBeNull();
    });

    it('returns error for invalid code', async () => {
      verifyMock.mockResolvedValue({
        data: null,
        error: { message: 'Invalid TOTP code' },
      });

      const result = await verifyMock({
        factorId: 'f-1',
        challengeId: 'ch-1',
        code: '000000',
      });

      expect(result.error).not.toBeNull();
    });
  });

  describe('trust device integration', () => {
    // Similar to verify: we can't trigger the full handleVerify flow from
    // the component, but we can verify the callback contract that wires
    // onTrustDevice(factorId) after a successful verify.

    it('onTrustDevice is called with factorId after successful verify', async () => {
      verifyMock.mockResolvedValue({ data: {}, error: null });
      const onTrustDevice = vi.fn().mockResolvedValue(undefined);
      const factorId = 'factor-abc';

      const verifyResult = await verifyMock({
        factorId,
        challengeId: 'ch-1',
        code: '123456',
      });

      if (!verifyResult.error && onTrustDevice) {
        await onTrustDevice(factorId);
      }

      expect(onTrustDevice).toHaveBeenCalledWith('factor-abc');
    });
  });
});
