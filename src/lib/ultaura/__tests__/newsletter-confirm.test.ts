import { beforeEach, describe, expect, it, vi } from 'vitest';

const EXPECTED_TOPICS = ['blog_digest', 'elder_care_tips', 'product_updates'] as const;

type ConfirmSubscriberRecord = {
  id: string;
  email: string;
  first_name: string | null;
  pending_topics: string[] | null;
  resend_contact_id: string | null;
};

const mocks = vi.hoisted(() => {
  const state = {
    confirmSubscriber: null as ConfirmSubscriberRecord | null,
    confirmError: null as { message: string } | null,
    topicUpsertError: null as { message: string } | null,
    topicUpsertRows: [] as Array<Record<string, unknown>>,
    subscriberUpdatePayloads: [] as Array<Record<string, unknown>>,
  };

  const buildSubscriberUpdateChain = () => {
    const chain: any = {
      eq: vi.fn(() => chain),
      is: vi.fn(() => chain),
      gt: vi.fn(() => chain),
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: state.confirmSubscriber, error: state.confirmError })),
      })),
    };

    return chain;
  };

  const subscribersTable = {
    update: vi.fn((payload: Record<string, unknown>) => {
      state.subscriberUpdatePayloads.push(payload);
      return buildSubscriberUpdateChain();
    }),
  };

  const topicSubscriptionsTable = {
    upsert: vi.fn(async (rows: Array<Record<string, unknown>>) => {
      state.topicUpsertRows = rows;
      return { error: state.topicUpsertError };
    }),
  };

  const adminClient = {
    from: vi.fn((table: string) => {
      if (table === 'ultaura_newsletter_subscribers') {
        return subscribersTable;
      }

      if (table === 'ultaura_newsletter_topic_subscriptions') {
        return topicSubscriptionsTable;
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return {
    state,
    getSupabaseClient: vi.fn(() => adminClient),
    createPendingContact: vi.fn(async () => 'resend-contact'),
    ensureResendContact: vi.fn(async () => 'resend-contact'),
    confirmResendContact: vi.fn(async (resendContactId: string) => resendContactId),
    sendEmail: vi.fn(async () => undefined),
    renderWelcomeEmail: vi.fn(() => ({ html: '<p>Welcome</p>', text: 'Welcome' })),
  };
});

vi.mock('~/core/supabase/action-client', () => ({
  default: mocks.getSupabaseClient,
}));

vi.mock('~/lib/resend/contacts', () => ({
  createPendingContact: mocks.createPendingContact,
  ensureResendContact: mocks.ensureResendContact,
  confirmResendContact: mocks.confirmResendContact,
}));

vi.mock('~/lib/resend/topics', () => ({
  TOPIC_KEYS: ['blog_digest', 'elder_care_tips', 'product_updates'],
}));

vi.mock('server-only', () => ({}));

vi.mock('~/core/email/send-email', () => ({
  default: mocks.sendEmail,
}));

vi.mock('~/lib/emails/newsletter-welcome', () => ({
  default: mocks.renderWelcomeEmail,
}));

import { confirmSubscription } from '../newsletter';

describe('confirmSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.confirmSubscriber = {
      id: 'subscriber-confirm',
      email: 'confirm@example.com',
      first_name: 'Confirm User',
      pending_topics: [...EXPECTED_TOPICS],
      resend_contact_id: 'resend-contact-confirm',
    };
    mocks.state.confirmError = null;
    mocks.state.topicUpsertError = null;
    mocks.state.topicUpsertRows.length = 0;
    mocks.state.subscriberUpdatePayloads.length = 0;
    mocks.confirmResendContact.mockResolvedValue('resend-contact-confirm');
    mocks.sendEmail.mockResolvedValue(undefined);
  });

  it('confirms and upserts all defaulted topics', async () => {
    const result = await confirmSubscription('valid-token', '203.0.113.11', 'vitest-agent');

    expect(result).toEqual({ success: true, message: 'You are now subscribed!' });
    expect(mocks.state.topicUpsertRows).toHaveLength(EXPECTED_TOPICS.length);
    expect(mocks.state.topicUpsertRows.map((row) => row.topic_key)).toEqual(EXPECTED_TOPICS);
    expect(mocks.state.topicUpsertRows.every((row) => row.subscriber_id === 'subscriber-confirm')).toBe(true);
    const clearPendingPayload = mocks.state.subscriberUpdatePayloads.find(
      (payload) => payload.pending_topics === null,
    );
    expect(clearPendingPayload).toBeDefined();
    expect(mocks.renderWelcomeEmail).toHaveBeenCalledWith(expect.objectContaining({
      firstName: 'Confirm User',
    }));
  });

  it('ignores legacy pending_topics and confirms all topics', async () => {
    mocks.state.confirmSubscriber = {
      id: 'subscriber-confirm',
      email: 'confirm@example.com',
      first_name: 'Confirm User',
      pending_topics: ['blog_digest'],
      resend_contact_id: 'resend-contact-confirm',
    };

    const result = await confirmSubscription('valid-token', '203.0.113.11', 'vitest-agent');

    expect(result).toEqual({ success: true, message: 'You are now subscribed!' });
    expect(mocks.state.topicUpsertRows.map((row) => row.topic_key)).toEqual(EXPECTED_TOPICS);
    expect(mocks.confirmResendContact).toHaveBeenCalledWith(
      'resend-contact-confirm',
      'confirm@example.com',
      'Confirm User',
      EXPECTED_TOPICS,
    );
    expect(mocks.renderWelcomeEmail).toHaveBeenCalledWith(expect.objectContaining({
      subscribedTopics: EXPECTED_TOPICS,
    }));
  });

  it('rolls back confirmation when topic upsert fails', async () => {
    mocks.state.topicUpsertError = { message: 'upsert failed' };

    const result = await confirmSubscription('valid-token', null, null);

    expect(result).toEqual({
      success: false,
      message: 'Something went wrong while saving your preferences. Please click the confirmation link again.',
    });
    const rollbackPayload = mocks.state.subscriberUpdatePayloads.find((payload) =>
      payload.status === 'pending' &&
      payload.confirmed_at === null &&
      payload.confirmation_token_consumed_at === null,
    );
    expect(rollbackPayload).toBeDefined();
    const clearPendingPayload = mocks.state.subscriberUpdatePayloads.find(
      (payload) => payload.pending_topics === null,
    );
    expect(clearPendingPayload).toBeUndefined();
    expect(mocks.confirmResendContact).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});
