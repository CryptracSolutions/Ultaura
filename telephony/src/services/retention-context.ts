import { getSupabaseClient } from '../utils/supabase.js';
import { getPendingCallPreview, type CallPreview } from './call-preview.js';

export interface StoryArc {
  id: string;
  title: string;
  storyType: string;
  currentChapter: number;
  totalChapters: number;
  storyState: Record<string, unknown>;
}

export interface RetentionContext {
  pendingPreview: CallPreview | null;
  segmentPreferences: string | null;
  activeStoryArcs: StoryArc[];
}

const SEGMENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export async function buildRetentionContext(lineId: string): Promise<RetentionContext> {
  const supabase = getSupabaseClient();
  const pendingPreview = await getPendingCallPreview(lineId);

  const cutoff = new Date(Date.now() - SEGMENT_WINDOW_MS).toISOString();
  const { data: segments } = await supabase
    .from('ultaura_segment_engagement')
    .select('segment_type, senior_response, segment_domain')
    .eq('line_id', lineId)
    .gte('created_at', cutoff);

  const segmentPreferences = calculateSegmentPreferences(segments || []);

  const { data: arcs } = await supabase
    .from('ultaura_story_arcs')
    .select('id, title, story_type, current_chapter, total_chapters, story_state')
    .eq('line_id', lineId)
    .eq('status', 'active');

  return {
    pendingPreview,
    segmentPreferences,
    activeStoryArcs: (arcs || []).map((arc) => ({
      id: arc.id,
      title: arc.title,
      storyType: arc.story_type,
      currentChapter: arc.current_chapter,
      totalChapters: arc.total_chapters,
      storyState: arc.story_state || {},
    })),
  };
}

function calculateSegmentPreferences(
  segments: Array<{ segment_type: string; senior_response: string | null; segment_domain: string | null }>
): string | null {
  if (segments.length === 0) {
    return 'Segment preferences: No segment history yet. Offer segments gently.';
  }

  const stats = new Map<string, { enjoyed: number; total: number }>();
  const domainCounts = new Map<string, number>();

  for (const segment of segments) {
    const type = segment.segment_type || 'unknown';
    const entry = stats.get(type) || { enjoyed: 0, total: 0 };
    entry.total += 1;
    if (segment.senior_response === 'enjoyed') {
      entry.enjoyed += 1;
    }
    stats.set(type, entry);

    if (segment.segment_domain) {
      domainCounts.set(
        segment.segment_domain,
        (domainCounts.get(segment.segment_domain) || 0) + 1
      );
    }
  }

  const lines: string[] = [];
  for (const [type, data] of stats.entries()) {
    const rate = data.total ? Math.round((data.enjoyed / data.total) * 100) : 0;
    lines.push(`- ${type}: ${rate}% enjoyed (${data.total} total)`);
  }

  const preferredDomains = Array.from(domainCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([domain]) => domain);

  const domainLine = preferredDomains.length
    ? `Preferred domains: ${preferredDomains.join(', ')}`
    : 'Preferred domains: none yet.';

  return `Segment preferences:\n${lines.join('\n')}\n${domainLine}`;
}
