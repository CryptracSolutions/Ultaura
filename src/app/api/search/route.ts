import { NextResponse } from 'next/server';

import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import getLogger from '~/core/logger';
import { parseOrganizationIdCookie } from '~/lib/server/cookies/organization.cookie';
import getCurrentOrganization from '~/lib/server/organizations/get-current-organization';
import { getUltauraAccount } from '~/lib/ultaura/accounts';
import { decryptReminderMessagesForLine } from '~/lib/ultaura/reminder-crypto';
import { DAYS_OF_WEEK, formatTime } from '~/lib/ultaura/constants';
import type { SearchItem, SearchResponse } from '~/lib/search/types';
import { SEARCH_CATEGORIES } from '~/lib/search/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const logger = getLogger();
const DECRYPTION_PLACEHOLDER = '[Unable to decrypt reminder]';
const MAX_QUERY_LENGTH = 100;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawQuery = url.searchParams.get('q') ?? '';
  const query = rawQuery.trim().slice(0, MAX_QUERY_LENGTH);
  const results = buildEmptyResults();

  if (query.length < 2) {
    return NextResponse.json(
      { query, results },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const supabase = getSupabaseServerComponentClient();
  const adminClient = getSupabaseServerComponentClient({ admin: true });

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

  const account = await getUltauraAccount(organization.id);
  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 403 });
  }

  const accountId = account.id;

  const [
    linesResponse,
    contactsResponse,
    remindersResponse,
    schedulesResponse,
    callsResponse,
    safetyResponse,
  ] = await Promise.all([
    supabase
      .from('ultaura_lines')
      .select('id, display_name, phone_e164, short_id, created_at')
      .eq('account_id', accountId)
      .or(`display_name.ilike.%${query}%,phone_e164.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('ultaura_trusted_contacts')
      .select('id, name, phone_e164, line_id, created_at, ultaura_lines(display_name, short_id)')
      .eq('account_id', accountId)
      .or(`name.ilike.%${query}%,phone_e164.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('ultaura_reminders')
      .select(
        'id, line_id, message, message_ciphertext, message_iv, message_tag, due_at, created_at, ultaura_lines(display_name, short_id, created_at)'
      )
      .eq('account_id', accountId)
      .order('due_at', { ascending: false })
      .limit(50),
    supabase
      .from('ultaura_schedules')
      .select(
        'id, line_id, days_of_week, time_of_day, timezone, next_run_at, created_at, ultaura_lines(display_name, short_id)'
      )
      .eq('account_id', accountId)
      .order('next_run_at', { ascending: false })
      .limit(50),
    supabase
      .from('ultaura_call_sessions')
      .select(
        'id, line_id, status, direction, twilio_from, twilio_to, created_at, ultaura_lines(display_name, short_id)'
      )
      .eq('account_id', accountId)
      .or(
        `status.ilike.%${query}%,direction.ilike.%${query}%,twilio_from.ilike.%${query}%,twilio_to.ilike.%${query}%`
      )
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('ultaura_safety_events')
      .select('id, line_id, tier, category, created_at, ultaura_lines(display_name, short_id)')
      .eq('account_id', accountId)
      .or(`tier.ilike.%${query}%,category.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  if (linesResponse.error) {
    logger.error({ error: linesResponse.error }, 'Search lines failed');
  } else {
    results.lines = (linesResponse.data ?? []).map((line) => ({
      id: line.id,
      label: line.display_name,
      subtitle: line.phone_e164,
      href: `/dashboard/lines/${line.short_id}`,
      category: 'lines',
      timestamp: line.created_at,
    }));
  }

  if (contactsResponse.error) {
    logger.error({ error: contactsResponse.error }, 'Search contacts failed');
  } else {
    results.contacts = (contactsResponse.data ?? []).map((contact) => {
      const line = contact.ultaura_lines as
        | { display_name: string; short_id: string }
        | null
        | undefined;
      const subtitleParts = [contact.phone_e164, line?.display_name].filter(Boolean);

      return {
        id: contact.id,
        label: contact.name,
        subtitle: subtitleParts.join(' • '),
        href: line?.short_id
          ? `/dashboard/lines/${line.short_id}/contacts`
          : '/dashboard/lines',
        category: 'contacts',
        timestamp: contact.created_at,
      } as SearchItem;
    });
  }

  if (remindersResponse.error) {
    logger.error({ error: remindersResponse.error }, 'Search reminders failed');
  } else {
    const reminders = remindersResponse.data ?? [];
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

    reminders.forEach((reminder) => {
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
      const haystack = [message, line?.display_name].filter(Boolean).join(' ');
      if (!matchesQuery(query, haystack)) {
        return;
      }

      matched.push({
        id: reminder.id,
        label: message,
        subtitle: line?.display_name ?? 'Line reminder',
        href: line?.short_id
          ? `/dashboard/lines/${line.short_id}/reminders`
          : '/dashboard/reminders',
        category: 'reminders',
        timestamp: reminder.due_at ?? reminder.created_at,
      });
    });

    results.reminders = matched
      .sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''))
      .slice(0, 5);
  }

  if (schedulesResponse.error) {
    logger.error({ error: schedulesResponse.error }, 'Search schedules failed');
  } else {
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
        const haystack = [summary, line?.display_name, schedule.timezone]
          .filter(Boolean)
          .join(' ');

        if (!matchesQuery(query, haystack)) {
          return null;
        }

        return {
          id: schedule.id,
          label: summary,
          subtitle: line?.display_name ?? 'Line schedule',
          href: line?.short_id
            ? `/dashboard/lines/${line.short_id}/schedule`
            : '/dashboard/calls',
          category: 'schedules',
          timestamp: schedule.next_run_at ?? schedule.created_at,
        } as SearchItem;
      })
      .filter(Boolean) as SearchItem[];

    results.schedules = matched
      .sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''))
      .slice(0, 5);
  }

  if (callsResponse.error) {
    logger.error({ error: callsResponse.error }, 'Search calls failed');
  } else {
    results.calls = (callsResponse.data ?? []).map((call) => {
      const line = call.ultaura_lines as
        | { display_name: string; short_id: string }
        | null
        | undefined;
      const directionLabel = call.direction === 'outbound' ? 'Outbound' : 'Inbound';
      const label = `${directionLabel} call (${call.status})`;
      const subtitleParts = [line?.display_name, call.twilio_to ?? call.twilio_from].filter(Boolean);

      return {
        id: call.id,
        label,
        subtitle: subtitleParts.join(' • '),
        href: line?.short_id
          ? `/dashboard/lines/${line.short_id}`
          : '/dashboard/lines',
        category: 'calls',
        timestamp: call.created_at,
      } as SearchItem;
    });
  }

  if (safetyResponse.error) {
    logger.error({ error: safetyResponse.error }, 'Search safety events failed');
  } else {
    results.safety_events = (safetyResponse.data ?? []).map((event) => {
      const line = event.ultaura_lines as
        | { display_name: string; short_id: string }
        | null
        | undefined;
      const tierLabel = event.tier ? `${event.tier} tier` : 'Safety';
      const categoryLabel = event.category ? `${event.category}` : 'event';
      const label = `${tierLabel} ${categoryLabel}`;

      return {
        id: event.id,
        label,
        subtitle: line?.display_name ?? 'Line safety event',
        href: line?.short_id
          ? `/dashboard/insights/${line.short_id}/safety`
          : '/dashboard/insights',
        category: 'safety_events',
        timestamp: event.created_at,
      } as SearchItem;
    });
  }

  logger.info(
    {
      queryLength: query.length,
      results: {
        lines: results.lines.length,
        reminders: results.reminders.length,
        schedules: results.schedules.length,
        contacts: results.contacts.length,
        calls: results.calls.length,
        safetyEvents: results.safety_events.length,
      },
    },
    'Search query completed'
  );

  return NextResponse.json(
    { query, results },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

function buildEmptyResults(): SearchResponse['results'] {
  return SEARCH_CATEGORIES.reduce((acc, category) => {
    acc[category] = [];
    return acc;
  }, {} as SearchResponse['results']);
}

function matchesQuery(query: string, haystack: string | undefined | null): boolean {
  if (!haystack) return false;
  return haystack.toLowerCase().includes(query.toLowerCase());
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
