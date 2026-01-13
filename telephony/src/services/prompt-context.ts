import { DateTime } from 'luxon';
import type { StoryArc } from './retention-context.js';
import { getSupabaseClient, type LineRow } from '../utils/supabase.js';
import { decryptInsights } from '../utils/insights-crypto.js';
import { decryptLifeChapterNarrative } from '../utils/life-chapter-crypto.js';
import { logger } from '../utils/logger.js';

const TOPIC_LABELS: Record<string, string> = {
  family: 'Family',
  friends: 'Friends',
  activities: 'Activities',
  interests: 'Interests',
  memories: 'Memories',
  plans: 'Plans',
  daily_life: 'Daily Life',
  entertainment: 'Entertainment',
  feelings: 'Feelings',
  requests: 'Requests',
};

function sanitizePromptValue(value: string, maxLength: number = 140): string {
  return value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/[`]/g, '')
    .replace(/\b(system|assistant|user)\s*:/gi, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLength);
}

function formatList(items: string[] | null | undefined, fallback: string): string {
  const cleaned = (items ?? [])
    .map((item) => sanitizePromptValue(item))
    .filter(Boolean);
  return cleaned.length ? cleaned.join(', ') : fallback;
}

function formatDecade(value?: number | null): string {
  if (!value || !Number.isFinite(value)) {
    return 'Unknown';
  }
  return String(value);
}

function formatEngagement(score: number): string {
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

function formatTimeOfDay(now: DateTime): 'morning' | 'afternoon' | 'evening' {
  if (now.hour < 12) return 'morning';
  if (now.hour < 17) return 'afternoon';
  return 'evening';
}

function formatRelationshipLine(options: {
  name: string;
  role: string;
  sentiment?: string | null;
  contactFrequency?: string | null;
  location?: string | null;
  sharedActivities?: string[] | null;
}): string {
  const parts = [
    options.role,
    options.sentiment ? `${options.sentiment} sentiment` : null,
    options.contactFrequency ? `${options.contactFrequency} contact` : null,
    options.location ? `near ${options.location}` : null,
  ].filter(Boolean);

  const activity = options.sharedActivities?.length
    ? `Shared: ${options.sharedActivities.slice(0, 2).map((item) => sanitizePromptValue(item)).join(', ')}`
    : null;

  const description = parts.length ? ` (${parts.join(', ')})` : '';
  const activityNote = activity ? ` ${activity}` : '';
  return `- ${sanitizePromptValue(options.name)}${description}${activityNote}`;
}

function formatMilestoneLine(title: string, type: string, person?: string | null): string {
  const cleanTitle = sanitizePromptValue(title);
  const cleanType = sanitizePromptValue(type);
  const personNote = person ? ` for ${sanitizePromptValue(person)}` : '';
  return `- ${cleanTitle} (${cleanType}${personNote})`;
}

function formatCallSummary(options: {
  occurredAt: string;
  topics: string[];
  mood?: string | null;
  engagement: string;
}): string {
  const dateLabel = DateTime.fromISO(options.occurredAt).toFormat('MMM d');
  const topicsLabel = options.topics.length ? options.topics.join(', ') : 'General chat';
  const moodLabel = options.mood ? `Mood: ${options.mood}` : 'Mood: unknown';
  return `- ${dateLabel}: Topics: ${topicsLabel}. ${moodLabel}. Engagement: ${options.engagement}.`;
}

export async function buildPromptPlaceholders(options: {
  accountId: string;
  line: LineRow;
  activeStoryArcs?: StoryArc[];
}): Promise<Record<string, string>> {
  const supabase = getSupabaseClient();
  const now = DateTime.now().setZone(options.line.timezone);
  const currentTimeOfDay = formatTimeOfDay(now);
  const currentDayOfWeek = now.toFormat('cccc');

  const [
    lifeChaptersRows,
    relationshipsRows,
    contentPrefsRow,
    accessibilityRow,
    personaRow,
    dailyRhythmRow,
    milestonesRows,
    insightsRows,
  ] = await Promise.all([
    supabase
      .from('ultaura_life_chapters')
      .select('id, title, chapter_type, era_start_year, era_end_year, location, narrative_ciphertext, narrative_iv, narrative_tag, key_people, emotional_tone, updated_at')
      .eq('line_id', options.line.id)
      .order('updated_at', { ascending: false })
      .limit(6),
    supabase
      .from('ultaura_relationships')
      .select('name, relation_type, relation_role, contact_frequency, sentiment, location, shared_activities, is_deceased, passed_at, grief_sensitivity, updated_at, times_mentioned')
      .eq('line_id', options.line.id)
      .order('times_mentioned', { ascending: false })
      .limit(20),
    supabase
      .from('ultaura_content_preferences')
      .select('*')
      .eq('line_id', options.line.id)
      .maybeSingle(),
    supabase
      .from('ultaura_accessibility_settings')
      .select('*')
      .eq('line_id', options.line.id)
      .maybeSingle(),
    supabase
      .from('ultaura_persona_adaptations')
      .select('*')
      .eq('line_id', options.line.id)
      .maybeSingle(),
    supabase
      .from('ultaura_daily_rhythms')
      .select('*')
      .eq('line_id', options.line.id)
      .maybeSingle(),
    supabase
      .from('ultaura_milestones')
      .select('title, milestone_type, date_month, date_day, date_year, is_recurring, related_person_name')
      .eq('line_id', options.line.id),
    supabase
      .from('ultaura_call_insights')
      .select('call_session_id, created_at, insights_ciphertext, insights_iv, insights_tag')
      .eq('line_id', options.line.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const lifeChapters: Array<{
    title: string;
    chapterType: string;
    eraLabel: string;
    location: string | null;
    narrative: string;
    keyPeople: string[];
  }> = [];

  for (const row of lifeChaptersRows.data ?? []) {
    try {
      const narrative = await decryptLifeChapterNarrative(
        options.accountId,
        options.line.id,
        row.id,
        {
          ciphertext: row.narrative_ciphertext,
          iv: row.narrative_iv,
          tag: row.narrative_tag,
        }
      );

      const eraLabel = [
        row.era_start_year ? `${row.era_start_year}` : null,
        row.era_end_year ? `${row.era_end_year}` : null,
      ].filter(Boolean).join('-');

      lifeChapters.push({
        title: row.title,
        chapterType: row.chapter_type,
        eraLabel,
        location: row.location ?? null,
        narrative,
        keyPeople: row.key_people ?? [],
      });
    } catch (error) {
      logger.warn({ error, chapterId: row.id }, 'Failed to decrypt life chapter narrative');
    }
  }

  const lifeChaptersFormatted = lifeChapters.length
    ? lifeChapters.map((chapter) => {
        const parts = [
          chapter.eraLabel ? `Era: ${chapter.eraLabel}` : null,
          chapter.location ? `Location: ${sanitizePromptValue(chapter.location)}` : null,
        ].filter(Boolean);
        const narrative = chapter.narrative ? sanitizePromptValue(chapter.narrative, 160) : 'Story shared.';
        const keyPeople = chapter.keyPeople.length
          ? `Key people: ${chapter.keyPeople.slice(0, 3).map((person) => sanitizePromptValue(person)).join(', ')}`
          : null;
        return `- ${sanitizePromptValue(chapter.title)}${parts.length ? ` (${parts.join(', ')})` : ''}: ${narrative}${keyPeople ? ` ${keyPeople}` : ''}`;
      }).join('\n')
    : '- No life chapters recorded yet.';

  const lifeChaptersCompressed = lifeChapters.length
    ? lifeChapters.map((chapter) => sanitizePromptValue(chapter.title)).join(', ')
    : 'None yet.';

  const relationships = relationshipsRows.data ?? [];
  const familyRelationships = relationships.filter(
    (rel) => !rel.is_deceased && rel.relation_type === 'family'
  );
  const friendRelationships = relationships.filter(
    (rel) => !rel.is_deceased && rel.relation_type !== 'family'
  );
  const deceasedRelationships = relationships.filter((rel) => rel.is_deceased);

  const familyRelationshipsFormatted = familyRelationships.length
    ? familyRelationships.map((rel) => formatRelationshipLine({
        name: rel.name,
        role: rel.relation_role,
        sentiment: rel.sentiment,
        contactFrequency: rel.contact_frequency,
        location: rel.location,
        sharedActivities: rel.shared_activities,
      })).join('\n')
    : '- No family relationships recorded yet.';

  const friendRelationshipsFormatted = friendRelationships.length
    ? friendRelationships.map((rel) => formatRelationshipLine({
        name: rel.name,
        role: rel.relation_role,
        sentiment: rel.sentiment,
        contactFrequency: rel.contact_frequency,
        location: rel.location,
        sharedActivities: rel.shared_activities,
      })).join('\n')
    : '- No friends or community relationships recorded yet.';

  const deceasedRelationshipsFormatted = deceasedRelationships.length
    ? deceasedRelationships.map((rel) => formatRelationshipLine({
        name: rel.name,
        role: rel.relation_role,
        sentiment: rel.sentiment,
        contactFrequency: rel.contact_frequency,
        location: rel.location,
        sharedActivities: rel.shared_activities,
      })).join('\n')
    : '- None noted.';

  const deceasedRelationshipsWithContext = deceasedRelationships.length
    ? deceasedRelationships.map((rel) => {
        const parts = [
          rel.passed_at ? `passed ${DateTime.fromISO(rel.passed_at).year}` : null,
          rel.grief_sensitivity ? `sensitivity ${rel.grief_sensitivity}` : null,
        ].filter(Boolean);
        return `- ${sanitizePromptValue(rel.name)} (${sanitizePromptValue(rel.relation_role)})${parts.length ? ` - ${parts.join(', ')}` : ''}`;
      }).join('\n')
    : '- None noted.';

  const familyCompressed = familyRelationships.length
    ? familyRelationships.map((rel) => sanitizePromptValue(rel.name)).join(', ')
    : 'None.';
  const friendsCompressed = friendRelationships.length
    ? friendRelationships.map((rel) => sanitizePromptValue(rel.name)).join(', ')
    : 'None.';
  const deceasedCompressed = deceasedRelationships.length
    ? deceasedRelationships.map((rel) => sanitizePromptValue(rel.name)).join(', ')
    : 'None.';

  const contentPrefs = contentPrefsRow.data;
  const favoriteTriviaDomains = formatList(
    contentPrefs?.favorite_trivia_domains ?? options.line.seed_interests ?? [],
    'general interests'
  );
  const favoriteStoryGenres = formatList(
    contentPrefs?.favorite_story_genres ?? [],
    'classic, heartwarming'
  );
  const favoriteMemoryTopics = formatList(
    contentPrefs?.favorite_memory_topics ?? options.line.seed_interests ?? [],
    'family, hometown, hobbies'
  );
  const favoriteEras = formatList(
    contentPrefs?.favorite_eras ?? [],
    `${formatDecade(options.line.birth_decade)}s, ${formatDecade(options.line.formative_decade)}s`
  );
  const triviaDifficulty = sanitizePromptValue(contentPrefs?.trivia_difficulty ?? 'medium');

  const eraSetting = contentPrefs?.favorite_eras?.length
    ? formatList(contentPrefs.favorite_eras, 'their formative years')
    : `${formatDecade(options.line.birth_decade)}s-${formatDecade(options.line.formative_decade)}s`;

  const activeStoryArcsFormatted = options.activeStoryArcs?.length
    ? options.activeStoryArcs
        .map((arc) => `- "${sanitizePromptValue(arc.title)}" (${arc.storyType}): Chapter ${arc.currentChapter}/${arc.totalChapters}`)
        .join('\n')
    : '- No active story arcs.';

  const accessibility = accessibilityRow.data;
  const hearingMode = sanitizePromptValue(accessibility?.hearing_mode ?? 'normal');
  const speechRate = String(accessibility?.speech_rate ?? 1.0);
  const cognitiveMode = sanitizePromptValue(accessibility?.cognitive_mode ?? 'normal');
  const contextWindowCalls = String(accessibility?.context_window_calls ?? 10);

  const persona = personaRow.data;
  const formalityLevel = sanitizePromptValue(persona?.formality_level ?? 'warm');
  const humorLevel = sanitizePromptValue(persona?.humor_level ?? 'light');
  const directnessLevel = sanitizePromptValue(persona?.directness_level ?? 'balanced');
  const vocabularyComplexity = sanitizePromptValue(persona?.vocabulary_complexity ?? 'standard');
  const preferredPhrases = formatList(persona?.preferred_phrases ?? [], 'None noted');
  const avoidedPhrases = formatList(persona?.avoided_phrases ?? [], 'None noted');
  const regionalExpressions = formatList(persona?.regional_expressions ?? [], 'None noted');
  const typicalEnergy = sanitizePromptValue(persona?.typical_energy ?? 'moderate');

  const timeSpecificEnergy = (() => {
    if (!persona) return typicalEnergy;
    if (currentTimeOfDay === 'morning' && persona.morning_energy) return persona.morning_energy;
    if (currentTimeOfDay === 'afternoon' && persona.afternoon_energy) return persona.afternoon_energy;
    if (currentTimeOfDay === 'evening' && persona.evening_energy) return persona.evening_energy;
    return persona.typical_energy ?? typicalEnergy;
  })();

  const dailyRhythm = dailyRhythmRow.data;
  const morningRoutineSummary = sanitizePromptValue(dailyRhythm?.morning_routine_summary ?? 'No routine noted yet');
  const afternoonRoutineSummary = sanitizePromptValue(dailyRhythm?.afternoon_routine_summary ?? 'No routine noted yet');
  const eveningRoutineSummary = sanitizePromptValue(dailyRhythm?.evening_routine_summary ?? 'No routine noted yet');
  const expectedEnergyNow = (() => {
    if (!dailyRhythm) return typicalEnergy;
    if (currentTimeOfDay === 'morning' && dailyRhythm.morning_energy) return dailyRhythm.morning_energy;
    if (currentTimeOfDay === 'afternoon' && dailyRhythm.afternoon_energy) return dailyRhythm.afternoon_energy;
    if (currentTimeOfDay === 'evening' && dailyRhythm.evening_energy) return dailyRhythm.evening_energy;
    return typicalEnergy;
  })();

  const milestones = milestonesRows.data ?? [];
  const todayMilestones = milestones.filter(
    (milestone) => milestone.date_month === now.month && milestone.date_day === now.day
  );

  const todayMilestonesFormatted = todayMilestones.length
    ? todayMilestones
        .map((milestone) =>
          formatMilestoneLine(milestone.title, milestone.milestone_type, milestone.related_person_name)
        )
        .join('\n')
    : '- None today.';

  const upcomingMilestones = milestones
    .map((milestone) => {
      if (!milestone.is_recurring && milestone.date_year && milestone.date_year < now.year) {
        return null;
      }
      const baseYear = milestone.is_recurring ? now.year : (milestone.date_year ?? now.year);
      let date = DateTime.fromObject(
      {
        year: baseYear,
        month: milestone.date_month,
        day: milestone.date_day,
      },
      { zone: options.line.timezone }
    );
      if (date < now.startOf('day')) {
        date = date.plus({ years: 1 });
      }
      return { milestone, date };
    })
    .filter((entry): entry is { milestone: typeof milestones[number]; date: DateTime } => Boolean(entry))
    .sort((a, b) => a.date.toMillis() - b.date.toMillis())
    .slice(0, 3);

  const upcomingMilestonesFormatted = upcomingMilestones.length
    ? upcomingMilestones
        .map(({ milestone, date }) =>
          `${formatMilestoneLine(milestone.title, milestone.milestone_type, milestone.related_person_name)} on ${date.toFormat('MMM d')}`
        )
        .join('\n')
    : '- No upcoming milestones yet.';

  const insightsRowsData = insightsRows.data ?? [];
  const recentCallSummaries: Array<{
    occurredAt: string;
    topics: string[];
    mood: string | null;
    engagement: string;
  }> = [];

  for (const row of insightsRowsData) {
    try {
      const insights = await decryptInsights(
        options.accountId,
        options.line.id,
        row.call_session_id,
        {
          ciphertext: row.insights_ciphertext,
          iv: row.insights_iv,
          tag: row.insights_tag,
        }
      );

      const topics = (insights.topics ?? [])
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 2)
        .map((topic) => TOPIC_LABELS[topic.code] ?? topic.code);

      recentCallSummaries.push({
        occurredAt: row.created_at,
        topics,
        mood: insights.mood_overall ?? null,
        engagement: formatEngagement(insights.engagement_score ?? 0),
      });
    } catch (error) {
      logger.warn({ error, callSessionId: row.call_session_id }, 'Failed to decrypt call insights');
    }
  }

  const recentCallsFormatted = recentCallSummaries.length
    ? recentCallSummaries.map((summary) => formatCallSummary(summary)).join('\n')
    : '- No recent call summaries yet.';

  const recentCallsCompressed = recentCallSummaries.length
    ? recentCallSummaries
        .slice(0, 3)
        .map((summary) => {
          const dateLabel = DateTime.fromISO(summary.occurredAt).toFormat('MMM d');
          const topic = summary.topics[0] ?? 'General';
          return `${dateLabel} ${topic}/${summary.engagement}`;
        })
        .join('; ')
    : 'None yet.';

  const lastCallTopicsSummary = recentCallSummaries.length
    ? recentCallSummaries[0].topics.join(', ') || 'general conversation'
    : 'general conversation';

  return {
    birthDecade: formatDecade(options.line.birth_decade),
    formativeDecade: formatDecade(options.line.formative_decade),
    hometown: sanitizePromptValue(options.line.hometown ?? 'Unknown'),
    currentLocation: sanitizePromptValue(options.line.current_location ?? 'Unknown'),
    lifeChaptersFormatted,
    lifeChaptersCompressed,
    favoriteTriviaDomains,
    triviaDifficulty,
    eraSetting,
    favoriteStoryGenres,
    favoriteMemoryTopics,
    favoriteEras,
    activeStoryArcsFormatted,
    familyRelationshipsFormatted,
    friendRelationshipsFormatted,
    deceasedRelationshipsFormatted,
    familyCompressed,
    friendsCompressed,
    deceasedCompressed,
    deceasedRelationshipsWithContext,
    hearingMode,
    speechRate,
    cognitiveMode,
    contextWindowCalls,
    lastCallTopicsSummary,
    formalityLevel,
    humorLevel,
    directnessLevel,
    vocabularyComplexity,
    preferredPhrases,
    avoidedPhrases,
    regionalExpressions,
    typicalEnergy,
    timeSpecificEnergy: sanitizePromptValue(timeSpecificEnergy),
    currentTimeOfDay,
    currentDayOfWeek,
    expectedEnergyNow: sanitizePromptValue(expectedEnergyNow),
    morningRoutineSummary,
    afternoonRoutineSummary,
    eveningRoutineSummary,
    todayMilestonesFormatted,
    upcomingMilestonesFormatted,
    interruptionTolerance: sanitizePromptValue(options.line.interruption_tolerance ?? 'normal'),
    fillerWordPatience: sanitizePromptValue(options.line.filler_word_patience ?? 'normal'),
    silenceToleranceMs: String(options.line.silence_tolerance_ms ?? 2000),
    crosstalkRecoveryMode: sanitizePromptValue(options.line.crosstalk_recovery_mode ?? 'patient'),
    recentCallCount: String(recentCallSummaries.length),
    recentCallsFormatted,
    recentCallsCompressed,
  };
}
