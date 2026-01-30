/**
 * Regenerate encrypted call insights for existing call sessions.
 *
 * Usage:
 *   npx tsx scripts/regenerate-line-insights.ts --line-id <uuid> [--limit 20]
 *
 * Requires:
 *   - ULTAURA_ENCRYPTION_KEY
 *   - SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Notes:
 *   - Generates synthetic insights; does not require telephony to run.
 *   - Skips sessions that already have insights.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const INSIGHTS_ALG = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

type ByteaInput = Uint8Array | string | null | undefined;

function parseEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, 'utf8');
  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (!key || key in process.env) continue;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function loadEnv(): void {
  const root = process.cwd();
  parseEnvFile(path.join(root, '.env.local'));
  parseEnvFile(path.join(root, '.env.development'));
  parseEnvFile(path.join(root, '.env'));
}

function encodeBytea(value: Uint8Array | Buffer): string {
  return `\\x${Buffer.from(value).toString('hex')}`;
}

function parseBufferJson(value: string): Buffer | null {
  const text = value.trim();
  if (!text || (!text.startsWith('{') && !text.startsWith('['))) return null;
  try {
    const parsed = JSON.parse(text) as { type?: string; data?: unknown };
    if (parsed?.type === 'Buffer' && Array.isArray(parsed.data)) {
      return Buffer.from(parsed.data);
    }
  } catch {
    return null;
  }
  return null;
}

function normalizeDecoded(buffer: Buffer): Buffer {
  return parseBufferJson(buffer.toString('utf8')) ?? buffer;
}

function decodeBytea(value: ByteaInput): Buffer | null {
  if (!value) return null;
  if (value instanceof Uint8Array) return normalizeDecoded(Buffer.from(value));
  if (typeof value !== 'string') return null;

  let trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    trimmed = trimmed.slice(1, -1).trim();
  }

  const parsed = parseBufferJson(trimmed);
  if (parsed) return parsed;

  if (trimmed.startsWith('\\\\x')) trimmed = trimmed.slice(1);
  if (trimmed.startsWith('\\x') || trimmed.startsWith('0x')) {
    return normalizeDecoded(Buffer.from(trimmed.slice(2), 'hex'));
  }
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    return normalizeDecoded(Buffer.from(trimmed, 'hex'));
  }
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed) && trimmed.length % 4 === 0) {
    return normalizeDecoded(Buffer.from(trimmed, 'base64'));
  }
  return normalizeDecoded(Buffer.from(trimmed, 'utf8'));
}

function getKEK(): Buffer {
  const kekHex = process.env.ULTAURA_ENCRYPTION_KEY;
  if (!kekHex || kekHex.length !== 64) {
    throw new Error('Missing or invalid ULTAURA_ENCRYPTION_KEY (must be 64 hex chars).');
  }
  return Buffer.from(kekHex, 'hex');
}

function wrapDEK(dek: Buffer): { wrapped: Buffer; iv: Buffer; tag: Buffer } {
  const kek = getKEK();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(INSIGHTS_ALG, kek, iv, { authTagLength: TAG_LENGTH });
  const wrapped = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { wrapped, iv, tag };
}

function unwrapDEK(wrapped: Buffer, iv: Buffer, tag: Buffer): Buffer {
  const kek = getKEK();
  const decipher = crypto.createDecipheriv(INSIGHTS_ALG, kek, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(wrapped), decipher.final()]);
}

function buildInsightsAAD(accountId: string, lineId: string, callSessionId: string): Buffer {
  return Buffer.from(
    JSON.stringify({
      account_id: accountId,
      line_id: lineId,
      call_session_id: callSessionId,
      type: 'call_insight',
    }),
    'utf8'
  );
}

function encryptInsights(
  dek: Buffer,
  insights: Record<string, unknown>,
  aad: Buffer
): { ciphertext: Buffer; iv: Buffer; tag: Buffer } {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(INSIGHTS_ALG, dek, iv, { authTagLength: TAG_LENGTH });
  cipher.setAAD(aad);
  const plaintext = Buffer.from(JSON.stringify(insights), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext, iv, tag };
}

function seedFromString(input: string): () => number {
  const hash = crypto.createHash('sha256').update(input).digest();
  let seed = hash.readUInt32BE(0);
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function pickMany<T>(rng: () => number, items: T[], count: number): T[] {
  const pool = [...items];
  const result: T[] = [];
  while (pool.length > 0 && result.length < count) {
    const idx = Math.floor(rng() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

function clamp(num: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, num));
}

function buildSyntheticInsights(rng: () => number) {
  const moods = ['positive', 'neutral', 'low'] as const;
  const topics = [
    'family',
    'friends',
    'activities',
    'interests',
    'memories',
    'plans',
    'daily_life',
    'entertainment',
    'feelings',
    'requests',
  ] as const;
  const concerns = ['loneliness', 'sadness', 'anxiety', 'sleep', 'pain', 'fatigue', 'appetite'] as const;
  const followUps = [
    'loneliness',
    'sadness',
    'anxiety',
    'sleep',
    'pain',
    'fatigue',
    'appetite',
    'wants_more_contact',
    'missed_routine',
  ] as const;

  const mood_overall = pick(rng, moods);
  const mood_intensity = Math.floor(rng() * 4);
  const engagement_score = clamp(Math.round(3 + rng() * 7), 1, 10);
  const social_need_level = Math.floor(rng() * 4);

  const topicCount = clamp(2 + Math.floor(rng() * 3), 1, topics.length);
  const selectedTopics = pickMany(rng, topics, topicCount).map((code) => ({
    code,
    weight: Number((0.2 + rng() * 0.7).toFixed(2)),
  }));

  const includeConcerns = rng() > 0.7;
  const concernCount = includeConcerns ? 1 + Math.floor(rng() * 2) : 0;
  const selectedConcerns = includeConcerns
    ? pickMany(rng, concerns, concernCount).map((code) => ({
        code,
        severity: clamp(1 + Math.floor(rng() * 3), 1, 3),
        confidence: Number((0.4 + rng() * 0.5).toFixed(2)),
        is_novel: rng() > 0.6,
      }))
    : [];

  const needs_follow_up = selectedConcerns.length > 0 && rng() > 0.4;
  const follow_up_reasons = needs_follow_up
    ? pickMany(rng, followUps, 1 + Math.floor(rng() * 2))
    : [];

  const confidence_overall = Number((0.5 + rng() * 0.45).toFixed(2));

  return {
    mood_overall,
    mood_intensity,
    engagement_score,
    social_need_level,
    topics: selectedTopics,
    private_topics: [],
    concerns: selectedConcerns,
    needs_follow_up,
    follow_up_reasons,
    confidence_overall,
  };
}

async function getOrCreateAccountDEK(
  supabase: ReturnType<typeof createClient>,
  accountId: string
): Promise<Buffer> {
  const { data: existing, error } = await supabase
    .from('ultaura_account_crypto_keys')
    .select('dek_wrapped, dek_wrap_iv, dek_wrap_tag')
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (existing) {
    const wrapped = decodeBytea(existing.dek_wrapped);
    const iv = decodeBytea(existing.dek_wrap_iv);
    const tag = decodeBytea(existing.dek_wrap_tag);
    if (!wrapped || !iv || !tag) {
      throw new Error('Failed to decode account DEK payloads');
    }
    return unwrapDEK(wrapped, iv, tag);
  }

  const dek = crypto.randomBytes(KEY_LENGTH);
  const { wrapped, iv, tag } = wrapDEK(dek);
  const { error: insertError } = await supabase.from('ultaura_account_crypto_keys').insert({
    account_id: accountId,
    dek_wrapped: encodeBytea(wrapped),
    dek_wrap_iv: encodeBytea(iv),
    dek_wrap_tag: encodeBytea(tag),
    dek_kid: 'kek_v1',
    dek_alg: 'AES-256-GCM',
  });

  if (insertError) {
    throw insertError;
  }

  return dek;
}

async function main(): Promise<void> {
  loadEnv();

  const argv = process.argv.slice(2);
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : '';
    args.set(key.slice(2), value);
  }

  const lineId = args.get('line-id') || process.env.LINE_ID || argv[0];
  if (!lineId) {
    throw new Error('Missing --line-id <uuid>');
  }

  const limitRaw = args.get('limit') || '';
  const limit = limitRaw ? Number(limitRaw) : undefined;

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'http://localhost:54321';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: line, error: lineError } = await supabase
    .from('ultaura_lines')
    .select('id, account_id')
    .eq('id', lineId)
    .maybeSingle();

  if (lineError || !line) {
    throw new Error(`Line not found: ${lineId}`);
  }

  let sessionsQuery = supabase
    .from('ultaura_call_sessions')
    .select('id, created_at, seconds_connected, is_test_call')
    .eq('line_id', lineId)
    .order('created_at', { ascending: false });

  if (limit && Number.isFinite(limit)) {
    sessionsQuery = sessionsQuery.limit(limit);
  }

  const { data: sessions, error: sessionsError } = await sessionsQuery;
  if (sessionsError) {
    throw sessionsError;
  }

  if (!sessions || sessions.length === 0) {
    console.log('No call sessions found for this line.');
    return;
  }

  const sessionIds = sessions.map((session) => session.id);
  const { data: existingInsights } = await supabase
    .from('ultaura_call_insights')
    .select('call_session_id')
    .in('call_session_id', sessionIds);

  const existingSet = new Set((existingInsights ?? []).map((row) => row.call_session_id));
  const sessionsToSeed = sessions.filter((session) => !existingSet.has(session.id));

  if (sessionsToSeed.length === 0) {
    console.log('All sessions already have insights.');
    return;
  }

  const dek = await getOrCreateAccountDEK(supabase, line.account_id);

  const rows = sessionsToSeed.map((session) => {
    const rng = seedFromString(session.id);
    const insights = buildSyntheticInsights(rng);
    const aad = buildInsightsAAD(line.account_id, line.id, session.id);
    const encrypted = encryptInsights(dek, insights, aad);
    const durationSeconds =
      typeof session.seconds_connected === 'number'
        ? Math.max(0, Math.round(session.seconds_connected))
        : Math.round(180 + rng() * 420);
    const hasConcerns = (insights.concerns ?? []).length > 0;

    return {
      call_session_id: session.id,
      line_id: line.id,
      account_id: line.account_id,
      insights_ciphertext: encodeBytea(encrypted.ciphertext),
      insights_iv: encodeBytea(encrypted.iv),
      insights_tag: encodeBytea(encrypted.tag),
      insights_alg: INSIGHTS_ALG,
      insights_kid: 'kek_v1',
      extraction_method: 'post_call_fallback',
      duration_seconds: durationSeconds,
      has_concerns: hasConcerns,
      needs_follow_up: insights.needs_follow_up ?? false,
      has_baseline: false,
    };
  });

  const chunkSize = 25;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from('ultaura_call_insights').insert(chunk);
    if (error) {
      throw error;
    }
    inserted += chunk.length;
  }

  console.log(`Inserted ${inserted} insights for line ${line.id}.`);
}

main().catch((error) => {
  console.error('Failed to regenerate insights:', error);
  process.exit(1);
});
