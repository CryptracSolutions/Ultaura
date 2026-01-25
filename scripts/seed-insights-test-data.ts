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

// Account and org IDs for test@example.com
const ACCOUNT_ID = '2e825530-649c-4536-b6eb-9a818f24411b';
const ORGANIZATION_ID = 1;

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
  const { data: existingKey } = await supabase
    .from('ultaura_account_crypto_keys')
    .select('*')
    .eq('account_id', ACCOUNT_ID)
    .single();

  if (existingKey) {
    // Unwrap existing DEK
    const kek = getKEK();
    const wrapped = Buffer.from(existingKey.dek_wrapped);
    const iv = Buffer.from(existingKey.dek_wrap_iv);
    const tag = Buffer.from(existingKey.dek_wrap_tag);
    const decipher = crypto.createDecipheriv(ALGORITHM, kek, iv, { authTagLength: TAG_LENGTH });
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(wrapped), decipher.final()]);
  }

  // Create new DEK
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

function generateShortId(): string {
  return crypto.randomBytes(4).toString('hex');
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
  memoryData: Array<{ type: string; key: string; value: string }>,
  callCount: number
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
    baseline_call_count: callCount,
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
  const moods: string[] = ['positive', 'neutral', 'low', 'anxious', 'sad'];
  const energyLevels: string[] = ['high', 'normal', 'low', 'very_low'];
  const topics: string[] = ['family', 'health', 'hobbies', 'memories', 'daily_routine', 'weather', 'news', 'food', 'pets', 'travel'];
  const concerns: string[] = ['fatigue', 'sleep_issues', 'loneliness', 'mobility', 'appetite'];

  const callSessions: { id: string; createdAt: Date }[] = [];

  for (let i = 0; i < callCount; i++) {
    const callId = crypto.randomUUID();
    const callDate = randomDate(30);
    const duration = 180 + Math.floor(Math.random() * 600);

    const startedAt = callDate;
    const connectedAt = new Date(startedAt.getTime() + 5000);
    const endedAt = new Date(connectedAt.getTime() + duration * 1000);

    callSessions.push({ id: callId, createdAt: callDate });

    await supabase.from('ultaura_call_sessions').insert({
      id: callId,
      account_id: ACCOUNT_ID,
      line_id: lineId,
      created_at: callDate.toISOString(),
      direction: 'outbound',
      status: 'completed',
      started_at: startedAt.toISOString(),
      connected_at: connectedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      seconds_connected: duration,
      twilio_call_sid: `CA${crypto.randomBytes(16).toString('hex')}`,
      twilio_from: '+18005551234',
      twilio_to: '+15551234567',
      end_reason: 'hangup',
      answered_by: 'human',
      tool_invocations: 5 + Math.floor(Math.random() * 15),
    });

    // Create mood snapshot
    const moodStart = randomElement(moods);
    const moodEnd = randomElement(moods);
    const trajectory = moodStart === moodEnd ? 'stable' : (moods.indexOf(moodEnd as string) < moods.indexOf(moodStart as string) ? 'improved' : 'declined');

    await supabase.from('ultaura_mood_snapshots').insert({
      call_session_id: callId,
      line_id: lineId,
      account_id: ACCOUNT_ID,
      created_at: callDate.toISOString(),
      mood_start: moodStart,
      mood_mid: randomElement(moods),
      mood_end: moodEnd,
      mood_start_at: startedAt.toISOString(),
      mood_mid_at: new Date(startedAt.getTime() + duration * 500).toISOString(),
      mood_end_at: endedAt.toISOString(),
      mood_trajectory: trajectory,
      energy_level: randomElement(energyLevels),
      techniques_used: ['reminiscing', 'active_listening', 'humor'].slice(0, 1 + Math.floor(Math.random() * 2)),
      technique_effectiveness: { reminiscing: 'effective', active_listening: 'effective' },
    });

    // Create call insights (encrypted)
    const callTopics = topics.slice(0, 2 + Math.floor(Math.random() * 4));
    const callConcerns = Math.random() > 0.7 ? concerns.slice(0, 1 + Math.floor(Math.random() * 2)) : [];

    const insightsData = {
      summary: `${lineConfig.displayName.split(' ')[0]} discussed ${callTopics.join(', ')}. She seemed ${moodEnd} overall.`,
      topics: callTopics.map(t => ({ topic: t, sentiment: randomElement(['positive', 'neutral', 'negative']), mentions: 1 + Math.floor(Math.random() * 5) })),
      concerns: callConcerns.map(c => ({ code: c, severity: randomElement(['low', 'medium']), context: `Mentioned ${c} briefly` })),
      highlights: [`Talked about ${randomElement(callTopics)}`, `Mentioned ${randomElement(['grandchildren', 'gardening', 'old movies'])}`],
      engagement_score: 5 + Math.floor(Math.random() * 5),
      memory_keys_created: [`${randomElement(callTopics)}_${Date.now()}`],
    };

    const aad = Buffer.from(`${ACCOUNT_ID}:${lineId}`);
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
    const aad = Buffer.from(`${ACCOUNT_ID}:${lineId}`);
    const encrypted = encrypt(mem.value, dek, aad);
    const randomCall = randomElement(callSessions);

    await supabase.from('ultaura_memories').insert({
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
  console.log('Starting insights test data seed...');

  const dek = await getOrCreateAccountDEK();
  console.log('Got account encryption key');

  // Set account to family_managed mode (applies to all lines)
  await supabase
    .from('ultaura_accounts')
    .update({ user_type: 'family_managed' })
    .eq('id', ACCOUNT_ID);
  console.log('Set account user_type to family_managed');

  // ============================================
  // LINE 1: Margaret Johnson (No consent - tier_1 only)
  // ============================================
  const line1Id = crypto.randomUUID();
  const line1ShortId = generateShortId();

  const { error: line1Error } = await supabase.from('ultaura_lines').insert({
    id: line1Id,
    account_id: ACCOUNT_ID,
    short_id: line1ShortId,
    display_name: 'Margaret Johnson',
    phone_e164: `+1555${Date.now().toString().slice(-7)}`,
    phone_verified_at: new Date().toISOString(),
    status: 'active',
    timezone: 'America/New_York',
    birth_year: 1945,
    hometown: 'Boston, MA',
    current_location: 'Tampa, FL',
    preferred_grok_voice: 'Eve',
  });

  if (line1Error) {
    console.error('Error creating line 1:', line1Error);
    return;
  }
  console.log(`Created line 1: ${line1ShortId} (Margaret Johnson - No consent, tier_1 only)`);

  // Create insight privacy (enabled)
  await supabase.from('ultaura_insight_privacy').upsert({
    line_id: line1Id,
    insights_enabled: true,
    is_paused: false,
  });

  // Line 1 has NO consent granted - will default to tier_1 (locked gates for tier_2+)
  // The ultaura_line_voice_consent row is created by RLS trigger with defaults
  console.log('Created insight privacy for line 1 (no sharing consent)');

  // Seed Line 1 data
  const line1Relationships = [
    { name: 'Robert Johnson', nickname: 'Bobby', relation_type: 'family', relation_role: 'son', contact_frequency: 'weekly', sentiment: 'positive', emotional_significance: 'high', location: 'Boston, MA', distance_category: 'distant', shared_activities: ['phone calls', 'holiday visits'], times_mentioned: 15 },
    { name: 'Sarah Mitchell', nickname: 'Sarah', relation_type: 'family', relation_role: 'daughter', contact_frequency: 'daily', sentiment: 'positive', emotional_significance: 'high', location: 'Tampa, FL', distance_category: 'local', shared_activities: ['grocery shopping', 'doctor visits', 'Sunday dinners'], times_mentioned: 28 },
    { name: 'Emily Johnson', nickname: 'Emmy', relation_type: 'family', relation_role: 'granddaughter', contact_frequency: 'weekly', sentiment: 'positive', emotional_significance: 'high', location: 'Boston, MA', distance_category: 'distant', shared_activities: ['video calls', 'birthday cards'], times_mentioned: 12 },
    { name: 'Harold Johnson', nickname: 'Harry', relation_type: 'family', relation_role: 'husband', sentiment: 'positive', emotional_significance: 'high', is_deceased: true, passed_at: '2022-03-15', grief_sensitivity: 'medium', times_mentioned: 8 },
    { name: 'Dorothy Chen', nickname: 'Dot', relation_type: 'friend', relation_role: 'neighbor', contact_frequency: 'weekly', sentiment: 'positive', emotional_significance: 'medium', location: 'Tampa, FL', distance_category: 'local', shared_activities: ['morning walks', 'book club'], times_mentioned: 6 },
    { name: 'Dr. Martinez', relation_type: 'professional', relation_role: 'doctor', contact_frequency: 'monthly', sentiment: 'neutral', emotional_significance: 'medium', times_mentioned: 4 },
  ];

  const line1Memories = [
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
    { lineId: line1Id, shortId: line1ShortId, displayName: 'Margaret Johnson', timezone: 'America/New_York', birthYear: 1945, hometown: 'Boston, MA', currentLocation: 'Tampa, FL', voice: 'Eve' },
    dek,
    line1Relationships,
    line1Memories,
    22
  );
  console.log('Seeded data for line 1 (Margaret Johnson - No consent)');

  // ============================================
  // LINE 2: Eleanor Davis (tier_4 consent)
  // ============================================
  const line2Id = crypto.randomUUID();
  const line2ShortId = generateShortId();

  const { error: line2Error } = await supabase.from('ultaura_lines').insert({
    id: line2Id,
    account_id: ACCOUNT_ID,
    short_id: line2ShortId,
    display_name: 'Eleanor Davis',
    phone_e164: `+1555${(Date.now() + 1).toString().slice(-7)}`,
    phone_verified_at: new Date().toISOString(),
    status: 'active',
    timezone: 'America/Chicago',
    birth_year: 1940,
    hometown: 'Chicago, IL',
    current_location: 'Phoenix, AZ',
    preferred_grok_voice: 'Ara',
  });

  if (line2Error) {
    console.error('Error creating line 2:', line2Error);
    return;
  }
  console.log(`Created line 2: ${line2ShortId} (Eleanor Davis - tier_4 consent)`);

  // Create insight privacy (enabled)
  await supabase.from('ultaura_insight_privacy').upsert({
    line_id: line2Id,
    insights_enabled: true,
    is_paused: false,
  });

  // Create line voice consent (for family_managed mode - tier 4 full access)
  // Use update instead of upsert since RLS creates a row with defaults
  await supabase.from('ultaura_line_voice_consent')
    .update({
      sharing_consent: 'granted',
      sharing_tier: 'tier_4',
    })
    .eq('line_id', line2Id);
  console.log('Created consent data for line 2 (tier_4 access)');

  // Seed Line 2 data
  const line2Relationships = [
    { name: 'Michael Davis', nickname: 'Mike', relation_type: 'family', relation_role: 'son', contact_frequency: 'daily', sentiment: 'positive', emotional_significance: 'high', location: 'Phoenix, AZ', distance_category: 'local', shared_activities: ['dinner', 'errands', 'church'], times_mentioned: 32 },
    { name: 'Jennifer Davis', nickname: 'Jenny', relation_type: 'family', relation_role: 'daughter-in-law', contact_frequency: 'weekly', sentiment: 'positive', emotional_significance: 'high', location: 'Phoenix, AZ', distance_category: 'local', shared_activities: ['shopping', 'cooking together'], times_mentioned: 18 },
    { name: 'Thomas Davis', nickname: 'Tommy', relation_type: 'family', relation_role: 'grandson', contact_frequency: 'weekly', sentiment: 'positive', emotional_significance: 'high', location: 'Phoenix, AZ', distance_category: 'local', shared_activities: ['board games', 'storytelling'], times_mentioned: 14 },
    { name: 'William Davis', nickname: 'Bill', relation_type: 'family', relation_role: 'husband', sentiment: 'positive', emotional_significance: 'high', is_deceased: true, passed_at: '2020-11-22', grief_sensitivity: 'high', times_mentioned: 11 },
    { name: 'Betty Thompson', nickname: 'Betty', relation_type: 'friend', relation_role: 'church friend', contact_frequency: 'weekly', sentiment: 'positive', emotional_significance: 'medium', location: 'Phoenix, AZ', distance_category: 'local', shared_activities: ['church', 'choir practice'], times_mentioned: 9 },
  ];

  const line2Memories = [
    { type: 'fact', key: 'favorite_hymn', value: 'Amazing Grace - sings it in the church choir' },
    { type: 'preference', key: 'music_preference', value: 'Classical music and hymns, especially Beethoven' },
    { type: 'fact', key: 'career_history', value: 'Was a high school English teacher for 40 years' },
    { type: 'history', key: 'childhood_memory', value: 'Grew up on a farm in rural Illinois with 5 siblings' },
    { type: 'preference', key: 'food_preference', value: 'Loves homemade apple pie, makes it for every holiday' },
    { type: 'fact', key: 'hobby_reading', value: 'Avid reader, especially historical fiction and biographies' },
    { type: 'preference', key: 'tv_shows', value: 'Watches PBS documentaries and nature shows' },
    { type: 'follow_up', key: 'choir_practice', value: 'Has choir practice every Thursday at 3pm' },
  ];

  await seedLineData(
    { lineId: line2Id, shortId: line2ShortId, displayName: 'Eleanor Davis', timezone: 'America/Chicago', birthYear: 1940, hometown: 'Chicago, IL', currentLocation: 'Phoenix, AZ', voice: 'Ara' },
    dek,
    line2Relationships,
    line2Memories,
    18
  );
  console.log('Seeded data for line 2 (Eleanor Davis - tier_4 consent)');

  console.log('\n✅ Seed complete!');
  console.log('\n📋 Created Lines (family_managed account):');
  console.log(`  1. Margaret Johnson (${line1ShortId}) - NO consent (tier_1 only, locked gates)`);
  console.log(`     View: http://localhost:3000/dashboard/insights/${line1ShortId}`);
  console.log(`  2. Eleanor Davis (${line2ShortId}) - tier_4 consent (full access)`);
  console.log(`     View: http://localhost:3000/dashboard/insights/${line2ShortId}`);
  console.log('\nUse Margaret to test locked tier gates, Eleanor to see all content.');
}

main().catch(console.error);
