import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
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

vi.mock('../../../utils/life-chapter-crypto.js', () => ({
  encryptLifeChapterNarrative: vi.fn(() => ({
    ciphertext: Buffer.alloc(16),
    iv: Buffer.alloc(12),
    tag: Buffer.alloc(16),
    alg: 'aes-256-gcm',
    kid: 'test-kid',
  })),
}));

vi.mock('../../../utils/health-mention-crypto.js', () => ({
  encryptHealthMentionSummary: vi.fn(() => ({
    ciphertext: Buffer.alloc(16),
    iv: Buffer.alloc(12),
    tag: Buffer.alloc(16),
    alg: 'aes-256-gcm',
    kid: 'test-kid',
  })),
}));

vi.mock('../../../utils/derived-artifact-minimizer.js', () => ({
  minimizeDerivedText: vi.fn((text: string) => text),
  minimizeDerivedOptionalText: vi.fn((text: string | undefined) => text),
  minimizeDerivedObjectDeep: vi.fn((obj: any) => obj),
}));

vi.mock('../../../services/cognitive-flags.js', () => ({
  updateCognitiveFlagsFromObservation: vi.fn(),
}));

import { storeLifeChapterRouter } from '../store-life-chapter.js';
import { storeMilestoneRouter } from '../store-milestone.js';
import { markMilestoneCelebratedRouter } from '../mark-milestone-celebrated.js';
import { updateRelationshipRouter } from '../update-relationship.js';
import { markRelationshipDeceasedRouter } from '../mark-relationship-deceased.js';
import { logCognitiveObservationRouter } from '../log-cognitive-observation.js';
import { adjustAccessibilityRouter } from '../adjust-accessibility.js';
import { logHealthMentionRouter } from '../log-health-mention.js';
import { updateContentPreferenceRouter } from '../update-content-preference.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../../services/call-session.js';
import { getSupabaseClient } from '../../../utils/supabase.js';
import { updateCognitiveFlagsFromObservation } from '../../../services/cognitive-flags.js';
import {
  createMockRes,
  getPostHandler,
  BASE_ACCOUNT_ID,
  baseSession,
} from './helpers/index.js';

// All personalization schemas require UUID-formatted IDs
const UUID_SESSION = 'dddddddd-2222-0000-0000-000000000001';
const UUID_LINE = 'eeeeeeee-2222-0000-0000-000000000001';
const UUID_OTHER_LINE = 'ffffffff-2222-0000-0000-000000000099';

const lifeChapterHandler = getPostHandler(storeLifeChapterRouter);
const milestoneHandler = getPostHandler(storeMilestoneRouter);
const celebrateHandler = getPostHandler(markMilestoneCelebratedRouter);
const relationshipHandler = getPostHandler(updateRelationshipRouter);
const deceasedHandler = getPostHandler(markRelationshipDeceasedRouter);
const cognitiveHandler = getPostHandler(logCognitiveObservationRouter);
const accessibilityHandler = getPostHandler(adjustAccessibilityRouter);
const healthMentionHandler = getPostHandler(logHealthMentionRouter);
const contentPrefHandler = getPostHandler(updateContentPreferenceRouter);

function makeSupabase(overrides: { insertData?: any; insertError?: any; selectData?: any; selectError?: any; updateError?: any; upsertError?: any; count?: number } = {}) {
  const builder: any = {};
  builder.select = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.upsert = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.ilike = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.gte = vi.fn(() => builder);
  builder.single = vi.fn(async () => ({ data: overrides.insertData ?? { id: 'new-id' }, error: overrides.insertError ?? null }));
  builder.maybeSingle = vi.fn(async () => ({ data: overrides.selectData ?? null, error: overrides.selectError ?? null }));
  builder.then = (resolve: (v: any) => any) => Promise.resolve({ data: overrides.insertData ?? null, error: overrides.insertError ?? null, count: overrides.count ?? null }).then(resolve);
  return { from: vi.fn(() => builder) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCallSession).mockResolvedValue({
    ...baseSession,
    id: UUID_SESSION,
    line_id: UUID_LINE,
    account_id: BASE_ACCOUNT_ID,
  });
  vi.mocked(incrementToolInvocations).mockResolvedValue(undefined);
  vi.mocked(recordCallEvent).mockResolvedValue(undefined);
  vi.mocked(updateCognitiveFlagsFromObservation).mockResolvedValue(undefined);
  vi.mocked(getSupabaseClient).mockReturnValue(makeSupabase() as any);
});

// ---------------------------------------------------------------------------
// store_life_chapter
// ---------------------------------------------------------------------------

describe('store_life_chapter', () => {
  it('happy path - inserts encrypted data and returns chapterId', async () => {
    vi.mocked(getSupabaseClient).mockReturnValue(makeSupabase({ insertError: null }) as any);

    const res = createMockRes();
    await lifeChapterHandler(
      {
        body: {
          callSessionId: UUID_SESSION,
          lineId: UUID_LINE,
          chapter_type: 'childhood',
          title: 'Growing up in Ohio',
          narrative_summary: 'Spent summers at the lake with grandparents.',
        },
      } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(typeof res.body.chapterId).toBe('string');
  });

  it('Zod validation failure returns 400', async () => {
    const res = createMockRes();
    await lifeChapterHandler(
      {
        body: {
          callSessionId: UUID_SESSION,
          lineId: UUID_LINE,
          // missing required fields: chapter_type, title, narrative_summary
        },
      } as any,
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('line mismatch returns 403', async () => {
    const res = createMockRes();
    await lifeChapterHandler(
      {
        body: {
          callSessionId: UUID_SESSION,
          lineId: UUID_OTHER_LINE,
          chapter_type: 'career',
          title: 'My career',
          narrative_summary: 'Worked as an engineer for 30 years.',
        },
      } as any,
      res,
    );

    expect(res.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// store_milestone
// ---------------------------------------------------------------------------

describe('store_milestone', () => {
  it('happy path - inserts and returns milestoneId', async () => {
    vi.mocked(getSupabaseClient).mockReturnValue(makeSupabase({ insertData: { id: 'milestone-1' } }) as any);

    const res = createMockRes();
    await milestoneHandler(
      {
        body: {
          callSessionId: UUID_SESSION,
          lineId: UUID_LINE,
          milestone_type: 'birthday',
          title: "Mom's Birthday",
          date_month: 3,
          date_day: 15,
        },
      } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.milestoneId).toBe('milestone-1');
  });

  it('Zod validation failure returns 400', async () => {
    const res = createMockRes();
    await milestoneHandler(
      {
        body: {
          callSessionId: UUID_SESSION,
          lineId: UUID_LINE,
          // missing required: milestone_type, title, date_month, date_day
        },
      } as any,
      res,
    );

    expect(res.statusCode).toBe(400);
  });

  it('line mismatch returns 403', async () => {
    const res = createMockRes();
    await milestoneHandler(
      {
        body: {
          callSessionId: UUID_SESSION,
          lineId: UUID_OTHER_LINE,
          milestone_type: 'anniversary',
          title: 'Wedding Anniversary',
          date_month: 6,
          date_day: 20,
        },
      } as any,
      res,
    );

    expect(res.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// mark_milestone_celebrated
// ---------------------------------------------------------------------------

describe('mark_milestone_celebrated', () => {
  it('happy path by ID - updates celebration count', async () => {
    const milestoneId = 'milestone-abc';
    const builder: any = {};
    builder.select = vi.fn(() => builder);
    builder.update = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.ilike = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.limit = vi.fn(() => builder);
    // First maybeSingle for existing milestone
    builder.maybeSingle = vi.fn(async () => ({ data: { times_celebrated: 2 }, error: null }));
    // Then update resolves with no error
    builder.then = (resolve: (v: any) => any) => Promise.resolve({ data: null, error: null }).then(resolve);
    vi.mocked(getSupabaseClient).mockReturnValue({ from: vi.fn(() => builder) } as any);

    const res = createMockRes();
    await celebrateHandler(
      {
        body: {
          callSessionId: UUID_SESSION,
          lineId: UUID_LINE,
          milestone_id: milestoneId,
        },
      } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.milestoneId).toBe(milestoneId);
  });

  it('happy path by title - ilike lookup then updates', async () => {
    const milestoneId = 'milestone-xyz';
    let callCount = 0;
    const builder: any = {};
    builder.select = vi.fn(() => builder);
    builder.update = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.ilike = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.limit = vi.fn(() => builder);
    builder.maybeSingle = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        // Title lookup
        return { data: { id: milestoneId }, error: null };
      }
      // Existing milestone for celebration count
      return { data: { times_celebrated: 0 }, error: null };
    });
    builder.then = (resolve: (v: any) => any) => Promise.resolve({ data: null, error: null }).then(resolve);
    vi.mocked(getSupabaseClient).mockReturnValue({ from: vi.fn(() => builder) } as any);

    const res = createMockRes();
    await celebrateHandler(
      {
        body: {
          callSessionId: UUID_SESSION,
          lineId: UUID_LINE,
          milestone_title: "Mom's Birthday",
        },
      } as any,
      res,
    );

    expect(res.body.success).toBe(true);
  });

  it('milestone not found returns 404', async () => {
    const builder: any = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.ilike = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.limit = vi.fn(() => builder);
    builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    vi.mocked(getSupabaseClient).mockReturnValue({ from: vi.fn(() => builder) } as any);

    const res = createMockRes();
    await celebrateHandler(
      {
        body: {
          callSessionId: UUID_SESSION,
          lineId: UUID_LINE,
          // neither milestone_id nor milestone_title — no milestone to find
        },
      } as any,
      res,
    );

    expect(res.statusCode).toBe(404);
  });

  it('line mismatch returns 403', async () => {
    const res = createMockRes();
    await celebrateHandler(
      {
        body: {
          callSessionId: UUID_SESSION,
          lineId: UUID_OTHER_LINE,
          milestone_id: 'some-id',
        },
      } as any,
      res,
    );

    expect(res.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// update_relationship
// ---------------------------------------------------------------------------

describe('update_relationship', () => {
  it('happy path - new relationship is created', async () => {
    const builder: any = {};
    builder.select = vi.fn(() => builder);
    builder.insert = vi.fn(() => builder);
    builder.update = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.limit = vi.fn(() => builder);
    let callCount = 0;
    builder.then = (resolve: (v: any) => any) => {
      callCount++;
      if (callCount === 1) {
        // candidates query returns empty
        return Promise.resolve({ data: [], error: null }).then(resolve);
      }
      // insert returns new id
      return Promise.resolve({ data: { id: 'rel-new' }, error: null }).then(resolve);
    };
    builder.single = vi.fn(async () => ({ data: { id: 'rel-new' }, error: null }));
    vi.mocked(getSupabaseClient).mockReturnValue({ from: vi.fn(() => builder) } as any);

    const res = createMockRes();
    await relationshipHandler(
      {
        body: {
          callSessionId: UUID_SESSION,
          lineId: UUID_LINE,
          name: 'John',
          updates: { sentiment: 'positive' },
        },
      } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.relationshipId).toBe('rel-new');
  });

  it('happy path - existing relationship is updated', async () => {
    const builder: any = {};
    builder.select = vi.fn(() => builder);
    builder.update = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.limit = vi.fn(() => builder);
    let callCount = 0;
    builder.then = (resolve: (v: any) => any) => {
      callCount++;
      if (callCount === 1) {
        // candidates query returns existing
        return Promise.resolve({
          data: [{ id: 'rel-existing', name: 'John', times_mentioned: 3, updated_at: '2026-01-01T00:00:00Z', recent_topics: [], shared_activities: [] }],
          error: null,
        }).then(resolve);
      }
      // update returns no error
      return Promise.resolve({ data: null, error: null }).then(resolve);
    };
    vi.mocked(getSupabaseClient).mockReturnValue({ from: vi.fn(() => builder) } as any);

    const res = createMockRes();
    await relationshipHandler(
      {
        body: {
          callSessionId: UUID_SESSION,
          lineId: UUID_LINE,
          name: 'John',
          updates: { recent_topic: 'gardening' },
        },
      } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.relationshipId).toBe('rel-existing');
  });

  it('line mismatch returns 403', async () => {
    const res = createMockRes();
    await relationshipHandler(
      {
        body: {
          callSessionId: UUID_SESSION,
          lineId: UUID_OTHER_LINE,
          name: 'Jane',
          updates: {},
        },
      } as any,
      res,
    );

    expect(res.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// mark_relationship_deceased
// ---------------------------------------------------------------------------

describe('mark_relationship_deceased', () => {
  it('happy path - new relationship created with is_deceased=true', async () => {
    const builder: any = {};
    builder.select = vi.fn(() => builder);
    builder.insert = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.ilike = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.limit = vi.fn(() => builder);
    builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    builder.single = vi.fn(async () => ({ data: { id: 'rel-deceased' }, error: null }));
    vi.mocked(getSupabaseClient).mockReturnValue({ from: vi.fn(() => builder) } as any);

    const res = createMockRes();
    await deceasedHandler(
      {
        body: {
          callSessionId: UUID_SESSION,
          lineId: UUID_LINE,
          name: 'Uncle Bob',
          grief_sensitivity: 'high',
        },
      } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.relationshipId).toBe('rel-deceased');
  });

  it('happy path - existing relationship updated with is_deceased=true', async () => {
    const existingRel = { id: 'rel-10', name: 'Aunt Mary', passed_at: null, grief_sensitivity: null };
    const builder: any = {};
    builder.select = vi.fn(() => builder);
    builder.update = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.ilike = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.limit = vi.fn(() => builder);
    builder.maybeSingle = vi.fn(async () => ({ data: existingRel, error: null }));
    builder.then = (resolve: (v: any) => any) => Promise.resolve({ data: null, error: null }).then(resolve);
    vi.mocked(getSupabaseClient).mockReturnValue({ from: vi.fn(() => builder) } as any);

    const res = createMockRes();
    await deceasedHandler(
      {
        body: {
          callSessionId: UUID_SESSION,
          lineId: UUID_LINE,
          name: 'Aunt Mary',
        },
      } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.relationshipId).toBe('rel-10');
  });

  it('line mismatch returns 403', async () => {
    const res = createMockRes();
    await deceasedHandler(
      {
        body: {
          callSessionId: UUID_SESSION,
          lineId: UUID_OTHER_LINE,
          name: 'Someone',
        },
      } as any,
      res,
    );

    expect(res.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// log_cognitive_observation
// ---------------------------------------------------------------------------

describe('log_cognitive_observation', () => {
  it('happy path - inserts and calls updateCognitiveFlagsFromObservation', async () => {
    const builder: any = {};
    builder.select = vi.fn(() => builder);
    builder.insert = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.gte = vi.fn(() => builder);
    let callCount = 0;
    builder.then = (resolve: (v: any) => any) => {
      callCount++;
      // insert resolves with no error
      return Promise.resolve({ data: null, error: null, count: 0 }).then(resolve);
    };
    vi.mocked(getSupabaseClient).mockReturnValue({ from: vi.fn(() => builder) } as any);

    const res = createMockRes();
    await cognitiveHandler(
      {
        body: {
          callSessionId: UUID_SESSION,
          lineId: UUID_LINE,
          observation_type: 'confusion',
          severity: 'mild',
        },
      } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(vi.mocked(updateCognitiveFlagsFromObservation)).toHaveBeenCalled();
  });

  it('Zod validation failure returns 400', async () => {
    const res = createMockRes();
    await cognitiveHandler(
      {
        body: {
          callSessionId: UUID_SESSION,
          lineId: UUID_LINE,
          // missing observation_type and severity
        },
      } as any,
      res,
    );

    expect(res.statusCode).toBe(400);
  });

  it('line mismatch returns 403', async () => {
    const res = createMockRes();
    await cognitiveHandler(
      {
        body: {
          callSessionId: UUID_SESSION,
          lineId: UUID_OTHER_LINE,
          observation_type: 'repetition',
          severity: 'moderate',
        },
      } as any,
      res,
    );

    expect(res.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// adjust_accessibility
// ---------------------------------------------------------------------------

describe('adjust_accessibility', () => {
  function makeAccessibilitySupabase(upsertError: any = null) {
    const builder: any = {};
    builder.upsert = vi.fn(async () => ({ data: null, error: upsertError }));
    return { from: vi.fn(() => builder) };
  }

  it('speech_rate valid - upserts setting', async () => {
    vi.mocked(getSupabaseClient).mockReturnValue(makeAccessibilitySupabase() as any);

    const res = createMockRes();
    await accessibilityHandler(
      {
        body: {
          callSessionId: UUID_SESSION,
          lineId: UUID_LINE,
          setting: 'speech_rate',
          value: '0.9',
        },
      } as any,
      res,
    );

    expect(res.body.success).toBe(true);
  });

  it('hearing_mode valid - upserts setting', async () => {
    vi.mocked(getSupabaseClient).mockReturnValue(makeAccessibilitySupabase() as any);

    const res = createMockRes();
    await accessibilityHandler(
      {
        body: {
          callSessionId: UUID_SESSION,
          lineId: UUID_LINE,
          setting: 'hearing_mode',
          value: 'enhanced_clarity',
          source: 'senior_request',
        },
      } as any,
      res,
    );

    expect(res.body.success).toBe(true);
  });

  it('invalid setting value returns 400', async () => {
    const res = createMockRes();
    await accessibilityHandler(
      {
        body: {
          callSessionId: UUID_SESSION,
          lineId: UUID_LINE,
          setting: 'hearing_mode',
          value: 'invalid_mode',
        },
      } as any,
      res,
    );

    expect(res.statusCode).toBe(400);
  });

  it('line mismatch returns 403', async () => {
    const res = createMockRes();
    await accessibilityHandler(
      {
        body: {
          callSessionId: UUID_SESSION,
          lineId: UUID_OTHER_LINE,
          setting: 'speech_rate',
          value: '1.0',
        },
      } as any,
      res,
    );

    expect(res.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// log_health_mention
// ---------------------------------------------------------------------------

describe('log_health_mention', () => {
  it('happy path - encrypts summary and inserts', async () => {
    const builder: any = {};
    builder.insert = vi.fn(async () => ({ data: null, error: null }));
    vi.mocked(getSupabaseClient).mockReturnValue({ from: vi.fn(() => builder) } as any);

    const res = createMockRes();
    await healthMentionHandler(
      {
        body: {
          callSessionId: UUID_SESSION,
          lineId: UUID_LINE,
          category: 'pain',
          summary: 'Mentioned back pain in the afternoon.',
          severity: 'mild',
        },
      } as any,
      res,
    );

    expect(res.body.success).toBe(true);
  });

  it('Zod validation failure returns 400', async () => {
    const res = createMockRes();
    await healthMentionHandler(
      {
        body: {
          callSessionId: UUID_SESSION,
          lineId: UUID_LINE,
          // missing required: category, summary
        },
      } as any,
      res,
    );

    expect(res.statusCode).toBe(400);
  });

  it('line mismatch returns 403', async () => {
    const res = createMockRes();
    await healthMentionHandler(
      {
        body: {
          callSessionId: UUID_SESSION,
          lineId: UUID_OTHER_LINE,
          category: 'medication',
          summary: 'Took aspirin today.',
        },
      } as any,
      res,
    );

    expect(res.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// update_content_preference
// ---------------------------------------------------------------------------

describe('update_content_preference', () => {
  function makeContentPrefSupabase(currentValue: number = 3) {
    const builder: any = {};
    builder.select = vi.fn(() => builder);
    builder.insert = vi.fn(async () => ({ data: null, error: null }));
    builder.update = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.maybeSingle = vi.fn(async () => ({ data: { trivia_preference: currentValue, story_preference: currentValue }, error: null }));
    builder.then = (resolve: (v: any) => any) => Promise.resolve({ data: null, error: null }).then(resolve);
    return { from: vi.fn(() => builder) };
  }

  it('increase preference - increments value', async () => {
    vi.mocked(getSupabaseClient).mockReturnValue(makeContentPrefSupabase(3) as any);

    const res = createMockRes();
    await contentPrefHandler(
      {
        body: {
          callSessionId: UUID_SESSION,
          lineId: UUID_LINE,
          content_type: 'trivia',
          preference_change: 'increase',
        },
      } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.value).toBe(4);
  });

  it('decrease preference - decrements value', async () => {
    vi.mocked(getSupabaseClient).mockReturnValue(makeContentPrefSupabase(3) as any);

    const res = createMockRes();
    await contentPrefHandler(
      {
        body: {
          callSessionId: UUID_SESSION,
          lineId: UUID_LINE,
          content_type: 'story',
          preference_change: 'decrease',
        },
      } as any,
      res,
    );

    expect(res.body.success).toBe(true);
    expect(res.body.value).toBe(2);
  });

  it('rejects update_content_preference with invalid content_type — 400', async () => {
    const res = createMockRes();
    await contentPrefHandler(
      {
        body: {
          callSessionId: UUID_SESSION,
          lineId: UUID_LINE,
          content_type: 'invalid_type',
          preference_change: 'increase',
        },
      } as any,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
