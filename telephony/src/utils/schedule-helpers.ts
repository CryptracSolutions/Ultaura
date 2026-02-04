import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient, type ScheduleRow } from './supabase.js';
import { getNextOccurrence } from './timezone.js';
import { logger } from './logger.js';

export function normalizeTimeOfDay(timeOfDay: string): string {
  const match = timeOfDay.match(/^(\d{2}:\d{2})/);
  return match ? match[1] : timeOfDay;
}

export function calculateNextRun(
  schedule: Pick<ScheduleRow, 'days_of_week' | 'time_of_day' | 'timezone' | 'next_run_at'>,
  timezoneOverride?: string
): string | null {
  const { days_of_week, time_of_day, timezone, next_run_at } = schedule;
  const effectiveTimezone = timezoneOverride || timezone;
  if (!days_of_week || days_of_week.length === 0) {
    return null;
  }

  try {
    const next = getNextOccurrence({
      timeOfDay: time_of_day,
      timezone: effectiveTimezone,
      daysOfWeek: days_of_week,
      afterDate: next_run_at ? new Date(next_run_at) : undefined,
    });
    return next.toISOString();
  } catch (error) {
    logger.error({ error }, 'Failed to calculate next occurrence');
    return null;
  }
}

export async function updateLineNextScheduledCallAt(
  lineId: string,
  supabase: SupabaseClient = getSupabaseClient()
): Promise<void> {
  const { data: nextSchedule } = await supabase
    .from('ultaura_schedules')
    .select('next_run_at')
    .eq('line_id', lineId)
    .eq('enabled', true)
    .not('next_run_at', 'is', null)
    .order('next_run_at', { ascending: true })
    .limit(1)
    .single();

  await supabase
    .from('ultaura_lines')
    .update({ next_scheduled_call_at: nextSchedule?.next_run_at ?? null })
    .eq('id', lineId);
}

export async function getScheduleForTool(params: {
  lineId: string;
  scheduleId?: string | null;
  supabase?: SupabaseClient;
}): Promise<{ schedule: ScheduleRow | null; error: PostgrestError | null }> {
  const supabase = params.supabase ?? getSupabaseClient();

  let scheduleQuery = supabase
    .from('ultaura_schedules')
    .select('*')
    .eq('line_id', params.lineId)
    .eq('enabled', true);

  if (params.scheduleId) {
    scheduleQuery = scheduleQuery.eq('id', params.scheduleId);
  } else {
    scheduleQuery = scheduleQuery
      .not('next_run_at', 'is', null)
      .order('next_run_at', { ascending: true })
      .limit(1);
  }

  const { data, error } = await scheduleQuery.maybeSingle();
  return { schedule: (data as ScheduleRow | null) ?? null, error };
}
