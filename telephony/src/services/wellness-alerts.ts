import { DateTime } from 'luxon';
import { getSupabaseClient } from '../utils/supabase.js';
import { logger } from '../utils/logger.js';
import { getInternalApiSecret } from '../utils/env.js';
import { getNotificationPreferences } from './weekly-summary.js';
import {
  callHasCognitiveObservations,
  resetCognitiveStreakIfNoObservation,
} from './cognitive-flags.js';

type AlertSeverity = 'info' | 'warning' | 'urgent';

interface WellnessAlertPayload {
  alertId: string;
  accountId: string;
  lineId: string;
  lineName: string;
  alertType: string;
  severity: AlertSeverity;
  title: string;
  summary: string;
  createdAt: string;
  dashboardUrl: string;
  settingsUrl: string;
}

function getAppBaseUrl(): string {
  return (
    process.env.ULTAURA_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

async function getInsightPrivacy(lineId: string): Promise<{ insights_enabled: boolean; is_paused: boolean } | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ultaura_insight_privacy')
    .select('insights_enabled, is_paused')
    .eq('line_id', lineId)
    .maybeSingle();

  if (error) {
    logger.error({ error, lineId }, 'Failed to fetch insight privacy for alerts');
    return null;
  }

  return data ?? null;
}

async function sendWellnessAlertEmail(payload: WellnessAlertPayload): Promise<boolean> {
  const url = `${getAppBaseUrl()}/api/telephony/wellness-alerts`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': getInternalApiSecret(),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      logger.error({ status: response.status, body }, 'Wellness alert email failed');
      return false;
    }

    return true;
  } catch (error) {
    logger.error({ error }, 'Wellness alert request failed');
    return false;
  }
}

async function createWellnessAlertRecord(options: {
  accountId: string;
  lineId: string;
  callSessionId: string;
  alertType: string;
  severity: AlertSeverity;
  title: string;
  summary: string;
  deliveryMethod: string;
}): Promise<string | null> {
  const supabase = getSupabaseClient();

  const { data: existing, error: existingError } = await supabase
    .from('ultaura_wellness_alerts')
    .select('id')
    .eq('alert_type', options.alertType)
    .eq('source_call_session_id', options.callSessionId)
    .eq('line_id', options.lineId)
    .maybeSingle();

  if (existingError) {
    logger.error({ error: existingError, lineId: options.lineId }, 'Failed to check existing alerts');
  }

  if (existing?.id) {
    return existing.id;
  }

  const { data, error } = await supabase
    .from('ultaura_wellness_alerts')
    .insert({
      account_id: options.accountId,
      line_id: options.lineId,
      alert_type: options.alertType,
      severity: options.severity,
      title: options.title,
      summary: options.summary,
      source_call_session_id: options.callSessionId,
      delivery_method: options.deliveryMethod,
    })
    .select('id')
    .single();

  if (error || !data) {
    logger.error({ error, lineId: options.lineId }, 'Failed to create wellness alert');
    return null;
  }

  return data.id;
}

function mapHealthSeverity(severity: string | null): AlertSeverity {
  switch (severity) {
    case 'concerning':
      return 'urgent';
    case 'moderate':
      return 'warning';
    case 'mild':
    default:
      return 'info';
  }
}

function pickHealthSeverity(values: Array<string | null>): string | null {
  const ranks: Record<string, number> = {
    mild: 1,
    moderate: 2,
    concerning: 3,
  };

  let best: string | null = null;
  let bestRank = 0;

  for (const value of values) {
    if (!value) {
      continue;
    }
    const rank = ranks[value] ?? 0;
    if (rank > bestRank) {
      bestRank = rank;
      best = value;
    }
  }

  return best;
}

export async function processWellnessAlertsForCall(options: {
  callSessionId: string;
  lineId: string;
  accountId: string;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const callHasObservations = await callHasCognitiveObservations(options.callSessionId);
  if (!callHasObservations) {
    await resetCognitiveStreakIfNoObservation(options.lineId);
  }

  const privacy = await getInsightPrivacy(options.lineId);
  if (privacy?.insights_enabled === false) {
    return;
  }

  const { data: account } = await supabase
    .from('ultaura_accounts')
    .select('user_type')
    .eq('id', options.accountId)
    .maybeSingle();

  if (!privacy && account?.user_type === 'family_managed') {
    logger.warn({ lineId: options.lineId }, 'Missing insight privacy for family-managed alert');
    return;
  }

  if (privacy?.is_paused && account?.user_type === 'family_managed') {
    return;
  }

  const preferences = await getNotificationPreferences(options.accountId, options.lineId);
  const deliveryMethod = preferences.alert_delivery_method || 'email';

  const { data: line, error: lineError } = await supabase
    .from('ultaura_lines')
    .select('display_name, short_id')
    .eq('id', options.lineId)
    .single();

  if (lineError || !line) {
    logger.error({ error: lineError, lineId: options.lineId }, 'Failed to load line for alerts');
    return;
  }

  const dashboardUrl = `${getAppBaseUrl()}/dashboard/alerts?line=${line.short_id}`;
  const settingsUrl = `${getAppBaseUrl()}/dashboard/lines/${line.short_id}/settings`;

  if (preferences.health_mention_alerts) {
    const { data: mentions, error: mentionsError } = await supabase
      .from('ultaura_health_mentions')
      .select('id, category, severity')
      .eq('call_session_id', options.callSessionId)
      .eq('line_id', options.lineId)
      .eq('triggers_alert', true)
      .is('alert_sent_at', null);

    if (mentionsError) {
      logger.error({ error: mentionsError, lineId: options.lineId }, 'Failed to load health mentions');
    } else if (mentions && mentions.length > 0) {
      const categories = Array.from(new Set(mentions.map((mention) => mention.category)));
      const severity = pickHealthSeverity(mentions.map((mention) => mention.severity ?? null));
      const severityLabel = severity ? `${severity} severity` : 'unspecified severity';
      const summary = `Health concern detected (${categories.join(', ')}, ${severityLabel})`;
      const title = 'Health concern detected';
      const alertId = await createWellnessAlertRecord({
        accountId: options.accountId,
        lineId: options.lineId,
        callSessionId: options.callSessionId,
        alertType: 'health_mention',
        severity: mapHealthSeverity(severity),
        title,
        summary,
        deliveryMethod,
      });

      if (alertId) {
        const payload: WellnessAlertPayload = {
          alertId,
          accountId: options.accountId,
          lineId: options.lineId,
          lineName: line.display_name,
          alertType: 'health_mention',
          severity: mapHealthSeverity(severity),
          title,
          summary,
          createdAt: new Date().toISOString(),
          dashboardUrl,
          settingsUrl,
        };

        if (deliveryMethod === 'email') {
          const delivered = await sendWellnessAlertEmail(payload);
          if (delivered) {
            await supabase
              .from('ultaura_wellness_alerts')
              .update({ delivered_at: new Date().toISOString() })
              .eq('id', alertId);
          }
        }

        const mentionIds = mentions.map((mention) => mention.id);
        await supabase
          .from('ultaura_health_mentions')
          .update({ alert_sent_at: new Date().toISOString() })
          .in('id', mentionIds);
      }
    }
  }

  if (preferences.mood_drop_alerts) {
    const { data: snapshot, error: snapshotError } = await supabase
      .from('ultaura_mood_snapshots')
      .select('mood_start, mood_end, created_at')
      .eq('call_session_id', options.callSessionId)
      .eq('line_id', options.lineId)
      .maybeSingle();

    if (snapshotError) {
      logger.error({ error: snapshotError, lineId: options.lineId }, 'Failed to fetch mood snapshot');
    } else if (snapshot?.mood_start && snapshot?.mood_end) {
      const lowMoods = new Set(['low', 'sad', 'anxious']);
      const startsHigh = ['positive', 'neutral'].includes(snapshot.mood_start);
      const endsLow = lowMoods.has(snapshot.mood_end);

      let trigger = startsHigh && endsLow;
      let patternNote = '';

      if (!trigger) {
        const { data: recent, error: recentError } = await supabase
          .from('ultaura_mood_snapshots')
          .select('mood_end')
          .eq('line_id', options.lineId)
          .order('created_at', { ascending: false })
          .limit(3);

        if (recentError) {
          logger.error({ error: recentError, lineId: options.lineId }, 'Failed to fetch recent moods');
        } else if (recent && recent.length >= 3) {
          const allLow = recent.every((entry) => entry.mood_end && lowMoods.has(entry.mood_end));
          if (allLow) {
            trigger = true;
            patternNote = 'Pattern detected across recent calls.';
          }
        }
      }

      if (trigger) {
        const title = 'Mood drop detected';
        const summary = patternNote
          ? `Mood drop pattern detected. ${patternNote}`
          : `Mood declined during the call (end mood: ${snapshot.mood_end}).`;

        const alertId = await createWellnessAlertRecord({
          accountId: options.accountId,
          lineId: options.lineId,
          callSessionId: options.callSessionId,
          alertType: 'mood_drop',
          severity: 'warning',
          title,
          summary,
          deliveryMethod,
        });

        if (alertId) {
          const payload: WellnessAlertPayload = {
            alertId,
            accountId: options.accountId,
            lineId: options.lineId,
            lineName: line.display_name,
            alertType: 'mood_drop',
            severity: 'warning',
            title,
            summary,
            createdAt: DateTime.fromISO(snapshot.created_at).toISO() || new Date().toISOString(),
            dashboardUrl,
            settingsUrl,
          };

          if (deliveryMethod === 'email') {
            const delivered = await sendWellnessAlertEmail(payload);
            if (delivered) {
              await supabase
                .from('ultaura_wellness_alerts')
                .update({ delivered_at: new Date().toISOString() })
                .eq('id', alertId);
            }
          }
        }
      }
    }
  }

  if (preferences.cognitive_concern_alerts) {
    const { data: flags, error: flagsError } = await supabase
      .from('ultaura_cognitive_flags')
      .select('concern_level, family_notified_at, flagged_at')
      .eq('line_id', options.lineId)
      .maybeSingle();

    if (flagsError) {
      logger.error({ error: flagsError, lineId: options.lineId }, 'Failed to fetch cognitive flags');
    } else if (flags?.concern_level === 'flagged' && !flags.family_notified_at) {
      const title = 'Cognitive concern detected';
      const summary = 'Cognitive concern trend detected (flagged).';

      const alertId = await createWellnessAlertRecord({
        accountId: options.accountId,
        lineId: options.lineId,
        callSessionId: options.callSessionId,
        alertType: 'cognitive_concern',
        severity: 'warning',
        title,
        summary,
        deliveryMethod,
      });

      if (alertId) {
        const payload: WellnessAlertPayload = {
          alertId,
          accountId: options.accountId,
          lineId: options.lineId,
          lineName: line.display_name,
          alertType: 'cognitive_concern',
          severity: 'warning',
          title,
          summary,
          createdAt: flags.flagged_at || new Date().toISOString(),
          dashboardUrl,
          settingsUrl,
        };

        if (deliveryMethod === 'email') {
          const delivered = await sendWellnessAlertEmail(payload);
          if (delivered) {
            await supabase
              .from('ultaura_wellness_alerts')
              .update({ delivered_at: new Date().toISOString() })
              .eq('id', alertId);
          }
        }

        await supabase
          .from('ultaura_cognitive_flags')
          .update({ family_notified_at: new Date().toISOString() })
          .eq('line_id', options.lineId);
      }
    }
  }
}
