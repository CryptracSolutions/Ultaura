import { NextResponse } from 'next/server';

import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import getLogger from '~/core/logger';
import { parseOrganizationIdCookie } from '~/lib/server/cookies/organization.cookie';
import getCurrentOrganization from '~/lib/server/organizations/get-current-organization';
import { buildReminderSearchTokens, decryptReminderMessagesForLine, hashReminderQueryTokens } from '~/lib/ultaura/reminder-crypto';
import { DAYS_OF_WEEK, formatTime } from '~/lib/ultaura/constants';
import type { SearchCategory, SearchItem, SearchResponse } from '~/lib/search/types';
import { SEARCH_CATEGORIES } from '~/lib/search/types';
import { buildIntentBoostMap, getIntentBoost } from '~/lib/search/intent';
import { expandTokens, getMatchConfidence, scoreMatch, tokenizeText } from '~/lib/search/match';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const logger = getLogger();
const DECRYPTION_PLACEHOLDER = '[Unable to decrypt reminder]';
const MAX_QUERY_LENGTH = 100;
const SEARCH_ID_FALLBACK_PREFIX = 'search';
const SEARCH_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export async function GET(request: Request) {
  const searchId = createSearchId();
  const url = new URL(request.url);
  const rawQuery = url.searchParams.get('q') ?? '';
  const query = rawQuery.trim().slice(0, MAX_QUERY_LENGTH);
  const results = buildEmptyResults();

  if (query.length < 1) {
    return NextResponse.json(
      { query, results },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const queryTokens = expandTokens(tokenizeText(query, { minLength: 2, maxTokens: 12 }));
  const intentBoosts = buildIntentBoostMap(query);
  const rawType = url.searchParams.get('type') ?? '';
  const typeFilter = normalizeTypeFilter(rawType);

  const shouldFetchLines = !typeFilter || typeFilter === 'lines';
  const shouldFetchContacts = !typeFilter || typeFilter === 'contacts';
  const shouldFetchReminders = !typeFilter || typeFilter === 'reminders';
  const shouldFetchSchedules = !typeFilter || typeFilter === 'schedules';
  const shouldFetchCalls = !typeFilter || typeFilter === 'calls';
  const shouldFetchSafety = !typeFilter || typeFilter === 'safety_events';

  const supabase = getSupabaseRouteHandlerClient();
  const adminClient = getSupabaseRouteHandlerClient({ admin: true });

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const organizationUid = await parseOrganizationIdCookie(userData.user.id);
  if (!organizationUid) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 403 });
  }

  const { organization } = await getCurrentOrganization({
    organizationUid,
    userId: userData.user.id,
  });

  if (!organization) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 403 });
  }

  const { data: account, error: accountError } = await supabase
    .from('ultaura_accounts')
    .select('id')
    .eq('organization_id', organization.id)
    .single();

  if (accountError || !account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 403 });
  }

  const accountId = account.id;

  const hashedQueryTokens = shouldFetchReminders && queryTokens.length
    ? await hashReminderQueryTokens(adminClient, accountId, queryTokens)
    : [];

  const remindersQuery = shouldFetchReminders
    ? supabase
        .from('ultaura_reminders')
        .select(
          'id, line_id, message, message_ciphertext, message_iv, message_tag, due_at, created_at, search_tokens, ultaura_lines(display_name, short_id, created_at)'
        )
        .eq('account_id', accountId)
        .order('due_at', { ascending: false })
        .limit(50)
    : null;

  if (remindersQuery && hashedQueryTokens.length > 0) {
    remindersQuery.overlaps('search_tokens', hashedQueryTokens);
  }

  const emptyResponse = Promise.resolve({ data: [], error: null });

  const [
    linesResponse,
    contactsResponse,
    remindersResponse,
    schedulesResponse,
    callsResponse,
    safetyResponse,
  ] = await Promise.all([
    shouldFetchLines
      ? supabase
          .from('ultaura_lines')
          .select('id, display_name, phone_e164, short_id, created_at')
          .eq('account_id', accountId)
          .order('created_at', { ascending: false })
          .limit(50)
      : emptyResponse,
    shouldFetchContacts
      ? supabase
          .from('ultaura_trusted_contacts')
          .select('id, name, phone_e164, line_id, created_at, ultaura_lines(display_name, short_id)')
          .eq('account_id', accountId)
          .order('created_at', { ascending: false })
          .limit(50)
      : emptyResponse,
    remindersQuery ?? emptyResponse,
    shouldFetchSchedules
      ? supabase
          .from('ultaura_schedules')
          .select(
            'id, line_id, days_of_week, time_of_day, timezone, next_run_at, created_at, ultaura_lines(display_name, short_id)'
          )
          .eq('account_id', accountId)
          .order('next_run_at', { ascending: false })
          .limit(50)
      : emptyResponse,
    shouldFetchCalls
      ? supabase
          .from('ultaura_call_sessions')
          .select(
            'id, line_id, status, direction, twilio_from, twilio_to, created_at, ultaura_lines(display_name, short_id)'
          )
          .eq('account_id', accountId)
          .order('created_at', { ascending: false })
          .limit(50)
      : emptyResponse,
    shouldFetchSafety
      ? supabase
          .from('ultaura_safety_events')
          .select('id, line_id, tier, category, created_at, ultaura_lines(display_name, short_id)')
          .eq('account_id', accountId)
          .order('created_at', { ascending: false })
          .limit(50)
      : emptyResponse,
  ]);

  if (linesResponse.error) {
    logger.error({ error: linesResponse.error }, 'Search lines failed');
  } else {
    const lineIntentBoost = getIntentBoost(intentBoosts, 'lines');
    const matched = (linesResponse.data ?? [])
      .map((line) => {
        const freshness = formatSearchTimestamp(line.created_at);
        const ranking = rankQueryMatch(query, 'lines', [
          { reason: 'Matched in line name', value: line.display_name },
          { reason: 'Matched in line phone', value: line.phone_e164 },
          { reason: 'Matched in line ID', value: line.short_id },
        ], lineIntentBoost);

        if (!ranking) {
          return null;
        }

        return {
          id: line.id,
          label: line.display_name,
          subtitle: [line.phone_e164, freshness ? `Added ${freshness}` : null]
            .filter(Boolean)
            .join(' • '),
          href: `/dashboard/lines/${line.short_id}`,
          category: 'lines',
          timestamp: line.created_at,
          matchReason: ranking.reason,
          matchConfidence: ranking.confidence,
          matchScore: ranking.score,
        } as SearchItem;
      })
      .filter(Boolean) as SearchItem[];

    results.lines = sortAndTrimByRelevance(matched);
  }

  if (contactsResponse.error) {
    logger.error({ error: contactsResponse.error }, 'Search contacts failed');
  } else {
    const contactIntentBoost = getIntentBoost(intentBoosts, 'contacts');
    const matched = (contactsResponse.data ?? [])
      .map((contact) => {
        const line = contact.ultaura_lines as
          | { display_name: string; short_id: string }
          | null
          | undefined;
        const freshness = formatSearchTimestamp(contact.created_at);
        const subtitleParts = [
          contact.phone_e164,
          line?.display_name,
          freshness ? `Added ${freshness}` : null,
        ].filter(Boolean);
        const ranking = rankQueryMatch(query, 'contacts', [
          { reason: 'Matched in contact name', value: contact.name },
          { reason: 'Matched in contact phone', value: contact.phone_e164 },
          { reason: 'Matched in linked line name', value: line?.display_name },
          { reason: 'Matched in linked line ID', value: line?.short_id },
        ], contactIntentBoost);

        if (!ranking) {
          return null;
        }

        return {
          id: contact.id,
          label: contact.name,
          subtitle: subtitleParts.join(' • '),
          href: line?.short_id
            ? `/dashboard/lines/${line.short_id}/contacts`
            : '/dashboard/lines',
          category: 'contacts',
          timestamp: contact.created_at,
          matchReason: ranking.reason,
          matchConfidence: ranking.confidence,
          matchScore: ranking.score,
        } as SearchItem;
      })
      .filter(Boolean) as SearchItem[];

    results.contacts = sortAndTrimByRelevance(matched);
  }

  let reminderFallbackUsed = false;

  if (remindersResponse.error) {
    logger.error({ error: remindersResponse.error }, 'Search reminders failed');
  } else if (!shouldFetchReminders) {
    results.reminders = [];
  } else {
    const reminderIntentBoost = getIntentBoost(intentBoosts, 'reminders');
    let reminders = remindersResponse.data ?? [];

    if (hashedQueryTokens.length > 0 && reminders.length === 0) {
      const fallbackResponse = await supabase
        .from('ultaura_reminders')
        .select(
          'id, line_id, message, message_ciphertext, message_iv, message_tag, due_at, created_at, search_tokens, ultaura_lines(display_name, short_id, created_at)'
        )
        .eq('account_id', accountId)
        .order('due_at', { ascending: false })
        .limit(20);

      if (!fallbackResponse.error) {
        reminders = fallbackResponse.data ?? [];
        reminderFallbackUsed = true;
      } else {
        logger.error({ error: fallbackResponse.error }, 'Search reminders fallback failed');
      }
    }

    const byLine = new Map<string, typeof reminders>();
    const lineCreatedAtById = new Map<string, string | null>();

    reminders.forEach((reminder) => {
      const list = byLine.get(reminder.line_id) ?? [];
      list.push(reminder);
      byLine.set(reminder.line_id, list);

      const line = reminder.ultaura_lines as
        | { created_at?: string | null }
        | null
        | undefined;
      if (line?.created_at) {
        lineCreatedAtById.set(reminder.line_id, line.created_at);
      }
    });

    const decryptedMap = new Map<string, { message: string | null; decryptFailed: boolean }>();

    for (const [lineId, lineReminders] of Array.from(byLine.entries())) {
      try {
        const decrypted = await decryptReminderMessagesForLine(
          adminClient,
          accountId,
          lineId,
          lineReminders,
          lineCreatedAtById.get(lineId) ?? null
        );
        decrypted.forEach((entry) => decryptedMap.set(entry.id, entry));
      } catch (error) {
        logger.error({ error, lineId }, 'Failed to decrypt reminders in search');
        lineReminders.forEach((reminder) => {
          decryptedMap.set(reminder.id, {
            message: reminder.message ?? null,
            decryptFailed: Boolean(reminder.message_ciphertext),
          });
        });
      }
    }

    const matched: SearchItem[] = [];
    const remindersToBackfill: Array<{ id: string; tokens: string[] }> = [];

    for (const reminder of reminders) {
      const line = reminder.ultaura_lines as
        | { display_name: string; short_id: string }
        | null
        | undefined;
      const decrypted = decryptedMap.get(reminder.id);
      const message = decrypted?.message
        ? decrypted.message
        : decrypted?.decryptFailed
          ? DECRYPTION_PLACEHOLDER
          : reminder.message ?? DECRYPTION_PLACEHOLDER;

      if (
        (!reminder.search_tokens || reminder.search_tokens.length === 0) &&
        !decrypted?.decryptFailed &&
        message !== DECRYPTION_PLACEHOLDER
      ) {
        try {
          const tokens = await buildReminderSearchTokens(adminClient, accountId, message);
          if (tokens.length > 0) {
            remindersToBackfill.push({ id: reminder.id, tokens });
          }
        } catch (error) {
          logger.error({ error, reminderId: reminder.id }, 'Failed to backfill reminder search tokens');
        }
      }

      const ranking = rankQueryMatch(query, 'reminders', [
        { reason: 'Matched in reminder text', value: message },
        { reason: 'Matched in line name', value: line?.display_name },
      ], reminderIntentBoost);

      if (!ranking) {
        continue;
      }

      const reminderTime = formatSearchTimestamp(reminder.due_at ?? reminder.created_at);
      matched.push({
        id: reminder.id,
        label: message,
        subtitle: [line?.display_name ?? 'Line reminder', reminderTime ? `Due ${reminderTime}` : null]
          .filter(Boolean)
          .join(' • '),
        href: line?.short_id
          ? `/dashboard/reminders?line=${line.short_id}`
          : '/dashboard/reminders',
        category: 'reminders',
        timestamp: reminder.due_at ?? reminder.created_at,
        matchReason: ranking.reason,
        matchConfidence: ranking.confidence,
        matchScore: ranking.score,
      });
    }

    if (remindersToBackfill.length > 0) {
      await Promise.all(
        remindersToBackfill.map((entry) =>
          adminClient
            .from('ultaura_reminders')
            .update({ search_tokens: entry.tokens })
            .eq('id', entry.id)
            .then(({ error }) => {
              if (error) {
                logger.error({ error, reminderId: entry.id }, 'Failed to backfill reminder search tokens');
              }
            })
        )
      );
    }

    results.reminders = sortAndTrimByRelevance(matched);
  }

  if (schedulesResponse.error) {
    logger.error({ error: schedulesResponse.error }, 'Search schedules failed');
  } else {
    const scheduleIntentBoost = getIntentBoost(intentBoosts, 'schedules');
    const schedules = schedulesResponse.data ?? [];
    const matched = schedules
      .map((schedule) => {
        const line = schedule.ultaura_lines as
          | { display_name: string; short_id: string }
          | null
          | undefined;
        const summary = formatScheduleSummary({
          daysOfWeek: schedule.days_of_week,
          timeOfDay: schedule.time_of_day,
          timezone: schedule.timezone,
        });
        const nextRun = formatSearchTimestamp(schedule.next_run_at ?? schedule.created_at);
        const ranking = rankQueryMatch(query, 'schedules', [
          { reason: 'Matched in schedule details', value: summary },
          { reason: 'Matched in line name', value: line?.display_name },
          { reason: 'Matched in timezone', value: schedule.timezone },
        ], scheduleIntentBoost);

        if (!ranking) {
          return null;
        }

        return {
          id: schedule.id,
          label: summary,
          subtitle: [line?.display_name ?? 'Line schedule', nextRun ? `Next ${nextRun}` : null]
            .filter(Boolean)
            .join(' • '),
          href: line?.short_id
            ? `/dashboard/calls?line=${line.short_id}`
            : '/dashboard/calls',
          category: 'schedules',
          timestamp: schedule.next_run_at ?? schedule.created_at,
          matchReason: ranking.reason,
          matchConfidence: ranking.confidence,
          matchScore: ranking.score,
        } as SearchItem;
      })
      .filter(Boolean) as SearchItem[];

    results.schedules = sortAndTrimByRelevance(matched);
  }

  if (callsResponse.error) {
    logger.error({ error: callsResponse.error }, 'Search calls failed');
  } else {
    const callIntentBoost = getIntentBoost(intentBoosts, 'calls');
    const matched = (callsResponse.data ?? [])
      .map((call) => {
        const line = call.ultaura_lines as
          | { display_name: string; short_id: string }
          | null
          | undefined;
        const rawStatusLabel = call.status ? String(call.status) : '';
        const label = formatCallLabel(call.direction);
        const timestampLabel = formatSearchTimestamp(call.created_at);
        const ranking = rankQueryMatch(query, 'calls', [
          { reason: 'Matched in call status', value: rawStatusLabel },
          { reason: 'Matched in call direction', value: call.direction },
          { reason: 'Matched in line name', value: line?.display_name },
          { reason: 'Matched in phone number', value: `${call.twilio_from ?? ''} ${call.twilio_to ?? ''}` },
          { reason: 'Matched in call category', value: 'call calls phone dial' },
        ], callIntentBoost);

        if (!ranking) {
          return null;
        }

        return {
          groupKey: `${line?.short_id ?? line?.display_name ?? 'line'}::${label}::${timestampLabel ?? 'unknown'}`,
          item: {
            id: call.id,
            label,
            subtitle: [line?.display_name ?? 'Line', timestampLabel]
              .filter(Boolean)
              .join(' • '),
            href: line?.short_id
              ? `/dashboard/lines/${line.short_id}`
              : '/dashboard/lines',
            category: 'calls',
            timestamp: call.created_at,
            matchReason: ranking.reason,
            matchConfidence: ranking.confidence,
            matchScore: ranking.score,
          } as SearchItem,
        };
      })
      .filter(Boolean) as Array<{ groupKey: string; item: SearchItem }>;

    results.calls = sortAndTrimByRelevance(dedupeByGroup(matched));
  }

  if (safetyResponse.error) {
    logger.error({ error: safetyResponse.error }, 'Search safety events failed');
  } else {
    const safetyIntentBoost = getIntentBoost(intentBoosts, 'safety_events');
    const matched = (safetyResponse.data ?? [])
      .map((event) => {
        const line = event.ultaura_lines as
          | { display_name: string; short_id: string }
          | null
          | undefined;
        const rawTier = event.tier ? String(event.tier) : '';
        const rawCategory = event.category ? String(event.category) : '';
        const label = mapSafetyTierToCareLabel(rawTier);
        const timestampLabel = formatSearchTimestamp(event.created_at);
        const ranking = rankQueryMatch(query, 'safety_events', [
          { reason: 'Matched in safety tier', value: `${rawTier} ${label}` },
          { reason: 'Matched in safety category', value: rawCategory },
          { reason: 'Matched in line name', value: line?.display_name },
          { reason: 'Matched in safety category', value: 'safety alert concern wellness check in needs attention immediate attention' },
        ], safetyIntentBoost);

        if (!ranking) {
          return null;
        }

        return {
          groupKey: `${line?.short_id ?? line?.display_name ?? 'line'}::${label}::${timestampLabel ?? 'unknown'}`,
          item: {
            id: event.id,
            label,
            subtitle: [line?.display_name ?? 'Line', timestampLabel]
              .filter(Boolean)
              .join(' • '),
            href: line?.short_id
              ? `/dashboard/insights/${line.short_id}/safety`
              : '/dashboard/insights',
            category: 'safety_events',
            timestamp: event.created_at,
            matchReason: ranking.reason,
            matchConfidence: ranking.confidence,
            matchScore: ranking.score,
          } as SearchItem,
        };
      })
      .filter(Boolean) as Array<{ groupKey: string; item: SearchItem }>;

    results.safety_events = sortAndTrimByRelevance(dedupeByGroup(matched));
  }

  const totalResults = countTotalResults(results);

  logger.info(
    {
      searchId,
      queryLength: query.length,
      queryTokenCount: queryTokens.length,
      hashedTokenCount: hashedQueryTokens.length,
      typeFilter,
      intentBoosts,
      results: {
        lines: results.lines.length,
        reminders: results.reminders.length,
        schedules: results.schedules.length,
        contacts: results.contacts.length,
        calls: results.calls.length,
        safetyEvents: results.safety_events.length,
      },
      totalResults,
      zeroResults: totalResults === 0,
      reminderFallbackUsed,
    },
    'Search query completed'
  );

  return NextResponse.json(
    { query, results, searchId },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

function buildEmptyResults(): SearchResponse['results'] {
  return SEARCH_CATEGORIES.reduce((acc, category) => {
    acc[category] = [];
    return acc;
  }, {} as SearchResponse['results']);
}

function createSearchId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) {
    return uuid;
  }

  return `${SEARCH_ID_FALLBACK_PREFIX}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function countTotalResults(results: SearchResponse['results']): number {
  return SEARCH_CATEGORIES.reduce((total, category) => total + results[category].length, 0);
}

function sortAndTrimByRelevance(items: SearchItem[]): SearchItem[] {
  return [...items]
    .sort(
      (a, b) =>
        (b.matchScore ?? 0) - (a.matchScore ?? 0) ||
        (b.timestamp ?? '').localeCompare(a.timestamp ?? '')
    )
    .slice(0, 10);
}

function dedupeByGroup(entries: Array<{ groupKey: string; item: SearchItem }>): SearchItem[] {
  const byGroup = new Map<string, SearchItem[]>();

  entries.forEach((entry) => {
    const list = byGroup.get(entry.groupKey) ?? [];
    list.push(entry.item);
    byGroup.set(entry.groupKey, list);
  });

  const deduped: SearchItem[] = [];

  byGroup.forEach((group) => {
    const sorted = [...group].sort(
      (a, b) =>
        (b.matchScore ?? 0) - (a.matchScore ?? 0) ||
        (b.timestamp ?? '').localeCompare(a.timestamp ?? '')
    );
    const primary = sorted[0];

    if (sorted.length === 1) {
      deduped.push(primary);
      return;
    }

    deduped.push(primary);
  });

  return deduped;
}

function rankQueryMatch(
  query: string,
  category: SearchCategory,
  fields: Array<{ reason: string; value: string | null | undefined }>,
  intentBoost: number
): { score: number; reason: string; confidence: 'high' | 'medium' | 'low' } | null {
  let topScore = 0;
  let topReason = 'Matched in search text';

  fields.forEach((field) => {
    if (!field.value) {
      return;
    }

    const fieldScore = scoreMatch(query, field.value);
    if (fieldScore > topScore) {
      topScore = fieldScore;
      topReason = field.reason;
    }
  });

  if (topScore <= 0) {
    return null;
  }

  const score = topScore + intentBoost;
  const minScore = getMinimumScoreForCategory(query, category);
  if (score < minScore) {
    return null;
  }

  return {
    score,
    reason: topReason,
    confidence: getMatchConfidence(score),
  };
}

function getMinimumScoreForCategory(query: string, category: SearchCategory): number {
  const baseThresholds: Record<SearchCategory, number> = {
    navigation: 0,
    documentation: 0,
    lines: 4.5,
    reminders: 4,
    schedules: 4,
    contacts: 4.5,
    calls: 4,
    safety_events: 4,
  };

  const tokenCount = tokenizeText(query, { minLength: 2, maxTokens: 12 }).length;
  const queryLength = query.trim().length;
  const shortQueryPenalty = queryLength <= 2 ? 2 : tokenCount <= 1 ? 1 : 0;

  return baseThresholds[category] + shortQueryPenalty;
}

function formatSearchTimestamp(timestamp: string | null | undefined): string | null {
  if (!timestamp) return null;
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return null;
  return SEARCH_TIMESTAMP_FORMATTER.format(parsed);
}

function formatCallLabel(direction: string | null): string {
  if (direction === 'outbound') return 'Outgoing call';
  if (direction === 'inbound') return 'Incoming call';
  return 'Call';
}

function mapSafetyTierToCareLabel(rawTier: string): string {
  const normalized = rawTier.trim().toLowerCase();
  if (normalized === 'low') return 'Check in';
  if (normalized === 'high' || normalized === 'critical' || normalized === 'urgent') {
    return 'Immediate attention';
  }
  return 'Needs attention';
}

function formatScheduleSummary(options: {
  daysOfWeek: number[] | null;
  timeOfDay: string | null;
  timezone: string | null;
}): string {
  const days = options.daysOfWeek ?? [];
  const dayLabel =
    days.length > 0
      ? days
          .map((value) => DAYS_OF_WEEK.find((day) => day.value === value)?.short)
          .filter(Boolean)
          .join(', ')
      : 'One-time';
  const timeLabel = options.timeOfDay ? formatTime(options.timeOfDay) : 'Any time';
  const timezone = options.timezone ? ` (${options.timezone})` : '';

  return `${dayLabel} · ${timeLabel}${timezone}`;
}

function normalizeTypeFilter(raw: string | null): string | null {
  if (!raw) return null;
  const token = raw.trim().toLowerCase();
  if (token === 'lines') return 'lines';
  if (token === 'reminders') return 'reminders';
  if (token === 'calls') return 'calls';
  if (token === 'safety_events') return 'safety_events';
  return null;
}
