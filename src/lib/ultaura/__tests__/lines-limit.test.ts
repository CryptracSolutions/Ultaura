/**
 * Tests for line-limit null-handling behavior.
 *
 * The PAYG plan uses linesIncluded: null to mean "unlimited".
 * Other plans use numeric limits (Care=1, Comfort=2, Family=4).
 *
 * This file covers three areas:
 *   1. Server-side enforcement in createLine (via createLineWithTrial)
 *   2. getPlanLinesLimit helper (tested indirectly via PLANS constant)
 *   3. canAddLine client-side boolean logic
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCodes } from '@ultaura/schemas';
import { PLANS } from '../constants';

// ============================================================
// Module mocks — declared before any imports
// ============================================================

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('~/core/logger', () => ({
  default: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// We mock getPlan and getUltauraAccountById from helpers so tests
// can control what plan data the limit-check code sees, without
// needing a real database.
vi.mock('~/lib/ultaura/helpers', async (importActual) => {
  const actual = await importActual<typeof import('../helpers')>();
  return {
    ...actual,
    getUltauraAccountById: vi.fn(),
    getPlan: vi.fn(),
  };
});

// The Supabase client mock needs to handle two separate call contexts
// within createLine:
//
//   Call 1 (from getLines): from().select().eq().order() → returns lines list
//   Call 2 (from createLineWithTrial body):
//     from().select().eq().single()         → phone uniqueness check (returns null)
//     from().select().eq().like()           → short-id check (returns empty array)
//     from().insert().select().single()     → insert returns the new line row
//
// getSupabaseServerComponentClient() is called once inside getLines
// and once inside createLineWithTrial (after the limit guard). We use
// a call counter to give the first client call the lines-list behavior
// and the second call the post-limit-check behavior.

let mockLinesResult: { data: { id: string }[] | null; error: null } = {
  data: [],
  error: null,
};

// Client returned on the FIRST call to getSupabaseServerComponentClient()
// — used by getLines() to fetch existing lines.
const buildGetLinesClient = () => ({
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockImplementation(() => Promise.resolve(mockLinesResult)),
  })),
});

// Client returned on the SECOND call to getSupabaseServerComponentClient()
// — used inside createLineWithTrial after the limit guard.
const buildCreateLineClient = () => {
  // single() is called twice on different chains:
  //   1. phone uniqueness check → null (no duplicate)
  //   2. insert result → new line row
  const singleMock = vi.fn()
    .mockResolvedValueOnce({ data: null, error: null })
    .mockResolvedValueOnce({ data: { id: 'new-line-id', short_id: 'abcd1234' }, error: null });

  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    like: vi.fn().mockResolvedValue({ data: null, error: null }), // short-id check
    insert: vi.fn().mockReturnThis(),
    single: singleMock,
  };

  return { from: vi.fn(() => chain) };
};

let serverComponentCallCount = 0;

vi.mock('~/core/supabase/server-component-client', () => ({
  default: vi.fn(() => {
    serverComponentCallCount += 1;
    if (serverComponentCallCount === 1) {
      return buildGetLinesClient();
    }
    return buildCreateLineClient();
  }),
}));

vi.mock('~/core/supabase/action-client', () => ({
  default: vi.fn(() => ({
    from: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    })),
  })),
}));

// Lazy imports — after vi.mock calls
import { createLine } from '../lines';
import { getUltauraAccountById, getPlan } from '../helpers';

// ============================================================
// Shared test fixtures
// ============================================================

const ACCOUNT_PAYG_ID = '550e8400-e29b-41d4-a716-446655440001';
const ACCOUNT_COMFORT_ID = '550e8400-e29b-41d4-a716-446655440002';

const makeAccount = (id: string, planId: string) =>
  ({
    id,
    organization_id: 1,
    name: 'Test Account',
    billing_email: 'test@example.com',
    status: 'active',
    plan_id: planId,
    trial_plan_id: null,
    trial_ends_at: null,
    minutes_included: 0,
    minutes_used: 0,
    cycle_start: new Date().toISOString(),
    cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    created_by_user_id: 'user-1',
    user_type: 'family_managed',
  }) as never;

/** Valid input that passes CreateLineInputSchema */
const makeValidInput = (accountId: string) => ({
  accountId,
  displayName: 'Test Line',
  phoneE164: '+14155550100',
  timezone: 'America/Los_Angeles',
});

/** Returns an array of minimal line stubs with the given length */
function makeLineStubs(count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: `line-stub-${i}` }));
}

// ============================================================
// Section 1 — Server-side enforcement (createLine)
// ============================================================

describe('createLine — line limit enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverComponentCallCount = 0;
    mockLinesResult = { data: [], error: null };
  });

  it('PAYG plan (null limit) allows creation even with many existing lines', async () => {
    mockLinesResult = { data: makeLineStubs(10) as never, error: null };
    vi.mocked(getUltauraAccountById).mockResolvedValue(makeAccount(ACCOUNT_PAYG_ID, 'payg'));
    vi.mocked(getPlan).mockResolvedValue({ lines_included: null } as never);

    const result = await createLine(makeValidInput(ACCOUNT_PAYG_ID));

    expect(result.success).toBe(true);
  });

  it('numeric plan limit blocks creation when at capacity', async () => {
    mockLinesResult = { data: makeLineStubs(2) as never, error: null };
    vi.mocked(getUltauraAccountById).mockResolvedValue(makeAccount(ACCOUNT_COMFORT_ID, 'comfort'));
    vi.mocked(getPlan).mockResolvedValue({ lines_included: 2 } as never);

    const result = await createLine(makeValidInput(ACCOUNT_COMFORT_ID));

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected failure');
    expect(result.error.code).toBe(ErrorCodes.LINE_LIMIT_REACHED);
  });

  it('numeric plan limit allows creation when below capacity', async () => {
    mockLinesResult = { data: makeLineStubs(1) as never, error: null };
    vi.mocked(getUltauraAccountById).mockResolvedValue(makeAccount(ACCOUNT_COMFORT_ID, 'comfort'));
    vi.mocked(getPlan).mockResolvedValue({ lines_included: 2 } as never);

    const result = await createLine(makeValidInput(ACCOUNT_COMFORT_ID));

    expect(result.success).toBe(true);
  });

  it('plan lookup failure returns DATABASE_ERROR (fail-closed behavior)', async () => {
    mockLinesResult = { data: makeLineStubs(0) as never, error: null };
    vi.mocked(getUltauraAccountById).mockResolvedValue(makeAccount(ACCOUNT_PAYG_ID, 'payg'));
    vi.mocked(getPlan).mockResolvedValue(null);

    const result = await createLine(makeValidInput(ACCOUNT_PAYG_ID));

    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected failure');
    expect(result.error.code).toBe(ErrorCodes.DATABASE_ERROR);
  });
});

// ============================================================
// Section 2 — getPlanLinesLimit (tested via PLANS constant)
//
// getPlanLinesLimit is a private function inside lines/page.tsx,
// so we replicate its exact two-line body here. This verifies both
// the logic and the underlying PLANS constant values it reads from.
// ============================================================

function getPlanLinesLimit(planId: string): number | null {
  const plan = PLANS[planId as keyof typeof PLANS];
  return plan ? plan.linesIncluded : 1;
}

describe('getPlanLinesLimit', () => {
  it('returns null for PAYG (unlimited lines)', () => {
    expect(getPlanLinesLimit('payg')).toBeNull();
  });

  it('returns 1 for the Care plan', () => {
    expect(getPlanLinesLimit('care')).toBe(1);
  });

  it('returns 2 for the Comfort plan', () => {
    expect(getPlanLinesLimit('comfort')).toBe(2);
  });

  it('returns 4 for the Family plan', () => {
    expect(getPlanLinesLimit('family')).toBe(4);
  });

  it('returns 1 as a safe fallback for an unknown plan ID', () => {
    expect(getPlanLinesLimit('nonexistent')).toBe(1);
  });
});

// ============================================================
// Section 3 — canAddLine client-side boolean logic
//
// Mirrors the exact expression in LinesPageClient.tsx:
//   const hasUnlimitedLines = planLinesLimit === null;
//   const canAddLine = !disabled && (hasUnlimitedLines || lines.length < planLinesLimit);
// ============================================================

function canAddLine(
  planLinesLimit: number | null,
  lineCount: number,
  disabled = false,
): boolean {
  const hasUnlimitedLines = planLinesLimit === null;
  return !disabled && (hasUnlimitedLines || lineCount < (planLinesLimit ?? 0));
}

describe('canAddLine logic', () => {
  it('null planLinesLimit always allows adding regardless of line count', () => {
    expect(canAddLine(null, 0)).toBe(true);
    expect(canAddLine(null, 5)).toBe(true);
    expect(canAddLine(null, 100)).toBe(true);
  });

  it('null planLinesLimit is still blocked when disabled=true', () => {
    expect(canAddLine(null, 0, true)).toBe(false);
    expect(canAddLine(null, 99, true)).toBe(false);
  });

  it('numeric planLinesLimit blocks at capacity', () => {
    expect(canAddLine(2, 2)).toBe(false);
    expect(canAddLine(2, 3)).toBe(false);
  });

  it('numeric planLinesLimit allows below capacity', () => {
    expect(canAddLine(2, 0)).toBe(true);
    expect(canAddLine(2, 1)).toBe(true);
  });

  it('numeric planLinesLimit is blocked when disabled=true even if below capacity', () => {
    expect(canAddLine(2, 0, true)).toBe(false);
    expect(canAddLine(2, 1, true)).toBe(false);
  });
});
