import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

let mockSessionUserId = 'placeholder';

vi.mock('~/core/email/send-email', () => ({
  default: vi.fn().mockResolvedValue({}),
}));
vi.mock('server-only', () => ({}));
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return { ...actual, cache: (fn: (...args: any[]) => any) => fn };
});
vi.mock('~/lib/user/require-session', () => ({
  default: vi.fn(async () => ({ user: { id: mockSessionUserId } })),
}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Map([['x-forwarded-for', '127.0.0.1']])),
}));
vi.mock('~/lib/emails/notification-invite', () => ({
  default: vi.fn((props: { confirmLink: string }) => ({
    html: `<a href="${props.confirmLink}">Confirm</a>`,
    text: `Confirm: ${props.confirmLink}`,
  })),
}));

import sendEmail from '~/core/email/send-email';
import {
  inviteNotificationRecipient,
  confirmNotificationRecipient,
} from '../notification-recipients';
import { upgradeSelfToFamilyMode } from '../accounts';
import {
  cleanupTestData,
  createTestAccount,
  createTestLine,
  testServiceRoleClient,
} from './setup';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

describe('workflow fit actions', () => {
  let accountId: string;
  let organizationId: number;
  let userId: string;

  beforeAll(async () => {
    const context = await createTestAccount();
    accountId = context.account.id;
    organizationId = context.organization.id;
    userId = context.user.id;
    mockSessionUserId = userId;
    await createTestLine(accountId);
    process.env.EMAIL_SENDER_NOTIFICATIONS ||= 'Ultaura Notifications <notifications-test@ultaura.local>';
    process.env.EMAIL_REPLY_TO_SUPPORT ||= 'Ultaura Support <support-test@ultaura.local>';
  });

  afterAll(async () => {
    await cleanupTestData({ accountId, organizationId, userId });
  });

  it('stores a confirmation token hash that matches the invite link token', async () => {
    const result = await inviteNotificationRecipient(accountId, {
      name: 'Jane Doe',
      email: `jane-${Date.now()}@example.com`,
      addAsTrustedContact: false,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(result.error.message);
    }

    const { data: recipient } = await testServiceRoleClient
      .from('ultaura_notification_recipients')
      .select('*')
      .eq('id', result.data.id)
      .single();

    expect(recipient).toBeDefined();

    const sendEmailCalls = vi.mocked(sendEmail).mock.calls;
    const latestEmailCall = sendEmailCalls[sendEmailCalls.length - 1]?.[0];
    const confirmLink = latestEmailCall?.html?.match(
      /\/api\/ultaura\/confirm\/([a-f0-9]+)/i,
    )?.[1];
    expect(confirmLink).toBeDefined();

    const expectedHash = hashToken(confirmLink!);

    expect(recipient!.confirmation_token_hash).toBe(expectedHash);
    expect(recipient!.confirmation_token_expires_at).not.toBeNull();
    expect(vi.mocked(sendEmail)).toHaveBeenCalled();
  });

  it('confirms an invite and creates a trusted contact', async () => {
    const recipientId = randomUUID();
    const token = randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);

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
        confirmation_token_expires_at: new Date(
          Date.now() + 24 * 60 * 60 * 1000,
        ).toISOString(),
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
    const prevSessionUserId = mockSessionUserId;
    mockSessionUserId = context.user.id;

    try {
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
    } finally {
      mockSessionUserId = prevSessionUserId;
      await cleanupTestData({
        accountId: upgradeAccountId,
        organizationId: context.organization.id,
        userId: context.user.id,
      });
    }
  });
});
