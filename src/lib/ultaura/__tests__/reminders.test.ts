import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

  beforeAll(async () => {
    const context = await createTestAccount();
    accountId = context.account.id;
    organizationId = context.organization.id;
    userId = context.user.id;

    const line = await createTestLine(accountId, {
      timezone: 'America/Los_Angeles',
    });
    lineId = line.id;
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

    await snoozeReminder(reminderId, 15);
    await snoozeReminder(reminderId, 15);
    await snoozeReminder(reminderId, 15);

    const fourth = await snoozeReminder(reminderId, 15);
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

    const firstPause = await pauseReminder(reminderId);
    expect(firstPause.success).toBe(true);

    const secondPause = await pauseReminder(reminderId);
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
