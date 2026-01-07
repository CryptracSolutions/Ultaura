import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addTrustedContact,
  getTrustedContacts,
  removeTrustedContact,
} from '../contacts';
import { cleanupTestData, createTestAccount, createTestLine } from './setup';

describe('contacts', () => {
  let accountId: string;
  let organizationId: number;
  let userId: string;
  let lineId: string;

  beforeAll(async () => {
    const context = await createTestAccount();
    accountId = context.account.id;
    organizationId = context.organization.id;
    userId = context.user.id;

    const line = await createTestLine(accountId);
    lineId = line.id;
  });

  afterAll(async () => {
    await cleanupTestData({ accountId, organizationId, userId });
  });

  it('adds and removes trusted contacts', async () => {
    const addResult = await addTrustedContact(lineId, {
      name: 'Alice Example',
      phoneE164: '+14155550123',
      relationship: 'Daughter',
      notifyOn: ['high'],
    });

    expect(addResult.success).toBe(true);

    const contacts = await getTrustedContacts(lineId);
    expect(contacts.length).toBe(1);

    const removeResult = await removeTrustedContact(contacts[0].id);
    expect(removeResult.success).toBe(true);

    const after = await getTrustedContacts(lineId);
    expect(after.length).toBe(0);
  });
});
