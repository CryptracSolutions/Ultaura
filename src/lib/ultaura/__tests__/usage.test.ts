import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getUsageSummary, updateOverageCap } from '../usage';
import { cleanupTestData, createTestAccount, testServiceRoleClient } from './setup';

describe('usage', () => {
  let accountId: string;
  let organizationId: number;
  let userId: string;

  beforeAll(async () => {
    const context = await createTestAccount({ minutesIncluded: 300 });
    accountId = context.account.id;
    organizationId = context.organization.id;
    userId = context.user.id;
  });

  afterAll(async () => {
    await cleanupTestData({ accountId, organizationId, userId });
  });

  it('returns usage summary for an account', async () => {
    const summary = await getUsageSummary(accountId);
    expect(summary?.minutesIncluded).toBe(300);
    expect(summary?.minutesUsed).toBe(0);
  });

  it('updates the overage cap', async () => {
    const result = await updateOverageCap(accountId, 5000);
    expect(result.success).toBe(true);

    const { data } = await testServiceRoleClient
      .from('ultaura_accounts')
      .select('overage_cents_cap')
      .eq('id', accountId)
      .single();

    expect(data?.overage_cents_cap).toBe(5000);
  });
});
