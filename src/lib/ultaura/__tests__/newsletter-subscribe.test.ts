import { beforeEach, describe, expect, it, vi } from 'vitest';

const EXPECTED_TOPICS = ['blog_digest', 'elder_care_tips', 'product_updates'] as const;

type ExistingSubscriberRecord = {
  id: string;
  status: 'pending' | 'confirmed' | 'unsubscribed' | 'expired_pending';
  resend_contact_id: string | null;
};

type ConfirmSubscriberRecord = {
  id: string;
  email: string;
  first_name: string | null;
  pending_topics: string[] | null;
  resend_contact_id: string | null;
};

const mocks = vi.hoisted(() => {
  const state = {
    existingSubscriber: null as ExistingSubscriberRecord | null,
    confirmSubscriber: null as ConfirmSubscriberRecord | null,
    confirmError: null as { message: string } | null,
    alreadyConfirmedSubscriber: null as { id: string } | null,
    insertPayloads: [] as Array<Record<string, unknown>>,
    updatePayloads: [] as Array<Record<string, unknown>>,
    topicUpsertRows: [] as Array<Record<string, unknown>>,
    topicUpsertError: null as { message: string } | null,
    insertedId: 'subscriber-new',
    insertError: null as { message: string } | null,
    updateError: null as { message: string } | null,
  };

  const buildSubscriberUpdateChain = () => {
    const chain: any = {
      eq: vi.fn(() => chain),
      is: vi.fn(() => chain),
      gt: vi.fn(() => chain),
      select: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: state.confirmSubscriber,
          error: state.confirmError,
        })),
      })),
    };

    return chain;
  };

  const subscribersTable = {
    select: vi.fn(() => {
      const chain: any = {
        eq: vi.fn(() => chain),
        single: vi.fn(async () => ({ data: state.existingSubscriber, error: null })),
        maybeSingle: vi.fn(async () => ({
          data: state.alreadyConfirmedSubscriber,
          error: null,
        })),
      };

      return chain;
    }),
    update: vi.fn((payload: Record<string, unknown>) => {
      state.updatePayloads.push(payload);
      const chain = buildSubscriberUpdateChain();
      chain.error = state.updateError;
      return chain;
    }),
    insert: vi.fn((payload: Record<string, unknown>) => {
      state.insertPayloads.push(payload);
      return {
        select: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: { id: state.insertedId },
            error: state.insertError,
          })),
        })),
      };
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
    createPendingContact: vi.fn(async () => 'resend-contact-new'),
    ensureResendContact: vi.fn(async () => 'resend-contact-existing'),
    confirmResendContact: vi.fn(async () => 'resend-contact-existing'),
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

import { subscribeToNewsletter } from '../newsletter';

describe('subscribeToNewsletter', () => {
  const expectImmediateSuccess = (result: { success: boolean; message: string }) => {
    expect(result.success).toBe(true);
    expect(result.message.toLowerCase()).toContain('subscribed');
    expect(result.message.toLowerCase()).not.toContain('confirm');
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.existingSubscriber = null;
    mocks.state.confirmSubscriber = {
      id: 'subscriber-new',
      email: 'new@example.com',
      first_name: 'New User',
      pending_topics: [...EXPECTED_TOPICS],
      resend_contact_id: 'resend-contact-new',
    };
    mocks.state.confirmError = null;
    mocks.state.alreadyConfirmedSubscriber = null;
    mocks.state.insertPayloads.length = 0;
    mocks.state.updatePayloads.length = 0;
    mocks.state.topicUpsertRows.length = 0;
    mocks.state.topicUpsertError = null;
    mocks.state.insertedId = 'subscriber-new';
    mocks.state.insertError = null;
    mocks.state.updateError = null;
    mocks.createPendingContact.mockResolvedValue('resend-contact-new');
    mocks.ensureResendContact.mockResolvedValue('resend-contact-existing');
    mocks.sendEmail.mockResolvedValue(undefined);
  });

  it('subscribes new emails immediately even when client sends partial topics', async () => {
    const result = await subscribeToNewsletter({
      email: 'new@example.com',
      firstName: 'New User',
      topics: ['blog_digest'],
      source: 'website',
      sourceUrl: 'https://example.com/newsletter',
      ip: '203.0.113.10',
      userAgent: 'vitest-agent',
    });

    expectImmediateSuccess(result);
    expect(mocks.state.insertPayloads).toHaveLength(1);
    expect(mocks.state.topicUpsertRows.map((row) => row.topic_key)).toEqual(EXPECTED_TOPICS);
    expect(mocks.renderWelcomeEmail).toHaveBeenCalledTimes(1);
  });

  it('re-subscribes immediately when client omits topics', async () => {
    mocks.state.existingSubscriber = {
      id: 'subscriber-existing',
      status: 'expired_pending',
      resend_contact_id: 'resend-contact-existing',
    };
    mocks.state.confirmSubscriber = {
      id: 'subscriber-existing',
      email: 'existing@example.com',
      first_name: null,
      pending_topics: [...EXPECTED_TOPICS],
      resend_contact_id: 'resend-contact-existing',
    };
    mocks.ensureResendContact.mockResolvedValue('resend-contact-existing');

    const result = await subscribeToNewsletter({
      email: 'existing@example.com',
      source: 'website',
      sourceUrl: 'https://example.com/newsletter',
      ip: null,
      userAgent: null,
    });

    expectImmediateSuccess(result);
    expect(mocks.state.updatePayloads.length).toBeGreaterThan(0);
    expect(mocks.renderWelcomeEmail).toHaveBeenCalledTimes(1);
  });

  it('returns already-subscribed response for confirmed duplicates', async () => {
    mocks.state.existingSubscriber = {
      id: 'subscriber-confirmed',
      status: 'confirmed',
      resend_contact_id: 'resend-contact-confirmed',
    };

    const result = await subscribeToNewsletter({
      email: 'confirmed@example.com',
      source: 'website',
      ip: null,
      userAgent: null,
    });

    expect(result).toEqual({
      success: true,
      message: 'You are already subscribed.',
    });
    expect(mocks.state.insertPayloads).toHaveLength(0);
    const pendingUpdate = mocks.state.updatePayloads.find((payload) =>
      Object.prototype.hasOwnProperty.call(payload, 'pending_topics'),
    );
    expect(pendingUpdate).toBeUndefined();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.renderWelcomeEmail).not.toHaveBeenCalled();
  });
});
