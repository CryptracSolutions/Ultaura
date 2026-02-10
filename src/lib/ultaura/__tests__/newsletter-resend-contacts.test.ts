import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  updateMock: vi.fn(),
  createMock: vi.fn(),
  patchMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('~/lib/resend/client', () => ({
  getResendClient: vi.fn(() => ({
    contacts: {
      update: state.updateMock,
      create: state.createMock,
    },
    patch: state.patchMock,
  })),
}));

describe('newsletter resend contacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_SEGMENT_ID = 'seg_1';
    process.env.RESEND_TOPIC_BLOG_DIGEST_ID = 'topic_1';
    process.env.RESEND_TOPIC_ELDER_CARE_TIPS_ID = 'topic_2';
    process.env.RESEND_TOPIC_PRODUCT_UPDATES_ID = 'topic_3';
  });

  it('recreates contact when update returns not_found error', async () => {
    state.updateMock.mockResolvedValueOnce({ data: null, error: { name: 'not_found', message: 'missing' } });
    state.createMock.mockResolvedValueOnce({ data: { id: 'new_contact' }, error: null });
    state.patchMock.mockResolvedValue({ data: {}, error: null });

    const { confirmResendContact } = await import('~/lib/resend/contacts');
    const id = await confirmResendContact('old_contact', 'user@example.com', 'User', ['blog_digest']);

    expect(id).toBe('new_contact');
    expect(state.patchMock).toHaveBeenCalledTimes(1);
    expect(state.patchMock).toHaveBeenCalledWith('/contacts/new_contact/topics', {
      topics: [
        { id: 'topic_1', subscription: 'opt_in' },
        { id: 'topic_2', subscription: 'opt_out' },
        { id: 'topic_3', subscription: 'opt_out' },
      ],
    });
  });

  it('throws when update returns non-not_found error', async () => {
    state.updateMock.mockResolvedValueOnce({ data: null, error: { name: 'rate_limit', message: 'boom' } });

    const { unsubscribeResendContact } = await import('~/lib/resend/contacts');

    await expect(unsubscribeResendContact('contact_1')).rejects.toThrow('Resend contact unsubscribe failed');
  });
});
