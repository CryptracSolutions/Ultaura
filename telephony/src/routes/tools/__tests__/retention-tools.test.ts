import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Router } from 'express';

vi.mock('../../../server.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));
vi.mock('../../../services/call-session.js', () => ({
  getCallSession: vi.fn(),
  incrementToolInvocations: vi.fn(),
  recordCallEvent: vi.fn(),
}));
vi.mock('../../../utils/supabase.js', () => ({
  getSupabaseClient: vi.fn(),
}));

import { storeCallPreviewRouter } from '../store-call-preview.js';
import { markPreviewOutcomeRouter } from '../mark-preview-outcome.js';
import { logSegmentEngagementRouter } from '../log-segment-engagement.js';
import { manageStoryArcRouter } from '../manage-story-arc.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../../services/call-session.js';
import { getSupabaseClient } from '../../../utils/supabase.js';
import type { CallSessionRow } from '../../../utils/supabase.js';

type SupabaseState = {
  table: string | null;
  inserts: Array<{ table: string | null; payload: Record<string, unknown> }>;
  updates: Array<{ table: string | null; payload: Record<string, unknown> }>;
  singleResult: { data: any; error: any };
  maybeSingleResult: { data: any; error: any };
  updateError: any;
};

type SupabaseMock = {
  from: ReturnType<typeof vi.fn>;
  __state: SupabaseState;
};

const baseSession: CallSessionRow = {
  id: 'session-1',
  line_id: 'line-1',
  account_id: 'account-1',
  created_at: '2026-01-12T00:00:00.000Z',
  direction: 'outbound',
  status: 'created',
  started_at: null,
  connected_at: null,
  ended_at: null,
  seconds_connected: null,
  twilio_call_sid: null,
  twilio_from: null,
  twilio_to: null,
  recording_sid: null,
  end_reason: null,
  answered_by: null,
  language_detected: null,
  tool_invocations: 0,
  cost_estimate_cents_twilio: null,
  cost_estimate_cents_model: null,
  is_reminder_call: false,
  reminder_id: null,
  reminder_message: null,
  scheduler_idempotency_key: null,
  is_test_call: false,
  is_preview_mode: false,
};

const basePreviewBody = {
  callSessionId: 'session-1',
  lineId: 'line-1',
  topicType: 'segment',
  topicKey: 'trivia',
  topicDisplay: 'some trivia',
};

function getPostHandler(router: Router) {
  const layer = (router as any).stack.find((stackLayer: any) => (
    stackLayer.route?.path === '/' && stackLayer.route?.methods?.post
  ));
  if (!layer) {
    throw new Error('POST handler not found');
  }
  return layer.route.stack[0].handle;
}

function createMockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((payload: any) => {
    res.body = payload;
    return res;
  });
  return res;
}

function createSupabaseMock(): SupabaseMock {
  const state: SupabaseState = {
    table: null,
    inserts: [],
    updates: [],
    singleResult: { data: { id: 'row-1' }, error: null },
    maybeSingleResult: { data: null, error: null },
    updateError: null,
  };

  const builder: any = {
    error: null,
    update: vi.fn((payload: Record<string, unknown>) => {
      state.updates.push({ table: state.table, payload });
      builder.error = state.updateError;
      return builder;
    }),
    insert: vi.fn((payload: Record<string, unknown>) => {
      state.inserts.push({ table: state.table, payload });
      return builder;
    }),
    select: vi.fn(() => builder),
    single: vi.fn(async () => state.singleResult),
    maybeSingle: vi.fn(async () => state.maybeSingleResult),
    eq: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    in: vi.fn(() => builder),
  };

  const client: SupabaseMock = {
    from: vi.fn((table: string) => {
      state.table = table;
      return builder;
    }),
    __state: state,
  };

  return client;
}

const storeCallPreviewHandler = getPostHandler(storeCallPreviewRouter);
const markPreviewOutcomeHandler = getPostHandler(markPreviewOutcomeRouter);
const logSegmentEngagementHandler = getPostHandler(logSegmentEngagementRouter);
const manageStoryArcHandler = getPostHandler(manageStoryArcRouter);

let supabaseMock: SupabaseMock;

beforeEach(() => {
  vi.clearAllMocks();
  supabaseMock = createSupabaseMock();
  vi.mocked(getSupabaseClient).mockReturnValue(supabaseMock as any);
  vi.mocked(incrementToolInvocations).mockResolvedValue(undefined);
  vi.mocked(recordCallEvent).mockResolvedValue(undefined);
});

describe('store-call-preview tool', () => {
  it('returns 400 when required fields are missing', async () => {
    const res = createMockRes();

    await storeCallPreviewHandler({ body: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ success: false, error: 'Missing required fields' });
  });

  it('blocks reminder calls', async () => {
    vi.mocked(getCallSession).mockResolvedValue({
      ...baseSession,
      is_reminder_call: true,
    });
    const res = createMockRes();

    await storeCallPreviewHandler({ body: basePreviewBody } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toBe('Call previews are disabled for this call type');
  });

  it('stores preview and expires pending previews', async () => {
    vi.mocked(getCallSession).mockResolvedValue(baseSession);
    supabaseMock.__state.singleResult = { data: { id: 'preview-1' }, error: null };

    const res = createMockRes();

    await storeCallPreviewHandler({ body: basePreviewBody } as any, res);

    expect(res.body).toEqual({ success: true, previewId: 'preview-1' });
    expect(supabaseMock.__state.updates[0]).toEqual({
      table: 'ultaura_call_previews',
      payload: { status: 'expired' },
    });
    expect(supabaseMock.__state.inserts[0].table).toBe('ultaura_call_previews');
    expect(supabaseMock.__state.inserts[0].payload).toEqual(expect.objectContaining({
      line_id: 'line-1',
      account_id: 'account-1',
      topic_type: 'segment',
      topic_key: 'trivia',
      topic_display: 'some trivia',
      status: 'pending',
    }));
    expect(incrementToolInvocations).toHaveBeenCalledWith('session-1');
    expect(recordCallEvent).toHaveBeenCalled();
  });
});

describe('mark-preview-outcome tool', () => {
  it('blocks test calls', async () => {
    vi.mocked(getCallSession).mockResolvedValue({
      ...baseSession,
      is_test_call: true,
    });

    const res = createMockRes();
    await markPreviewOutcomeHandler({
      body: { callSessionId: 'session-1', lineId: 'line-1', outcome: 'engaged' },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toBe('Previews are disabled for this call type');
  });

  it('returns 404 when no preview is found', async () => {
    vi.mocked(getCallSession).mockResolvedValue(baseSession);
    supabaseMock.__state.maybeSingleResult = { data: null, error: null };

    const res = createMockRes();
    await markPreviewOutcomeHandler({
      body: { callSessionId: 'session-1', lineId: 'line-1', outcome: 'engaged' },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body.error).toBe('Call preview not found');
  });

  it('updates the preview when previewId is provided', async () => {
    vi.mocked(getCallSession).mockResolvedValue(baseSession);

    const res = createMockRes();
    await markPreviewOutcomeHandler({
      body: {
        callSessionId: 'session-1',
        lineId: 'line-1',
        outcome: 'declined',
        previewId: 'preview-99',
      },
    } as any, res);

    expect(res.body).toEqual({ success: true, previewId: 'preview-99' });
    const updatePayload = supabaseMock.__state.updates[0].payload;
    expect(updatePayload).toEqual(expect.objectContaining({
      status: 'declined',
      followed_through: false,
      follow_through_response: 'declined',
    }));
    expect(typeof updatePayload.used_at).toBe('string');
    expect(incrementToolInvocations).toHaveBeenCalledWith('session-1');
    expect(recordCallEvent).toHaveBeenCalled();
  });
});

describe('log-segment-engagement tool', () => {
  it('blocks reminder calls', async () => {
    vi.mocked(getCallSession).mockResolvedValue({
      ...baseSession,
      is_reminder_call: true,
    });

    const res = createMockRes();
    await logSegmentEngagementHandler({
      body: {
        callSessionId: 'session-1',
        lineId: 'line-1',
        segmentType: 'story',
        seniorResponse: 'enjoyed',
      },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toBe('Segments are disabled for this call type');
  });

  it('stores engagement with story arc context', async () => {
    vi.mocked(getCallSession).mockResolvedValue(baseSession);
    supabaseMock.__state.singleResult = { data: { id: 'eng-1' }, error: null };

    const res = createMockRes();
    await logSegmentEngagementHandler({
      body: {
        callSessionId: 'session-1',
        lineId: 'line-1',
        segmentType: 'story',
        segmentDomain: 'adventure',
        segmentContext: { beat: 'intro' },
        engagementSignals: { laughed: true },
        durationSeconds: 120,
        completed: true,
        seniorResponse: 'enjoyed',
        storyArcId: 'arc-1',
        chapterCompleted: 2,
      },
    } as any, res);

    expect(res.body).toEqual({ success: true, engagementId: 'eng-1' });
    expect(supabaseMock.__state.inserts[0].table).toBe('ultaura_segment_engagement');
    expect(supabaseMock.__state.inserts[0].payload).toEqual(expect.objectContaining({
      line_id: 'line-1',
      account_id: 'account-1',
      call_session_id: 'session-1',
      segment_type: 'story',
      segment_domain: 'adventure',
      completed: true,
      senior_response: 'enjoyed',
    }));
    expect(supabaseMock.__state.inserts[0].payload.segment_context).toEqual(expect.objectContaining({
      beat: 'intro',
      story_arc_id: 'arc-1',
      chapter_completed: 2,
    }));
    expect(supabaseMock.__state.updates[0].table).toBe('ultaura_story_arcs');
    expect(supabaseMock.__state.updates[0].payload).toEqual(expect.objectContaining({
      current_chapter: 2,
    }));
    expect(incrementToolInvocations).toHaveBeenCalledWith('session-1');
    expect(recordCallEvent).toHaveBeenCalled();
  });
});

describe('manage-story-arc tool', () => {
  it('requires storyType and title for create', async () => {
    vi.mocked(getCallSession).mockResolvedValue(baseSession);

    const res = createMockRes();
    await manageStoryArcHandler({
      body: {
        callSessionId: 'session-1',
        lineId: 'line-1',
        action: 'create',
        storyType: 'serial',
      },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toBe('Missing storyType or title');
  });

  it('creates a story arc with defaults', async () => {
    vi.mocked(getCallSession).mockResolvedValue(baseSession);
    supabaseMock.__state.singleResult = { data: { id: 'arc-1' }, error: null };

    const res = createMockRes();
    await manageStoryArcHandler({
      body: {
        callSessionId: 'session-1',
        lineId: 'line-1',
        action: 'create',
        storyType: 'serial',
        title: 'The Lighthouse Keeper',
      },
    } as any, res);

    expect(res.body).toEqual({ success: true, storyArcId: 'arc-1' });
    expect(supabaseMock.__state.inserts[0].table).toBe('ultaura_story_arcs');
    expect(supabaseMock.__state.inserts[0].payload).toEqual(expect.objectContaining({
      account_id: 'account-1',
      line_id: 'line-1',
      story_type: 'serial',
      title: 'The Lighthouse Keeper',
      total_chapters: 5,
      story_state: {},
    }));
    expect(incrementToolInvocations).toHaveBeenCalledWith('session-1');
    expect(recordCallEvent).toHaveBeenCalled();
  });

  it('marks a story arc as completed', async () => {
    vi.mocked(getCallSession).mockResolvedValue(baseSession);
    supabaseMock.__state.singleResult = { data: { id: 'arc-2' }, error: null };

    const res = createMockRes();
    await manageStoryArcHandler({
      body: {
        callSessionId: 'session-1',
        lineId: 'line-1',
        action: 'complete',
        storyArcId: 'arc-2',
      },
    } as any, res);

    expect(res.body).toEqual({ success: true, storyArcId: 'arc-2' });
    expect(supabaseMock.__state.updates[0].table).toBe('ultaura_story_arcs');
    expect(supabaseMock.__state.updates[0].payload).toEqual(expect.objectContaining({
      status: 'completed',
    }));
  });
});
