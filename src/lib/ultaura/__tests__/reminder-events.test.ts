import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { createReminder } from '../reminders';
import { getLineReminderEvents, getReminderEvents, logReminderEvent } from '../reminder-events';
import { cleanupTestData, createTestAccount, createTestLine } from './setup';

describe('reminder events', () => {
  let accountId: string;
  let organizationId: number;
  let userId: string;
  let lineId: string;
  let reminderId: string;
  let reminderMessage: string;

  beforeAll(async () => {
    const context = await createTestAccount();
    accountId = context.account.id;
    organizationId = context.organization.id;
    userId = context.user.id;

    const line = await createTestLine(accountId);
    lineId = line.id;

    reminderMessage = 'Event test reminder';
    const dueAt = DateTime.now()
      .setZone('America/Los_Angeles')
      .plus({ days: 1 })
      .toFormat("yyyy-MM-dd'T'HH:mm:ss");

    const created = await createReminder({
      lineId,
      dueAt,
      message: reminderMessage,
      timezone: 'America/Los_Angeles',
    });

    if (!created.success) {
      throw new Error(created.error.message);
    }

    reminderId = created.data.id;
  });

  afterAll(async () => {
    await cleanupTestData({ accountId, organizationId, userId });
  });

  it('logs and retrieves reminder events', async () => {
    const result = await logReminderEvent({
      accountId,
      reminderId,
      lineId,
      eventType: 'created',
      triggeredBy: 'dashboard',
      metadata: { source: 'unit-test' },
    });

    expect(result.success).toBe(true);

    const events = await getReminderEvents(reminderId);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].event_type).toBe('created');

    const lineEvents = await getLineReminderEvents(lineId, 10);
    expect(lineEvents[0].reminder_message).toBe(reminderMessage);
  });
});
