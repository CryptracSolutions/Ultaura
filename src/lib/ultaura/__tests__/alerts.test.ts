import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WellnessAlert } from '../types';

const mocks = vi.hoisted(() => ({
  getSupabaseServerActionClient: vi.fn(),
  requireSession: vi.fn(async () => ({ user: { id: 'user-1' } })),
  getSharingGate: vi.fn(),
  redactAlertByTier: vi.fn((alert: WellnessAlert) => alert),
}));

vi.mock('~/core/supabase/action-client', () => ({
  default: mocks.getSupabaseServerActionClient,
}));

vi.mock('~/lib/user/require-session', () => ({
  default: mocks.requireSession,
}));

vi.mock('~/core/logger', () => ({
  default: vi.fn(() => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('../sharing-gate', () => ({
  getSharingGate: mocks.getSharingGate,
}));

vi.mock('../alerts-redaction', () => ({
  redactAlertByTier: mocks.redactAlertByTier,
}));

import { getWellnessAlerts } from '../alerts';

const baseAlertRow = {
  id: 'alert-1',
  line_id: 'line-1',
  created_at: '2026-01-01T00:00:00.000Z',
  alert_type: 'mood_drop',
  severity: 'medium',
  title: 'Check-in needed',
  summary: 'Summary',
  acknowledged_at: null,
  ultaura_lines: { display_name: 'Grandma Rose' },
};

function createUserClient(options: {
  accountData: { id: string } | null;
  accountError?: { message: string } | null;
  viewerData?: boolean;
  viewerError?: { message: string } | null;
}) {
  const maybeSingle = vi.fn(async () => ({
    data: options.accountData,
    error: options.accountError ?? null,
  }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn((table: string) => {
    if (table === 'ultaura_accounts') {
      return { select };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  const rpc = vi.fn(async (fn: string) => {
    if (fn !== 'is_dashboard_viewer') {
      throw new Error(`Unexpected rpc: ${fn}`);
    }

    return {
      data: options.viewerData ?? false,
      error: options.viewerError ?? null,
    };
  });

  return { client: { from, rpc }, calls: { from, select, eq, maybeSingle, rpc } };
}

function createAdminClient(alertRows: typeof baseAlertRow[]) {
  const limit = vi.fn(async () => ({ data: alertRows, error: null }));
  const order = vi.fn(() => ({ limit }));
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn((table: string) => {
    if (table === 'ultaura_wellness_alerts') {
      return { select };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return { client: { from }, calls: { from, select, eq, order, limit } };
}

function useSupabaseClients(
  userClient: ReturnType<typeof createUserClient>['client'],
  adminClient: ReturnType<typeof createAdminClient>['client'],
) {
  mocks.getSupabaseServerActionClient.mockImplementation((options?: { admin?: boolean }) => (
    options?.admin ? adminClient : userClient
  ));
}

describe('getWellnessAlerts authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getSharingGate.mockResolvedValue({
      canAccessNonSafety: true,
      effectiveTier: 'tier_4',
      allowMood: true,
      allowTopics: true,
      allowConcerns: true,
      isFamilyOutputSuppressed: false,
      isSelfUser: true,
      insightsEnabled: true,
    });
  });

  it('allows account owners to load alerts', async () => {
    const user = createUserClient({ accountData: { id: 'account-1' }, viewerData: false });
    const admin = createAdminClient([baseAlertRow]);

    useSupabaseClients(user.client, admin.client);

    const alerts = await getWellnessAlerts('account-1', { limit: 25 });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.lineName).toBe('Grandma Rose');
    expect(user.calls.eq).toHaveBeenCalledWith('id', 'account-1');
    expect(admin.calls.limit).toHaveBeenCalledWith(25);
  });

  it('allows authorized viewers to load alerts', async () => {
    const user = createUserClient({ accountData: { id: 'account-1' }, viewerData: true });
    const admin = createAdminClient([baseAlertRow]);

    mocks.getSharingGate.mockResolvedValue({
      canAccessNonSafety: true,
      effectiveTier: 'tier_2',
      allowMood: true,
      allowTopics: false,
      allowConcerns: false,
      isFamilyOutputSuppressed: false,
      isSelfUser: false,
      insightsEnabled: true,
    });

    useSupabaseClients(user.client, admin.client);

    const alerts = await getWellnessAlerts('account-1');

    expect(alerts).toHaveLength(1);
    expect(mocks.redactAlertByTier).toHaveBeenCalledTimes(1);
    expect(user.calls.eq).toHaveBeenCalledWith('id', 'account-1');
  });

  it('denies non-members', async () => {
    const user = createUserClient({ accountData: null });
    const admin = createAdminClient([baseAlertRow]);

    useSupabaseClients(user.client, admin.client);

    await expect(getWellnessAlerts('account-1')).rejects.toThrow('Access denied');
    expect(admin.calls.from).not.toHaveBeenCalled();
    expect(user.calls.rpc).not.toHaveBeenCalled();
  });

  it('never treats viewers as self-mode when gate resolves self user', async () => {
    const user = createUserClient({ accountData: { id: 'account-1' }, viewerData: true });
    const admin = createAdminClient([baseAlertRow]);

    mocks.getSharingGate.mockResolvedValue({
      canAccessNonSafety: true,
      effectiveTier: 'tier_2',
      allowMood: true,
      allowTopics: false,
      allowConcerns: false,
      isFamilyOutputSuppressed: false,
      isSelfUser: true,
      insightsEnabled: true,
    });

    useSupabaseClients(user.client, admin.client);

    const alerts = await getWellnessAlerts('account-1');

    expect(alerts).toHaveLength(1);
    expect(mocks.redactAlertByTier).toHaveBeenCalledTimes(1);
    expect(mocks.redactAlertByTier).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'alert-1' }),
      'tier_2',
    );
  });
});
