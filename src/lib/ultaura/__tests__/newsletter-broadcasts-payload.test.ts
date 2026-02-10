import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  postMock: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('~/lib/resend/client', () => ({
  getResendClient: vi.fn(() => ({
    post: mocks.postMock,
  })),
}));

describe('newsletter broadcast payload contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_SEGMENT_ID = 'audience_123';
    process.env.RESEND_TOPIC_BLOG_DIGEST_ID = 'topic_blog_123';
    process.env.RESEND_TOPIC_ELDER_CARE_TIPS_ID = 'topic_elder_123';
    process.env.RESEND_TOPIC_PRODUCT_UPDATES_ID = 'topic_product_123';
    process.env.RESEND_FROM_EMAIL = 'Ultaura <newsletter-test@ultaura.com>';
    mocks.postMock.mockResolvedValue({ data: { id: 'bcast_123' }, error: null });
  });

  it('uses snake_case keys when creating a broadcast via low-level post', async () => {
    const { createBroadcast } = await import('~/lib/resend/broadcasts');

    await createBroadcast({
      subject: 'Weekly Update',
      previewText: 'This week at Ultaura',
      html: '<p>Hi there</p>',
      topicKey: 'blog_digest',
    });

    expect(mocks.postMock).toHaveBeenCalledTimes(1);
    expect(mocks.postMock).toHaveBeenCalledWith('/broadcasts', {
      audience_id: 'audience_123',
      from: 'Ultaura <newsletter-test@ultaura.com>',
      subject: 'Weekly Update',
      preview_text: 'This week at Ultaura',
      html: '<p>Hi there</p>',
      topic_id: 'topic_blog_123',
      tags: [
        {
          name: 'topic_key',
          value: 'blog_digest',
        },
      ],
    });

    const payload = mocks.postMock.mock.calls[0]?.[1];
    expect(payload).not.toHaveProperty('audienceId');
    expect(payload).not.toHaveProperty('previewText');
    expect(payload).not.toHaveProperty('topicId');
  });

  it('omits preview_text when previewText is not provided', async () => {
    const { createBroadcast } = await import('~/lib/resend/broadcasts');

    await createBroadcast({
      subject: 'Weekly Update',
      html: '<p>Hi there</p>',
      topicKey: 'blog_digest',
    });

    expect(mocks.postMock).toHaveBeenCalledTimes(1);

    const payload = mocks.postMock.mock.calls[0]?.[1];
    expect(payload).not.toHaveProperty('preview_text');
    expect(payload).not.toHaveProperty('previewText');
  });
});
