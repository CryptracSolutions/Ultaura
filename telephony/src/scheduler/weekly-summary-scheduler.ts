import { getSupabaseClient, LineRow } from '../utils/supabase.js';
import { logger } from '../utils/logger.js';
import { generateWeeklySummaryForLine } from '../services/weekly-summary.js';

const POLL_INTERVAL_MS = 60 * 60 * 1000; // hourly

let isRunning = false;
let interval: ReturnType<typeof setInterval> | null = null;
let shuttingDown = false;

export function startWeeklySummaryScheduler(): void {
  if (process.env.SCHEDULER_DISABLED === 'true') {
    logger.info('Weekly summary scheduler disabled via SCHEDULER_DISABLED env var');
    return;
  }

  logger.info({ pollIntervalMs: POLL_INTERVAL_MS }, 'Starting weekly summary scheduler');

  interval = setInterval(runWeeklySummaryCycle, POLL_INTERVAL_MS);
  runWeeklySummaryCycle();
}

export function stopWeeklySummaryScheduler(): void {
  shuttingDown = true;
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
  logger.info('Weekly summary scheduler stopped');
}

async function runWeeklySummaryCycle(): Promise<void> {
  if (isRunning || shuttingDown) {
    return;
  }

  isRunning = true;

  try {
    const supabase = getSupabaseClient();
    const { data: lines, error } = await supabase
      .from('ultaura_lines')
      .select('id, account_id, display_name, timezone, short_id, last_weekly_summary_at');

    if (error) {
      logger.error({ error }, 'Failed to fetch lines for weekly summaries');
      return;
    }

    for (const line of (lines || []) as LineRow[]) {
      await generateWeeklySummaryForLine(line);
    }
  } catch (error) {
    logger.error({ error }, 'Weekly summary scheduler cycle failed');
  } finally {
    isRunning = false;
  }
}
