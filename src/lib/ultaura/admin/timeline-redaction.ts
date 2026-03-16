import 'server-only';

import type { TimelineEntry, TimelineSource, RedactionMode } from './timeline-aggregator';

/**
 * Sources visible to a payer in simulated view.
 * Payer can see call sessions (metadata only), reminders, schedule events,
 * opt-outs, trusted contacts, data exports, and consent log.
 * Payer CANNOT see: call events (raw), safety event details (only tier),
 * telephony events, notification recipients.
 */
const PAYER_VISIBLE_SOURCES: Set<TimelineSource> = new Set<TimelineSource>([
  'call_session',
  'safety_event',
  'reminder',
  'schedule_event',
  'opt_out',
  'trusted_contact',
  'data_export',
  'consent_audit',
]);

/**
 * Sources visible to a notification recipient in simulated view.
 * Recipients can only see limited safety alerts.
 */
const RECIPIENT_VISIBLE_SOURCES: Set<TimelineSource> = new Set<TimelineSource>([
  'safety_event',
]);

/**
 * Returns true if a consent_audit action string is Health-related.
 * Health consent actions are identified by the `health_` prefix, matching
 * action types such as `health_consent_updated`, `health_consent_granted`, etc.
 */
function isHealthConsentAction(action: unknown): boolean {
  return typeof action === 'string' && action.startsWith('health_');
}

/**
 * Strip old_value and new_value from consent_audit entries whose action is
 * Health-related. Health consent state is owner-only data and must never
 * be exposed through the admin timeline, regardless of redaction mode.
 * The action type itself (e.g. `health_consent_updated`) is preserved so
 * the audit trail remains meaningful.
 * See spec Section 9.5 and task 7.3.
 */
function redactHealthConsentValues(entries: TimelineEntry[]): TimelineEntry[] {
  return entries.map((entry) => {
    if (entry.source !== 'consent_audit') return entry;

    const payload = entry.payload as Record<string, unknown>;
    if (!isHealthConsentAction(payload.action)) return entry;

    return {
      ...entry,
      payload: {
        ...payload,
        old_value: '[redacted]',
        new_value: '[redacted]',
      },
    };
  });
}

export function applyRedaction(
  entries: TimelineEntry[],
  mode: RedactionMode,
): TimelineEntry[] {
  // Health consent values are stripped universally — before any mode-based
  // redaction — so they are never visible even in admin_full mode.
  const sanitized = redactHealthConsentValues(entries);

  if (mode === 'admin_full') {
    return sanitized;
  }

  if (mode === 'payer_simulated') {
    return sanitized
      .filter((entry) => PAYER_VISIBLE_SOURCES.has(entry.source))
      .map((entry) => redactForPayer(entry));
  }

  if (mode === 'recipient_simulated') {
    return sanitized
      .filter((entry) => RECIPIENT_VISIBLE_SOURCES.has(entry.source))
      .map((entry) => redactForRecipient(entry));
  }

  return sanitized;
}

function redactForPayer(entry: TimelineEntry): TimelineEntry {
  switch (entry.source) {
    case 'call_session': {
      // Payer sees metadata only: direction, status, duration. No twilio SID or end_reason details.
      const { direction, status, seconds_connected } = entry.payload as Record<
        string,
        unknown
      >;
      return {
        ...entry,
        payload: {
          direction: direction ?? '[hidden]',
          status: status ?? '[hidden]',
          seconds_connected: seconds_connected ?? '[hidden]',
        },
      };
    }

    case 'safety_event': {
      // Payer sees the tier only, not the signals or detailed action
      const { tier } = entry.payload as Record<string, unknown>;
      return {
        ...entry,
        summary: `Safety event: ${tier ?? 'unknown'} tier`,
        payload: {
          tier: tier ?? '[hidden]',
          signals: '[hidden]',
          action_taken: '[hidden]',
        },
      };
    }

    case 'reminder': {
      // Health-linked reminders must never surface in payer view — filter defensively
      if ((entry.payload as Record<string, unknown>).source_context === 'health_profile') {
        return {
          ...entry,
          summary: '[hidden]',
          payload: {},
        };
      }
      // Payer sees reminder info but encrypted payloads are stripped
      const cleaned = { ...entry.payload };
      if (cleaned.has_encrypted_message) {
        cleaned.message = '[hidden]';
      }
      delete cleaned.has_encrypted_message;
      return {
        ...entry,
        payload: cleaned,
      };
    }

    case 'trusted_contact': {
      // Payer sees contact name and status, phone is partially masked
      const { name, enabled } = entry.payload as Record<string, unknown>;
      return {
        ...entry,
        payload: {
          name: name ?? '[hidden]',
          phone_e164: '[hidden]',
          enabled: enabled ?? '[hidden]',
        },
      };
    }

    case 'consent_audit': {
      // Payer sees consent actions but not old/new values
      const { action, consent_type } = entry.payload as Record<
        string,
        unknown
      >;
      return {
        ...entry,
        payload: {
          action: action ?? '[hidden]',
          consent_type: consent_type ?? '[hidden]',
          old_value: '[hidden]',
          new_value: '[hidden]',
          actor_type: '[hidden]',
        },
      };
    }

    default:
      // schedule_event, opt_out, data_export: pass through with payload cleared
      // These sources are safe for payer but we strip raw payloads
      return {
        ...entry,
        payload: stripDeepPayloads(entry.payload),
      };
  }
}

function redactForRecipient(entry: TimelineEntry): TimelineEntry {
  // Recipients see only safety events, with minimal detail
  if (entry.source === 'safety_event') {
    const { tier } = entry.payload as Record<string, unknown>;
    return {
      ...entry,
      summary: `Safety alert: ${tier ?? 'unknown'} tier`,
      payload: {
        tier: tier ?? '[hidden]',
        signals: '[hidden]',
        action_taken: '[hidden]',
        call_session_id: '[hidden]',
      },
    };
  }

  // Should not reach here given the filter, but handle defensively
  return {
    ...entry,
    summary: '[hidden]',
    payload: {},
  };
}

/**
 * Remove nested payload objects that might contain sensitive data.
 * Keeps top-level scalar values but replaces nested objects/arrays.
 */
function stripDeepPayloads(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (value === null || value === undefined) {
      cleaned[key] = value;
    } else if (typeof value === 'object') {
      cleaned[key] = '[hidden]';
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}
