import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  cleanupTestData,
  createAnonClient,
  createTestAccount,
  createTestLine,
  createTestOrganization,
  testServiceRoleClient,
} from './setup';

describe('RLS policies', () => {
  let accountId: string;
  let organizationId: number;
  let userId: string;
  let email: string;
  let password: string;
  let lineId: string;
  let otherAccountId: string;
  let otherOrganizationId: number;
  let otherLineId: string;

  beforeAll(async () => {
    const context = await createTestAccount();
    accountId = context.account.id;
    organizationId = context.organization.id;
    userId = context.user.id;
    email = context.email;
    password = context.password;

    const line = await createTestLine(accountId);
    lineId = line.id;

    const otherOrg = await createTestOrganization();
    otherOrganizationId = otherOrg.id;

    const { data: otherAccount, error } = await testServiceRoleClient
      .from('ultaura_accounts')
      .insert({
        organization_id: otherOrganizationId,
        name: 'Other Account',
        billing_email: 'other@example.com',
        status: 'active',
        plan_id: 'care',
        minutes_included: 300,
        minutes_used: 0,
        cycle_start: new Date().toISOString(),
        cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (error || !otherAccount) {
      throw new Error(error?.message || 'Failed to create secondary account');
    }

    otherAccountId = otherAccount.id;

    const otherLine = await createTestLine(otherAccountId);
    otherLineId = otherLine.id;
  });

  afterAll(async () => {
    await cleanupTestData({ accountId, organizationId, userId });
    await cleanupTestData({ accountId: otherAccountId, organizationId: otherOrganizationId });
  });

  it('limits line access to the signed-in user organization', async () => {
    const authClient = createAnonClient();
    const { error } = await authClient.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(error.message);
    }

    const { data: lines } = await authClient
      .from('ultaura_lines')
      .select('id')
      .order('created_at', { ascending: false });

    const ids = (lines || []).map((line) => line.id);
    expect(ids).toContain(lineId);
    expect(ids).not.toContain(otherLineId);
  });
});
