import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLine, deleteLine, getLine, updateLine } from '../lines';
import { cleanupTestData, createTestAccount } from './setup';

describe('lines', () => {
  let accountId: string;
  let organizationId: number;
  let userId: string;

  beforeAll(async () => {
    const context = await createTestAccount();
    accountId = context.account.id;
    organizationId = context.organization.id;
    userId = context.user.id;
  });

  afterAll(async () => {
    await cleanupTestData({ accountId, organizationId, userId });
  });

  it('creates, updates, and deletes a line', async () => {
    const phoneE164 = `+1415555${String(Date.now()).slice(-4)}`;
    const created = await createLine({
      accountId,
      displayName: 'Test Line',
      phoneE164,
      timezone: 'America/Los_Angeles',
    });

    expect(created.success).toBe(true);
    const lineId = created.success ? created.data.lineId : '';

    const line = await getLine(lineId);
    expect(line?.display_name).toBe('Test Line');

    const updated = await updateLine(lineId, { displayName: 'Updated Line' });
    expect(updated.success).toBe(true);

    const updatedLine = await getLine(lineId);
    expect(updatedLine?.display_name).toBe('Updated Line');

    const removed = await deleteLine(lineId);
    expect(removed.success).toBe(true);

    const deletedLine = await getLine(lineId);
    expect(deletedLine).toBeNull();
  });
});
