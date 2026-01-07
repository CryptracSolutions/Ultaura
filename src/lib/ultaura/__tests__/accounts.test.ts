import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getOrCreateUltauraAccount, getUltauraAccount } from '../accounts';
import {
  cleanupTestData,
  createTestOrganization,
  createTestUser,
} from './setup';

describe('accounts', () => {
  let organizationId: number;
  let userId: string;
  let email: string;
  let accountId: string;

  beforeAll(async () => {
    const user = await createTestUser();
    userId = user.user.id;
    email = user.email;
    const organization = await createTestOrganization(userId);
    organizationId = organization.id;
  });

  afterAll(async () => {
    await cleanupTestData({ accountId, organizationId, userId });
  });

  it('creates and fetches an Ultaura account', async () => {
    const first = await getOrCreateUltauraAccount(
      organizationId,
      userId,
      'Test Account',
      email
    );

    accountId = first.accountId;
    expect(first.isNew).toBe(true);

    const second = await getOrCreateUltauraAccount(
      organizationId,
      userId,
      'Test Account',
      email
    );

    expect(second.isNew).toBe(false);
    expect(second.accountId).toBe(accountId);

    const account = await getUltauraAccount(organizationId);
    expect(account?.id).toBe(accountId);
  });
});
