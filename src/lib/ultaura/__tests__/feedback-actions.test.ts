import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  const upload = vi.fn(async () => ({
    data: { path: 'uploads/attachment.png' },
    error: null,
  }));

  const remove = vi.fn(async () => ({ error: null }));
  const insert = vi.fn(async () => ({ error: null }));
  const deleteEq = vi.fn(async () => ({ error: null }));
  const deleteChain = {
    eq: deleteEq,
  };
  const deleteFn = vi.fn(() => deleteChain);

  const adminClient = {
    from: vi.fn((table: string) => {
      if (table === 'feedback_submissions') {
        return {
          insert,
          delete: deleteFn,
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
    storage: {
      from: vi.fn(() => ({
        upload,
        remove,
      })),
    },
  };

  const userClient = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: 'user-123' } },
      })),
    },
  };

  const getSupabaseServerActionClient = vi.fn((options?: { admin?: boolean }) =>
    options?.admin ? adminClient : userClient,
  );

  const getFeedbackSubmission = vi.fn(async () => ({
    data: {
      attachmentUrl: 'uploads/attachment.png',
    },
  }));

  const revalidatePath = vi.fn();
  const embeddingState = {
    shouldThrow: false,
  };

  return {
    logger,
    upload,
    remove,
    insert,
    deleteEq,
    deleteFn,
    adminClient,
    userClient,
    getSupabaseServerActionClient,
    getFeedbackSubmission,
    revalidatePath,
    embeddingState,
  };
});

vi.mock('~/core/logger', () => ({
  default: vi.fn(() => mocks.logger),
}));

vi.mock('~/core/supabase/action-client', () => ({
  default: mocks.getSupabaseServerActionClient,
}));

vi.mock('~/plugins/feedback-popup/lib/queries', () => ({
  getFeedbackSubmission: mocks.getFeedbackSubmission,
}));

vi.mock('~/core/generic/actions-utils', () => ({
  withAdminSession: (handler: (formData: FormData) => Promise<unknown>) => handler,
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn(async () => {
    if (mocks.embeddingState.shouldThrow) {
      throw new Error('onnxruntime unavailable');
    }

    return async () => ({ data: Float32Array.from(new Array(384).fill(0.1)) });
  }),
}));

function makeFormData(values: Record<string, string>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }

  return formData;
}

describe('feedback actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.embeddingState.shouldThrow = false;
    mocks.upload.mockResolvedValue({
      data: { path: 'uploads/attachment.png' },
      error: null,
    });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.deleteEq.mockResolvedValue({ error: null });
    mocks.getFeedbackSubmission.mockResolvedValue({
      data: { attachmentUrl: 'uploads/attachment.png' },
    });
  });

  it('submits a question without attachment', async () => {
    const { submitFeedbackAction } = await import(
      '../../../../plugins/feedback-popup/lib/feedback-actions'
    );

    const result = await submitFeedbackAction(
      { success: undefined },
      makeFormData({
        type: 'question',
        text: 'How do I update my schedule?',
        email: 'caregiver@example.com',
      }),
    );

    expect(result).toEqual({ success: true });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'question',
        email: 'caregiver@example.com',
        attachment_url: '',
      }),
    );
  });

  it('uploads a nested attachment payload', async () => {
    const { submitFeedbackAction } = await import(
      '../../../../plugins/feedback-popup/lib/feedback-actions'
    );

    const result = await submitFeedbackAction(
      { success: undefined },
      makeFormData({
        type: 'feedback',
        text: 'Sharing a screenshot',
        'attachment[name]': 'screen.png',
        'attachment[type]': 'image/png',
        'attachment[image]': 'data:image/png;base64,ZmFrZQ==',
      }),
    );

    expect(result).toEqual({ success: true });
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.stringContaining('screen.png'),
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'image/png' }),
    );
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        attachment_url: 'uploads/attachment.png',
      }),
    );
  });

  it('ignores malformed scalar attachment values', async () => {
    const { submitFeedbackAction } = await import(
      '../../../../plugins/feedback-popup/lib/feedback-actions'
    );

    const result = await submitFeedbackAction(
      { success: undefined },
      makeFormData({
        type: 'question',
        text: 'Need help',
        email: 'caregiver@example.com',
        attachment: 'broken-string-value',
      }),
    );

    expect(result).toEqual({ success: true });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        attachment_url: '',
      }),
    );
  });

  it('falls back to null embedding when embedding generation fails', async () => {
    mocks.embeddingState.shouldThrow = true;

    const { submitFeedbackAction } = await import(
      '../../../../plugins/feedback-popup/lib/feedback-actions'
    );

    const result = await submitFeedbackAction(
      { success: undefined },
      makeFormData({
        type: 'feedback',
        text: 'Embedding can fail without blocking submission',
      }),
    );

    expect(result).toEqual({ success: true });
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        embedding: null,
      }),
    );
    expect(mocks.logger.warn).toHaveBeenCalled();
  });
});
