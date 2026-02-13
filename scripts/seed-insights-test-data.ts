/**
 * Seed script to populate insights page with realistic test data
 *
 * Usage: npx tsx scripts/seed-insights-test-data.ts
 *
 * Requires:
 * - ULTAURA_ENCRYPTION_KEY environment variable
 * - Local Supabase running
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Encryption constants
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// Supabase local config
const SUPABASE_URL = 'http://localhost:54321';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Account and line IDs matching seed.sql Margaret Johnson
const ACCOUNT_ID = '00000000-0000-0000-0000-000000000001';
const LINE_ID = '11111111-1111-1111-1111-111111111111';

// Call session IDs from seed.sql (skip 505 = no_answer/machine)
const SEED_CALL_SESSION_IDS = [
  '55555555-5555-5555-5555-555555555501',
  '55555555-5555-5555-5555-555555555502',
  '55555555-5555-5555-5555-555555555503',
  '55555555-5555-5555-5555-555555555504',
  '55555555-5555-5555-5555-555555555506',
  '55555555-5555-5555-5555-555555555507',
  '55555555-5555-5555-5555-555555555508',
];

function getKEK(): Buffer {
  const kekHex = process.env.ULTAURA_ENCRYPTION_KEY;
  if (!kekHex || kekHex.length !== 64) {
    throw new Error('ULTAURA_ENCRYPTION_KEY must be 64 hex characters');
  }
  return Buffer.from(kekHex, 'hex');
}

function generateDEK(): Buffer {
  return crypto.randomBytes(KEY_LENGTH);
}

function wrapDEK(dek: Buffer): { wrapped: Buffer; iv: Buffer; tag: Buffer } {
  const kek = getKEK();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, kek, iv, { authTagLength: TAG_LENGTH });
  const wrapped = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { wrapped, iv, tag };
}

function encrypt(
  plaintext: string,
  dek: Buffer,
  aad: Buffer
): { ciphertext: Buffer; iv: Buffer; tag: Buffer } {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, dek, iv, { authTagLength: TAG_LENGTH });
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext, iv, tag };
}

async function getOrCreateAccountDEK(): Promise<Buffer> {
  // Delete any existing DEK for this seed account so we always start fresh.
  // Supabase returns bytea in formats that differ across client versions,
  // making unwrapping unreliable in standalone scripts.
  await supabase
    .from('ultaura_account_crypto_keys')
    .delete()
    .eq('account_id', ACCOUNT_ID);

  const dek = generateDEK();
  const { wrapped, iv, tag } = wrapDEK(dek);

  await supabase.from('ultaura_account_crypto_keys').insert({
    account_id: ACCOUNT_ID,
    dek_wrapped: wrapped,
    dek_wrap_iv: iv,
    dek_wrap_tag: tag,
    dek_kid: 'kek_v1',
    dek_alg: 'AES-256-GCM',
  });

  return dek;
}

function randomDate(daysAgo: number): Date {
  const now = new Date();
  const pastDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const randomOffset = Math.random() * (daysAgo * 24 * 60 * 60 * 1000);
  return new Date(pastDate.getTime() + randomOffset);
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}



interface LineConfig {
  lineId: string;
  shortId: string;
  displayName: string;
  timezone: string;
  birthYear: number;
  hometown: string;
  currentLocation: string;
  voice: string;
}

async function seedLineData(
  lineConfig: LineConfig,
  dek: Buffer,
  relationships: Array<{
    name: string;
    nickname?: string;
    relation_type: string;
    relation_role: string;
    contact_frequency?: string;
    sentiment: string;
    emotional_significance: string;
    location?: string;
    distance_category?: string;
    shared_activities?: string[];
    times_mentioned: number;
    is_deceased?: boolean;
    passed_at?: string;
    grief_sensitivity?: string;
  }>,
  memoryData: Array<{ type: string; key: string; value: string }>
) {
  const { lineId } = lineConfig;

  // Create line baselines
  await supabase.from('ultaura_line_baselines').upsert({
    line_id: lineId,
    avg_engagement: 7 + Math.random(),
    avg_duration_seconds: 400 + Math.floor(Math.random() * 200),
    calls_per_week: 4 + Math.random() * 2,
    answer_rate: 0.85 + Math.random() * 0.1,
    mood_distribution: { positive: 40 + Math.floor(Math.random() * 10), neutral: 30 + Math.floor(Math.random() * 10), low: 15 + Math.floor(Math.random() * 10) },
    recent_concern_codes: ['fatigue', 'sleep_issues'].slice(0, 1 + Math.floor(Math.random() * 2)),
    baseline_call_count: SEED_CALL_SESSION_IDS.length,
  });

  // Create emotional patterns
  await supabase.from('ultaura_emotional_patterns').insert({
    line_id: lineId,
    dominant_mood: randomElement(['positive', 'neutral']),
    mood_variability: randomElement(['low', 'moderate']),
    best_time_of_day: 'morning',
    worst_time_of_day: 'evening',
    positive_triggers: ['grandchildren', 'gardening', 'old movies', 'baking'].slice(0, 2 + Math.floor(Math.random() * 3)),
    negative_triggers: ['loneliness', 'health concerns', 'news'].slice(0, 1 + Math.floor(Math.random() * 2)),
    effective_techniques: ['reminiscing', 'humor', 'planning activities'].slice(0, 2),
    ineffective_techniques: ['direct advice'],
  });

  // Create relationships
  const relationshipIds: string[] = [];
  for (const rel of relationships) {
    const relId = crypto.randomUUID();
    relationshipIds.push(relId);
    await supabase.from('ultaura_relationships').insert({
      id: relId,
      line_id: lineId,
      account_id: ACCOUNT_ID,
      ...rel,
      last_mentioned_at: randomDate(7).toISOString(),
    });
  }

  // Create milestones
  const milestones = [
    { milestone_type: 'birthday', title: `${lineConfig.displayName.split(' ')[0]}'s Birthday`, date_month: 4 + Math.floor(Math.random() * 6), date_day: 10 + Math.floor(Math.random() * 15), date_year: lineConfig.birthYear, is_recurring: true, related_person_name: lineConfig.displayName, times_celebrated: 1 + Math.floor(Math.random() * 2) },
  ];
  if (relationships.find(r => r.is_deceased)) {
    const deceased = relationships.find(r => r.is_deceased)!;
    const deceasedIdx = relationships.indexOf(deceased);
    milestones.push({ milestone_type: 'memorial', title: `${deceased.name.split(' ')[0]}'s Passing`, date_month: 3, date_day: 15, date_year: 2022, is_recurring: true, related_relationship_id: relationshipIds[deceasedIdx], related_person_name: deceased.name } as any);
  }

  for (const ms of milestones) {
    await supabase.from('ultaura_milestones').insert({
      line_id: lineId,
      account_id: ACCOUNT_ID,
      ...ms,
    });
  }

  // Create call sessions and related data
  const moodOveralls: Array<'positive' | 'neutral' | 'low'> = ['positive', 'neutral', 'low'];
  const topics: string[] = ['family', 'friends', 'activities', 'interests', 'memories', 'plans', 'daily_life', 'entertainment', 'feelings', 'requests'];
  const concerns: string[] = ['fatigue', 'sleep', 'loneliness', 'pain', 'appetite'];

  // Use existing call session IDs from seed.sql (already created there)
  const callSessions: { id: string; createdAt: Date }[] = SEED_CALL_SESSION_IDS.map((id, i) => ({
    id,
    createdAt: new Date(Date.now() - (14 - i * 2) * 24 * 60 * 60 * 1000),
  }));

  for (let i = 0; i < callSessions.length; i++) {
    const callId = callSessions[i].id;
    const callDate = callSessions[i].createdAt;
    const duration = 180 + Math.floor(Math.random() * 600);

    // Call sessions and mood snapshots already exist from seed.sql, only add encrypted insights

    // Create call insights (encrypted)
    const callTopics = topics.slice(0, 2 + Math.floor(Math.random() * 4));
    const callConcerns = Math.random() > 0.7 ? concerns.slice(0, 1 + Math.floor(Math.random() * 2)) : [];

    const insightsData = {
      mood_overall: randomElement(moodOveralls),
      mood_intensity: 1 + Math.floor(Math.random() * 3),
      engagement_score: 5 + Math.floor(Math.random() * 5),
      social_need_level: Math.floor(Math.random() * 4),
      topics: callTopics.map(t => ({ code: t as string, weight: +(0.2 + Math.random() * 0.8).toFixed(2) })),
      private_topics: [] as string[],
      concerns: callConcerns.map(c => ({
        code: c,
        severity: 1 + Math.floor(Math.random() * 3),
        confidence: +(0.5 + Math.random() * 0.5).toFixed(2),
        is_novel: Math.random() > 0.7,
      })),
      needs_follow_up: Math.random() > 0.8,
      follow_up_reasons: [] as string[],
      confidence_overall: +(0.6 + Math.random() * 0.4).toFixed(2),
    };

    const aad = Buffer.from(
      JSON.stringify({
        account_id: ACCOUNT_ID,
        line_id: lineId,
        call_session_id: callId,
        type: 'call_insight',
      }),
      'utf8'
    );
    const encrypted = encrypt(JSON.stringify(insightsData), dek, aad);

    await supabase.from('ultaura_call_insights').insert({
      call_session_id: callId,
      line_id: lineId,
      account_id: ACCOUNT_ID,
      created_at: callDate.toISOString(),
      insights_ciphertext: encrypted.ciphertext,
      insights_iv: encrypted.iv,
      insights_tag: encrypted.tag,
      insights_alg: 'aes-256-gcm',
      insights_kid: 'kek_v1',
      extraction_method: 'tool_call',
      duration_seconds: duration,
      has_concerns: callConcerns.length > 0,
      needs_follow_up: Math.random() > 0.8,
      has_baseline: true,
    });

    // Create segment engagement
    if (Math.random() > 0.5) {
      await supabase.from('ultaura_segment_engagement').insert({
        line_id: lineId,
        account_id: ACCOUNT_ID,
        call_session_id: callId,
        created_at: callDate.toISOString(),
        segment_type: randomElement(['trivia', 'story', 'learning', 'memory_lane']),
        segment_domain: randomElement(['history', 'music', 'movies', 'science', 'geography']),
        duration_seconds: 60 + Math.floor(Math.random() * 180),
        completed: Math.random() > 0.3,
        senior_response: randomElement(['enjoyed', 'neutral', 'declined']),
      });
    }
  }

  // Create memories (encrypted)
  for (const mem of memoryData) {
    const memId = crypto.randomUUID();
    const aad = Buffer.from(
      JSON.stringify({
        account_id: ACCOUNT_ID,
        line_id: lineId,
        memory_id: memId,
        type: mem.type,
        key: mem.key,
      }),
      'utf8'
    );
    const encrypted = encrypt(mem.value, dek, aad);
    const randomCall = randomElement(callSessions);

    await supabase.from('ultaura_memories').insert({
      id: memId,
      account_id: ACCOUNT_ID,
      line_id: lineId,
      type: mem.type,
      key: mem.key,
      value_ciphertext: encrypted.ciphertext,
      value_iv: encrypted.iv,
      value_tag: encrypted.tag,
      value_alg: 'AES-256-GCM',
      value_kid: 'dek_v1',
      confidence: 0.7 + Math.random() * 0.3,
      source: 'conversation',
      active: true,
      privacy_scope: 'shareable_with_payer',
      created_in_call_session_id: randomCall.id,
      last_accessed_at: randomDate(14).toISOString(),
      access_count: Math.floor(Math.random() * 10),
    });
  }

  // Create story arcs
  const storyArcs = [
    { story_type: 'serial', title: 'The Mystery of Willow Creek', description: 'A cozy mystery set in a small New England town', total_chapters: 8, current_chapter: 3 + Math.floor(Math.random() * 4), status: 'active', era_setting: '1950s', themes: ['mystery', 'small town', 'friendship'] },
  ];

  for (const arc of storyArcs) {
    await supabase.from('ultaura_story_arcs').insert({
      line_id: lineId,
      account_id: ACCOUNT_ID,
      ...arc,
      last_chapter_at: randomDate(7).toISOString(),
      engagement_score: 0.7 + Math.random() * 0.3,
    });
  }

  // Create call previews
  const previewTopics = [
    { topic_type: 'memory_follow_up', topic_key: 'garden_update', topic_display: 'How are the tomatoes doing?', status: 'used', followed_through: true, follow_through_response: 'engaged' },
    { topic_type: 'segment', topic_key: 'trivia_history', topic_display: '1940s Music Trivia', segment_type: 'trivia', status: 'used', followed_through: true, follow_through_response: 'engaged' },
    { topic_type: 'memory_follow_up', topic_key: 'grandchild_visit', topic_display: "How was the video call?", status: 'pending' },
  ];

  for (const preview of previewTopics) {
    const offeredAt = randomDate(14);
    const usedAt = preview.status === 'used' ? new Date(offeredAt.getTime() + 24 * 60 * 60 * 1000) : null;

    await supabase.from('ultaura_call_previews').insert({
      line_id: lineId,
      account_id: ACCOUNT_ID,
      ...preview,
      offered_at: offeredAt.toISOString(),
      selected_at: preview.status !== 'pending' ? new Date(offeredAt.getTime() + 1000).toISOString() : null,
      used_at: usedAt?.toISOString(),
    });
  }

  // Create safety events
  const safetyEvents = [
    { tier: 'low', category: 'ISOLATION_DISTRESS', action_taken: 'none', confidence: 0.65, signals: { type: 'isolation_distress', keywords: ['lonely', 'miss'], context: 'Mentioned feeling lonely after book club was cancelled' } },
    { tier: 'low', category: 'GENERAL_CONCERN', action_taken: 'none', confidence: 0.55, signals: { type: 'distress_keywords', keywords: ['tired'], context: 'Mentioned being more tired than usual' } },
  ];

  for (const event of safetyEvents) {
    const randomCall = randomElement(callSessions);
    await supabase.from('ultaura_safety_events').insert({
      account_id: ACCOUNT_ID,
      line_id: lineId,
      call_session_id: randomCall.id,
      created_at: randomCall.createdAt.toISOString(),
      ...event,
    });
  }

  return callSessions;
}

async function main() {
  console.log('Starting insights test data seed for Margaret Johnson (marg0001)...');

  const dek = await getOrCreateAccountDEK();
  console.log('Got account encryption key');

  // Delete existing fake call_insights for seed.sql call sessions
  const { error: deleteError } = await supabase
    .from('ultaura_call_insights')
    .delete()
    .eq('line_id', LINE_ID);

  if (deleteError) {
    console.error('Error deleting existing insights:', deleteError);
  } else {
    console.log('Cleared existing fake call_insights rows');
  }

  // Create insight privacy (enabled)
  await supabase.from('ultaura_insight_privacy').upsert({
    line_id: LINE_ID,
    insights_enabled: true,
    is_paused: false,
  });
  console.log('Ensured insight privacy is enabled');

  // Seed relationships, memories, insights, etc. for Margaret
  const relationships = [
    { name: 'Robert Johnson', nickname: 'Bobby', relation_type: 'family', relation_role: 'son', contact_frequency: 'weekly', sentiment: 'positive', emotional_significance: 'high', location: 'Boston, MA', distance_category: 'distant', shared_activities: ['phone calls', 'holiday visits'], times_mentioned: 15 },
    { name: 'Sarah Mitchell', nickname: 'Sarah', relation_type: 'family', relation_role: 'daughter', contact_frequency: 'daily', sentiment: 'positive', emotional_significance: 'high', location: 'Tampa, FL', distance_category: 'local', shared_activities: ['grocery shopping', 'doctor visits', 'Sunday dinners'], times_mentioned: 28 },
    { name: 'Emily Johnson', nickname: 'Emmy', relation_type: 'family', relation_role: 'granddaughter', contact_frequency: 'weekly', sentiment: 'positive', emotional_significance: 'high', location: 'Boston, MA', distance_category: 'distant', shared_activities: ['video calls', 'birthday cards'], times_mentioned: 12 },
    { name: 'Harold Johnson', nickname: 'Harry', relation_type: 'family', relation_role: 'husband', sentiment: 'positive', emotional_significance: 'high', is_deceased: true, passed_at: '2022-03-15', grief_sensitivity: 'medium', times_mentioned: 8 },
    { name: 'Dorothy Chen', nickname: 'Dot', relation_type: 'friend', relation_role: 'neighbor', contact_frequency: 'weekly', sentiment: 'positive', emotional_significance: 'medium', location: 'Tampa, FL', distance_category: 'local', shared_activities: ['morning walks', 'book club'], times_mentioned: 6 },
    { name: 'Dr. Martinez', relation_type: 'professional', relation_role: 'doctor', contact_frequency: 'monthly', sentiment: 'neutral', emotional_significance: 'medium', times_mentioned: 4 },
  ];

  const memories = [
    { type: 'fact', key: 'favorite_flower', value: 'Roses, especially red ones from the garden' },
    { type: 'preference', key: 'music_preference', value: 'Big band music from the 1940s, especially Glenn Miller' },
    { type: 'fact', key: 'career_history', value: 'Worked as a nurse at Boston General for 35 years' },
    { type: 'history', key: 'childhood_pet', value: 'Had a golden retriever named Sunny as a child' },
    { type: 'preference', key: 'food_preference', value: 'Loves Italian food, especially homemade lasagna' },
    { type: 'fact', key: 'hobby_gardening', value: 'Maintains a vegetable garden with tomatoes and peppers' },
    { type: 'relationship', key: 'grandchildren_count', value: 'Has 4 grandchildren: Emily, Jake, Sophie, and baby Thomas' },
    { type: 'follow_up', key: 'doctor_appointment', value: 'Has a checkup with Dr. Martinez next Tuesday' },
    { type: 'history', key: 'honeymoon_location', value: 'Honeymooned in Niagara Falls in 1968' },
    { type: 'preference', key: 'tv_shows', value: 'Enjoys watching Jeopardy and old movies on TCM' },
  ];

  await seedLineData(
    { lineId: LINE_ID, shortId: 'marg0001', displayName: 'Margaret Johnson', timezone: 'America/New_York', birthYear: 1945, hometown: 'Boston, MA', currentLocation: 'Tampa, FL', voice: 'Eve' },
    dek,
    relationships,
    memories
  );
  console.log('Seeded properly encrypted data for Margaret Johnson');

  console.log('\n✅ Seed complete!');
  console.log('  Margaret Johnson (marg0001) - properly encrypted insights');
  console.log('  View: http://localhost:3000/dashboard/insights/marg0001/mood');
}

main().catch(console.error);
