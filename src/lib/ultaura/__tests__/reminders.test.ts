import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DateTime } from 'luxon';
import { ErrorCodes } from '@ultaura/schemas';
import {
  createReminder,
  pauseReminder,
  snoozeReminder,
} from '../reminders';
import { getNextReminderOccurrence } from '../timezone';
import { cleanupTestData, createTestAccount, createTestLine } from './setup';

describe('reminders', () => {
  let accountId: string;
  let organizationId: number;
  let userId: string;
  let lineId: string;
  let lineShortId: string;

  beforeAll(async () => {
    const context = await createTestAccount();
    accountId = context.account.id;
    organizationId = context.organization.id;
    userId = context.user.id;

    const line = await createTestLine(accountId, {
      timezone: 'America/Los_Angeles',
    });
    lineId = line.id;
    lineShortId = line.short_id;
  });

  afterAll(async () => {
    await cleanupTestData({ accountId, organizationId, userId });
  });

  it('stores reminder dueAt as UTC for local input', async () => {
    const target = DateTime.now()
      .setZone('America/Los_Angeles')
      .plus({ days: 1 })
      .set({ hour: 14, minute: 0, second: 0, millisecond: 0 });

    const dueAtLocal = target.toFormat("yyyy-MM-dd'T'HH:mm:ss");

    const result = await createReminder({
      lineId,
      dueAt: dueAtLocal,
      message: 'Take medication',
      timezone: 'America/Los_Angeles',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    const storedUtc = DateTime.fromISO(result.data.due_at, { zone: 'UTC' });
    const expectedUtc = target.toUTC();
    expect(storedUtc.toISO()).toBe(expectedUtc.toISO());
  });

  it('enforces the snooze limit', async () => {
    const dueAt = DateTime.now()
      .setZone('America/Los_Angeles')
      .plus({ days: 1 })
      .toFormat("yyyy-MM-dd'T'HH:mm:ss");

    const created = await createReminder({
      lineId,
      dueAt,
      message: 'Daily check-in',
      timezone: 'America/Los_Angeles',
    });

    expect(created.success).toBe(true);
    if (!created.success) return;

    const reminderId = created.data.id;

    await snoozeReminder(reminderId, 15, lineShortId);
    await snoozeReminder(reminderId, 15, lineShortId);
    await snoozeReminder(reminderId, 15, lineShortId);

    const fourth = await snoozeReminder(reminderId, 15, lineShortId);
    expect(fourth.success).toBe(false);
    if (!fourth.success) {
      expect(fourth.error.code).toBe(ErrorCodes.SNOOZE_LIMIT_REACHED);
    }
  });

  it('does not allow pausing a reminder twice', async () => {
    const dueAt = DateTime.now()
      .setZone('America/Los_Angeles')
      .plus({ days: 2 })
      .toFormat("yyyy-MM-dd'T'HH:mm:ss");

    const created = await createReminder({
      lineId,
      dueAt,
      message: 'Pause test',
      timezone: 'America/Los_Angeles',
    });

    expect(created.success).toBe(true);
    if (!created.success) return;

    const reminderId = created.data.id;

    const firstPause = await pauseReminder(reminderId, lineShortId);
    expect(firstPause.success).toBe(true);

    const secondPause = await pauseReminder(reminderId, lineShortId);
    expect(secondPause.success).toBe(false);
    if (!secondPause.success) {
      expect(secondPause.error.code).toBe(ErrorCodes.REMINDER_NOT_PAUSABLE);
    }
  });

  it('calculates next monthly occurrence by clamping to month length', () => {
    const currentDueAt = DateTime.fromISO('2023-01-31T09:00:00', {
      zone: 'America/New_York',
    })
      .toUTC()
      .toJSDate();

    const next = getNextReminderOccurrence({
      rrule: 'FREQ=MONTHLY;BYMONTHDAY=31',
      timezone: 'America/New_York',
      timeOfDay: '09:00',
      currentDueAt,
      dayOfMonth: 31,
    });

    expect(next).not.toBeNull();
    if (!next) return;

    const local = DateTime.fromJSDate(next).setZone('America/New_York');
    expect(local.month).toBe(2);
    expect(local.day).toBe(28);
  });
});

describe('reminder error mapping', () => {
  it('maps U0001 insert errors to REMINDER_LIMIT_REACHED', async () => {
    vi.resetModules();
    vi.doMock('server-only', () => ({}));

    const mockInsertSingle = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: 'U0001',
        message: 'REMINDER_LIMIT_REACHED: line reminder limit exceeded',
      },
    });
    const mockInsertBuilder: any = {
      select: vi.fn(),
      single: mockInsertSingle,
    };
    mockInsertBuilder.select.mockReturnValue(mockInsertBuilder);
    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table !== 'ultaura_reminders') {
          throw new Error(`Unexpected table: ${table}`);
        }
        return {
          insert: vi.fn().mockReturnValue(mockInsertBuilder),
        };
      }),
    };

    vi.doMock('~/core/supabase/server-component-client', () => ({
      default: vi.fn(() => mockClient),
    }));
    vi.doMock('~/core/supabase/action-client', () => ({
      default: vi.fn(() => ({})),
    }));
    vi.doMock('../lines', () => ({
      getLine: vi.fn().mockResolvedValue({
        id: 'line-1',
        short_id: 'LS1',
        account_id: 'acct-1',
        timezone: 'America/Los_Angeles',
        created_at: '2025-01-01T00:00:00.000Z',
      }),
    }));
    vi.doMock('../helpers', () => ({
      getUltauraAccountById: vi.fn().mockResolvedValue({
        id: 'acct-1',
      }),
      withTrialCheck: (fn: (...args: any[]) => unknown) => fn,
    }));
    vi.doMock('../reminder-crypto', () => ({
      encryptReminderMessage: vi.fn().mockResolvedValue({
        ciphertext: Buffer.from('cipher'),
        iv: Buffer.from('iv'),
        tag: Buffer.from('tag'),
        alg: 'AES-256-GCM',
        kid: 'kek_v1',
      }),
      buildReminderSearchTokens: vi.fn().mockResolvedValue([]),
      decryptReminderMessagesForLine: vi.fn().mockResolvedValue([]),
    }));

    const { createReminder: mockedCreateReminder } = await import('../reminders');

    const result = await mockedCreateReminder({
      lineId: 'line-1',
      dueAt: '2030-01-02T09:00:00',
      message: 'Test reminder',
      timezone: 'America/Los_Angeles',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ErrorCodes.REMINDER_LIMIT_REACHED);
    }

    vi.doUnmock('~/core/supabase/server-component-client');
    vi.doUnmock('~/core/supabase/action-client');
    vi.doUnmock('../lines');
    vi.doUnmock('../helpers');
    vi.doUnmock('../reminder-crypto');
    vi.doUnmock('server-only');
    vi.resetModules();
  });
});
