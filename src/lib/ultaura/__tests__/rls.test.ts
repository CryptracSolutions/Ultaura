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
  let familyAccountId: string;
  let familyLineId: string;
  let lifeChapterId: string;
  let familyLifeChapterId: string;
  let wellnessAlertId: string;
  let otherAccountId: string;
  let otherOrganizationId: number;
  let otherLineId: string;

  beforeAll(async () => {
    const context = await createTestAccount({ userType: 'self' });
    accountId = context.account.id;
    organizationId = context.organization.id;
    userId = context.user.id;
    email = context.email;
    password = context.password;

    const line = await createTestLine(accountId);
    lineId = line.id;

    const { data: familyAccount, error: familyAccountError } = await testServiceRoleClient
      .from('ultaura_accounts')
      .insert({
        organization_id: organizationId,
        name: 'Family Managed Account',
        billing_email: `family-${Date.now()}@example.com`,
        status: 'active',
        plan_id: 'care',
        minutes_included: 300,
        minutes_used: 0,
        cycle_start: new Date().toISOString(),
        cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_by_user_id: userId,
        user_type: 'family_managed',
      })
      .select()
      .single();

    if (familyAccountError || !familyAccount) {
      throw new Error(familyAccountError?.message || 'Failed to create family account');
    }

    familyAccountId = familyAccount.id;
    const familyLine = await createTestLine(familyAccountId);
    familyLineId = familyLine.id;

    const { data: selfChapter, error: selfChapterError } = await testServiceRoleClient
      .from('ultaura_life_chapters')
      .insert({
        line_id: lineId,
        account_id: accountId,
        chapter_type: 'other',
        title: 'Test Chapter',
        narrative_ciphertext: Buffer.from('ciphertext'),
        narrative_iv: Buffer.from('iv'),
        narrative_tag: Buffer.from('tag'),
        narrative_alg: 'aes-256-gcm',
        narrative_kid: 'kek_v1',
        source: 'conversation',
      })
      .select('id')
      .single();

    if (selfChapterError || !selfChapter) {
      throw new Error(selfChapterError?.message || 'Failed to create self life chapter');
    }

    lifeChapterId = selfChapter.id;

    const { data: familyChapter, error: familyChapterError } = await testServiceRoleClient
      .from('ultaura_life_chapters')
      .insert({
        line_id: familyLineId,
        account_id: familyAccountId,
        chapter_type: 'other',
        title: 'Family Chapter',
        narrative_ciphertext: Buffer.from('ciphertext'),
        narrative_iv: Buffer.from('iv'),
        narrative_tag: Buffer.from('tag'),
        narrative_alg: 'aes-256-gcm',
        narrative_kid: 'kek_v1',
        source: 'conversation',
      })
      .select('id')
      .single();

    if (familyChapterError || !familyChapter) {
      throw new Error(familyChapterError?.message || 'Failed to create family life chapter');
    }

    familyLifeChapterId = familyChapter.id;

    const { data: wellnessAlert, error: wellnessAlertError } = await testServiceRoleClient
      .from('ultaura_wellness_alerts')
      .insert({
        line_id: lineId,
        account_id: accountId,
        alert_type: 'mood_drop',
        severity: 'info',
        title: 'Test alert',
        summary: 'Test summary',
        delivery_method: 'dashboard_only',
      })
      .select('id')
      .single();

    if (wellnessAlertError || !wellnessAlert) {
      throw new Error(wellnessAlertError?.message || 'Failed to create wellness alert');
    }

    wellnessAlertId = wellnessAlert.id;

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

  it('allows self users to read their own life chapters only', async () => {
    const authClient = createAnonClient();
    const { error } = await authClient.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(error.message);
    }

    const { data: chapters } = await authClient
      .from('ultaura_life_chapters')
      .select('id, account_id');

    const ids = (chapters || []).map((chapter) => chapter.id);
    expect(ids).toContain(lifeChapterId);
    expect(ids).not.toContain(familyLifeChapterId);
  });

  it('blocks family-managed life chapter writes by authenticated users', async () => {
    const authClient = createAnonClient();
    const { error } = await authClient.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(error.message);
    }

    const { error: insertError } = await authClient
      .from('ultaura_life_chapters')
      .insert({
        line_id: familyLineId,
        account_id: familyAccountId,
        chapter_type: 'other',
        title: 'Blocked',
        narrative_ciphertext: Buffer.from('ciphertext'),
        narrative_iv: Buffer.from('iv'),
        narrative_tag: Buffer.from('tag'),
        narrative_alg: 'aes-256-gcm',
        narrative_kid: 'kek_v1',
        source: 'conversation',
      });

    expect(insertError).toBeTruthy();
  });

  it('blocks user writes to wellness alerts', async () => {
    const authClient = createAnonClient();
    const { error } = await authClient.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(error.message);
    }

    const { error: insertError } = await authClient
      .from('ultaura_wellness_alerts')
      .insert({
        line_id: lineId,
        account_id: accountId,
        alert_type: 'mood_drop',
        severity: 'info',
        title: 'Blocked alert',
        summary: 'Blocked summary',
        delivery_method: 'dashboard_only',
      });

    expect(insertError).toBeTruthy();

    const { error: updateError } = await authClient
      .from('ultaura_wellness_alerts')
      .update({ acknowledged_at: new Date().toISOString() })
      .eq('id', wellnessAlertId);

    expect(updateError).toBeTruthy();

    const { error: deleteError } = await authClient
      .from('ultaura_wellness_alerts')
      .delete()
      .eq('id', wellnessAlertId);

    expect(deleteError).toBeTruthy();
  });
});
