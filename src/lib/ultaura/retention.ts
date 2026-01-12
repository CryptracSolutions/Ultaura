'use server';

import { DateTime } from 'luxon';
import type { SupabaseClient } from '@supabase/supabase-js';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import requireSession from '~/lib/user/require-session';
import getLogger from '~/core/logger';
import type { LineRow } from './types';
import type {
  CallPreview,
  RetentionMetrics,
  SegmentEngagement,
  SegmentStats,
  SegmentType,
  StoryArc,
} from './types/retention';

const logger = getLogger();

const SEGMENT_TYPES: SegmentType[] = ['trivia', 'story', 'learning', 'memory_lane'];
const WINDOW_DAYS = 30;

async function getAuthorizedLine(lineId: string): Promise<LineRow | null> {
  const client = getSupabaseServerActionClient();
  await requireSession(client);

  const { data, error } = await client
    .from('ultaura_lines')
    .select('*')
    .eq('id', lineId)
    .single();

  if (error) {
    if ((error as { code?: string })?.code === 'PGRST116') {
      return null;
    }

    logger.error({ error, lineId }, 'Failed to fetch line');
    return null;
  }

  return data;
}

async function getAdminClient(): Promise<SupabaseClient> {
  return getSupabaseServerActionClient({ admin: true }) as SupabaseClient;
}

function getWindowStartIso(timezone: string, days: number): string | null {
  const now = DateTime.now().setZone(timezone);
  const start = now.minus({ days }).startOf('day');
  return start.toUTC().toISO();
}

export async function getCallPreviewHistory(
  lineId: string,
  limit: number = 10
): Promise<CallPreview[]> {
  const line = await getAuthorizedLine(lineId);
  if (!line) {
    return [];
  }

  const client = await getAdminClient();
  const { data, error } = await client
    .from('ultaura_call_previews')
    .select('*')
    .eq('line_id', lineId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error({ error, lineId }, 'Failed to fetch call previews');
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    lineId: row.line_id,
    accountId: row.account_id,
    createdAt: row.created_at,
    topicType: row.topic_type,
    topicKey: row.topic_key,
    topicDisplay: row.topic_display,
    sourceMemoryIds: row.source_memory_ids || undefined,
    segmentType: row.segment_type || undefined,
    segmentContext: row.segment_context || undefined,
    offeredAt: row.offered_at,
    selectedAt: row.selected_at || undefined,
    usedAt: row.used_at || undefined,
    status: row.status,
    followedThrough: row.followed_through ?? undefined,
    followThroughResponse: row.follow_through_response ?? undefined,
  }));
}

export async function getStoryArcProgress(lineId: string): Promise<StoryArc[]> {
  const line = await getAuthorizedLine(lineId);
  if (!line) {
    return [];
  }

  const client = await getAdminClient();
  const { data, error } = await client
    .from('ultaura_story_arcs')
    .select('*')
    .eq('line_id', lineId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false });

  if (error) {
    logger.error({ error, lineId }, 'Failed to fetch story arcs');
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    lineId: row.line_id,
    accountId: row.account_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    storyType: row.story_type,
    title: row.title,
    description: row.description || undefined,
    totalChapters: row.total_chapters,
    currentChapter: row.current_chapter,
    lastChapterAt: row.last_chapter_at || undefined,
    storyState: row.story_state || {},
    status: row.status,
  }));
}

export async function getSegmentEngagementStats(lineId: string): Promise<SegmentStats> {
  const line = await getAuthorizedLine(lineId);
  if (!line) {
    return {
      totalSegments: 0,
      byType: buildEmptySegmentStats(),
      preferredDomains: [],
      recentEngagement: [],
    };
  }

  const client = await getAdminClient();
  const cutoff = getWindowStartIso(line.timezone, WINDOW_DAYS);
  if (!cutoff) {
    return {
      totalSegments: 0,
      byType: buildEmptySegmentStats(),
      preferredDomains: [],
      recentEngagement: [],
    };
  }

  const { data, error } = await client
    .from('ultaura_segment_engagement')
    .select('*')
    .eq('line_id', lineId)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error({ error, lineId }, 'Failed to fetch segment engagement');
    return {
      totalSegments: 0,
      byType: buildEmptySegmentStats(),
      preferredDomains: [],
      recentEngagement: [],
    };
  }

  const segments = data || [];
  const byType = buildEmptySegmentStats();
  const domainCounts = new Map<string, number>();

  for (const segment of segments) {
    const type = segment.segment_type as SegmentType;
    if (!byType[type]) {
      byType[type] = { count: 0, enjoymentRate: 0, avgDuration: 0 };
    }

    byType[type].count += 1;
    if (segment.senior_response === 'enjoyed') {
      byType[type].enjoymentRate += 1;
    }
    if (typeof segment.duration_seconds === 'number') {
      byType[type].avgDuration += segment.duration_seconds;
    }

    if (segment.segment_domain) {
      domainCounts.set(
        segment.segment_domain,
        (domainCounts.get(segment.segment_domain) || 0) + 1
      );
    }
  }

  for (const type of Object.keys(byType) as SegmentType[]) {
    const entry = byType[type];
    if (!entry.count) {
      entry.enjoymentRate = 0;
      entry.avgDuration = 0;
      continue;
    }

    entry.enjoymentRate = Math.round((entry.enjoymentRate / entry.count) * 100);
    entry.avgDuration = Math.round(entry.avgDuration / entry.count);
  }

  const preferredDomains = Array.from(domainCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([domain]) => domain);

  const recentEngagement: SegmentEngagement[] = segments.slice(0, 10).map((row) => ({
    id: row.id,
    lineId: row.line_id,
    accountId: row.account_id,
    callSessionId: row.call_session_id,
    createdAt: row.created_at,
    segmentType: row.segment_type as SegmentType,
    segmentDomain: row.segment_domain || undefined,
    segmentContext: row.segment_context || undefined,
    durationSeconds: row.duration_seconds || undefined,
    completed: row.completed,
    engagementSignals: row.engagement_signals || undefined,
    seniorResponse: (row.senior_response as SegmentEngagement['seniorResponse']) || undefined,
  }));

  return {
    totalSegments: segments.length,
    byType,
    preferredDomains,
    recentEngagement,
  };
}

export async function getRetentionMetrics(lineId: string): Promise<RetentionMetrics> {
  const line = await getAuthorizedLine(lineId);
  if (!line) {
    return {
      callPreviewFollowThrough: 0,
      segmentCompletionRate: 0,
      preferredSegmentType: null,
      averageSegmentDuration: 0,
      inboundCallCount: 0,
      featureEnrollment: {
        callPreview: false,
        segments: false,
        stories: false,
      },
    };
  }

  const client = await getAdminClient();
  const cutoff = getWindowStartIso(line.timezone, WINDOW_DAYS);
  if (!cutoff) {
    return {
      callPreviewFollowThrough: 0,
      segmentCompletionRate: 0,
      preferredSegmentType: null,
      averageSegmentDuration: 0,
      inboundCallCount: 0,
      featureEnrollment: {
        callPreview: false,
        segments: false,
        stories: false,
      },
    };
  }

  const [previews, segments, inboundSessions, arcs] = await Promise.all([
    client
      .from('ultaura_call_previews')
      .select('followed_through, follow_through_response, created_at')
      .eq('line_id', lineId)
      .gte('created_at', cutoff),
    client
      .from('ultaura_segment_engagement')
      .select('completed, duration_seconds, senior_response, segment_type, created_at')
      .eq('line_id', lineId)
      .gte('created_at', cutoff),
    client
      .from('ultaura_call_sessions')
      .select('direction, is_test_call, created_at')
      .eq('line_id', lineId)
      .gte('created_at', cutoff),
    client
      .from('ultaura_story_arcs')
      .select('id, status')
      .eq('line_id', lineId)
      .eq('status', 'active'),
  ]);

  const previewRows = previews.data || [];
  const segmentRows = segments.data || [];
  const inboundRows = (inboundSessions.data || []).filter((row) => !row.is_test_call);
  const activeArcs = arcs.data || [];

  const previewOutcomes = previewRows.filter((row) => row.follow_through_response !== null);
  const previewEngaged = previewOutcomes.filter((row) => row.followed_through === true).length;
  const callPreviewFollowThrough = previewOutcomes.length
    ? Math.round((previewEngaged / previewOutcomes.length) * 100)
    : 0;

  const segmentTotal = segmentRows.length;
  const segmentCompleted = segmentRows.filter((row) => row.completed === true).length;
  const segmentCompletionRate = segmentTotal
    ? Math.round((segmentCompleted / segmentTotal) * 100)
    : 0;

  const durations = segmentRows
    .map((row) => row.duration_seconds)
    .filter((value): value is number => typeof value === 'number');
  const averageSegmentDuration = durations.length
    ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
    : 0;

  const preferredSegmentType = computePreferredSegmentType(segmentRows);
  const inboundCallCount = inboundRows.filter((row) => row.direction === 'inbound').length;

  return {
    callPreviewFollowThrough,
    segmentCompletionRate,
    preferredSegmentType,
    averageSegmentDuration,
    inboundCallCount,
    featureEnrollment: {
      callPreview: previewRows.length > 0,
      segments: segmentRows.length > 0,
      stories: activeArcs.length > 0,
    },
  };
}

function computePreferredSegmentType(
  rows: Array<{ segment_type: string; senior_response: string | null }>
): SegmentType | null {
  if (!rows.length) {
    return null;
  }

  const stats = new Map<SegmentType, { enjoyed: number; total: number }>();

  for (const row of rows) {
    const type = row.segment_type as SegmentType;
    if (!stats.has(type)) {
      stats.set(type, { enjoyed: 0, total: 0 });
    }
    const entry = stats.get(type)!;
    entry.total += 1;
    if (row.senior_response === 'enjoyed') {
      entry.enjoyed += 1;
    }
  }

  let preferred: SegmentType | null = null;
  let bestRate = -1;
  let bestCount = 0;

  stats.forEach((entry, type) => {
    const rate = entry.total ? entry.enjoyed / entry.total : 0;
    if (rate > bestRate || (rate === bestRate && entry.total > bestCount)) {
      preferred = type;
      bestRate = rate;
      bestCount = entry.total;
    }
  });

  return preferred;
}

function buildEmptySegmentStats(): SegmentStats['byType'] {
  return SEGMENT_TYPES.reduce((acc, type) => {
    acc[type] = { count: 0, enjoymentRate: 0, avgDuration: 0 };
    return acc;
  }, {} as SegmentStats['byType']);
}
