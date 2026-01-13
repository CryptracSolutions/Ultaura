import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

vi.mock('~/core/email/send-email', () => ({
  default: vi.fn().mockResolvedValue({}),
}));

import sendEmail from '~/core/email/send-email';
import { inviteNotificationRecipient, confirmNotificationRecipient } from '../notification-recipients';
import { buildNotificationRecipientToken, hashNotificationToken } from '../notification-tokens';
import { upgradeSelfToFamilyMode } from '../accounts';
import {
  cleanupTestData,
  createTestAccount,
  createTestLine,
  testServiceRoleClient,
} from './setup';

describe('workflow fit actions', () => {
  let accountId: string;
  let organizationId: number;
  let userId: string;

  beforeAll(async () => {
    const context = await createTestAccount();
    accountId = context.account.id;
    organizationId = context.organization.id;
    userId = context.user.id;
    await createTestLine(accountId);
    process.env.EMAIL_SENDER ||= 'test@ultaura.local';
  });

  afterAll(async () => {
    await cleanupTestData({ accountId, organizationId, userId });
  });

  it('generates a deterministic token hash on invite', async () => {
    const result = await inviteNotificationRecipient(accountId, {
      name: 'Jane Doe',
      email: `jane-${Date.now()}@example.com`,
      addAsTrustedContact: false,
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    const { data: recipient } = await testServiceRoleClient
      .from('ultaura_notification_recipients')
      .select('*')
      .eq('id', result.data!.id)
      .single();

    expect(recipient).toBeDefined();

    const token = buildNotificationRecipientToken(recipient!.id);
    const expectedHash = hashNotificationToken(token);

    expect(recipient!.confirmation_token_hash).toBe(expectedHash);
    expect(recipient!.confirmation_token_expires_at).not.toBeNull();
    expect(vi.mocked(sendEmail)).toHaveBeenCalled();
  });

  it('confirms an invite and creates a trusted contact', async () => {
    const recipientId = randomUUID();
    const token = buildNotificationRecipientToken(recipientId);
    const tokenHash = hashNotificationToken(token);

    const { data: inserted } = await testServiceRoleClient
      .from('ultaura_notification_recipients')
      .insert({
        id: recipientId,
        account_id: accountId,
        name: 'Mary Trusted',
        email: `trusted-${Date.now()}@example.com`,
        phone_e164: '+14155550123',
        relationship: 'Daughter',
        is_trusted_contact: true,
        confirmation_token_hash: tokenHash,
        confirmation_token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('*')
      .single();

    expect(inserted).toBeDefined();

    const result = await confirmNotificationRecipient(token);
    expect(result.success).toBe(true);

    const { data: confirmed } = await testServiceRoleClient
      .from('ultaura_notification_recipients')
      .select('confirmed_at, trusted_contact_id')
      .eq('id', recipientId)
      .single();

    expect(confirmed?.confirmed_at).not.toBeNull();
    expect(confirmed?.trusted_contact_id).not.toBeNull();

    const { data: trustedContact } = await testServiceRoleClient
      .from('ultaura_trusted_contacts')
      .select('id')
      .eq('account_id', accountId)
      .eq('name', 'Mary Trusted')
      .maybeSingle();

    expect(trustedContact?.id).toBe(confirmed?.trusted_contact_id);
  });

  it('upgrades self accounts to family mode', async () => {
    const context = await createTestAccount();
    const upgradeAccountId = context.account.id;

    await testServiceRoleClient
      .from('ultaura_accounts')
      .update({
        user_type: 'self',
        sharing_enabled: false,
        sharing_enabled_at: null,
      })
      .eq('id', upgradeAccountId);

    const result = await upgradeSelfToFamilyMode(upgradeAccountId);
    expect(result.success).toBe(true);

    const { data: updated } = await testServiceRoleClient
      .from('ultaura_accounts')
      .select('user_type, sharing_enabled, sharing_enabled_at')
      .eq('id', upgradeAccountId)
      .single();

    expect(updated?.user_type).toBe('family_managed');
    expect(updated?.sharing_enabled).toBe(true);
    expect(updated?.sharing_enabled_at).not.toBeNull();

    await cleanupTestData({
      accountId: upgradeAccountId,
      organizationId: context.organization.id,
      userId: context.user.id,
    });
  });
});
