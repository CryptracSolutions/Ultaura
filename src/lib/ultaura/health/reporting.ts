/**
 * Health Profile launch metrics — canonical definitions and query shapes.
 *
 * This file is the in-repo system of record for Health reporting metrics.
 * Reporting dashboards and queries reference these definitions.
 *
 * Analytics payload rules (spec Section 12, task 8.2):
 *   Allowed: anonymous event name, account id, line id, entity type/id,
 *            coarse status/result codes, timestamps
 *   Forbidden: decrypted Health text, titles/filenames, notes,
 *              summaryParaphrases, token values, internal storage paths
 */

// ---------------------------------------------------------------------------
// Metric definitions
// ---------------------------------------------------------------------------

/**
 * ACTIVATION
 *
 * Definition: Account first Health view → first Health item created within 30 days.
 *
 * DB anchors:
 *   - ultaura_health_account_state.first_viewed_at
 *   - ultaura_health_account_state.first_item_created_at
 *
 * Query shape:
 *   SELECT account_id,
 *          first_viewed_at,
 *          first_item_created_at,
 *          EXTRACT(EPOCH FROM (first_item_created_at - first_viewed_at)) / 86400 AS days_to_activation
 *   FROM ultaura_health_account_state
 *   WHERE first_viewed_at IS NOT NULL
 *     AND first_item_created_at IS NOT NULL
 *     AND first_item_created_at <= first_viewed_at + INTERVAL '30 days';
 */
export const ACTIVATION_METRIC = {
  name: 'activation',
  description: 'First Health view to first Health item created within 30 days',
  anchors: [
    'ultaura_health_account_state.first_viewed_at',
    'ultaura_health_account_state.first_item_created_at',
  ],
  windowDays: 30,
} as const;

/**
 * CONSENT CONVERSION
 *
 * Definition: First owner-requested consent event → granted consent.
 *
 * DB anchors:
 *   - ultaura_health_line_consent.health_first_consent_requested_at
 *   - ultaura_health_line_consent.health_consent_at (when health_consent = 'granted')
 *
 * Query shape:
 *   SELECT line_id,
 *          health_first_consent_requested_at,
 *          health_consent_at,
 *          health_consent
 *   FROM ultaura_health_line_consent
 *   WHERE health_first_consent_requested_at IS NOT NULL;
 *
 *   -- conversion rate = COUNT(health_consent = 'granted') / COUNT(*)
 */
export const CONSENT_CONVERSION_METRIC = {
  name: 'consent_conversion',
  description: 'First owner-requested consent event to granted consent',
  anchors: [
    'ultaura_health_line_consent.health_first_consent_requested_at',
    'ultaura_health_line_consent.health_consent_at',
  ],
} as const;

/**
 * PRECISION
 *
 * Definition: Reviewed Health suggestions by approve/dismiss outcome.
 *
 * DB anchors:
 *   - ultaura_health_suggestions.status ('approved_new' | 'approved_update' | 'dismissed')
 *   - ultaura_health_suggestions.reviewed_at
 *
 * Query shape:
 *   SELECT status, COUNT(*) AS count
 *   FROM ultaura_health_suggestions
 *   WHERE status IN ('approved_new', 'approved_update', 'dismissed')
 *   GROUP BY status;
 *
 *   -- precision = (approved_new + approved_update) / (approved_new + approved_update + dismissed)
 */
export const PRECISION_METRIC = {
  name: 'precision',
  description: 'Reviewed Health suggestions by approve/dismiss outcome',
  anchors: [
    'ultaura_health_suggestions.status',
    'ultaura_health_suggestions.reviewed_at',
  ],
} as const;

/**
 * RETURN USAGE
 *
 * Definition: Account revisit after first Health view.
 *
 * DB anchors:
 *   - ultaura_health_account_state.first_viewed_at
 *   - ultaura_health_account_state.last_viewed_at
 *
 * Query shape:
 *   SELECT account_id, first_viewed_at, last_viewed_at
 *   FROM ultaura_health_account_state
 *   WHERE first_viewed_at IS NOT NULL
 *     AND last_viewed_at IS NOT NULL
 *     AND last_viewed_at > first_viewed_at;
 *
 *   -- return rate = COUNT(last_viewed_at > first_viewed_at) / COUNT(first_viewed_at IS NOT NULL)
 */
export const RETURN_USAGE_METRIC = {
  name: 'return_usage',
  description: 'Account revisit after first Health view',
  anchors: [
    'ultaura_health_account_state.first_viewed_at',
    'ultaura_health_account_state.last_viewed_at',
  ],
} as const;

/**
 * PRIVACY INCIDENT RATE
 *
 * Definition: Tagged support/security incidents over Health-enabled accounts.
 *
 * External feed contract:
 *   - Support incidents tagged `health_privacy` (external ticketing system)
 *   - Security incidents tagged `health_privacy` (external incident tracker)
 *
 * In-repo query shape (denominator only):
 *   SELECT COUNT(DISTINCT account_id)
 *   FROM ultaura_health_account_state
 *   WHERE first_viewed_at IS NOT NULL;
 *
 * Numerator comes from external feeds joined by account_id and time window.
 * The external system of record and export/query path must be documented
 * in the launch runbook before release.
 */
export const PRIVACY_INCIDENT_RATE_METRIC = {
  name: 'privacy_incident_rate',
  description: 'Tagged support/security incidents over Health-enabled accounts',
  externalFeeds: [
    'support incidents tagged health_privacy',
    'security incidents tagged health_privacy',
  ],
  denominatorAnchor: 'ultaura_health_account_state (first_viewed_at IS NOT NULL)',
} as const;

// ---------------------------------------------------------------------------
// All metrics for programmatic access
// ---------------------------------------------------------------------------

export const HEALTH_LAUNCH_METRICS = [
  ACTIVATION_METRIC,
  CONSENT_CONVERSION_METRIC,
  PRECISION_METRIC,
  RETURN_USAGE_METRIC,
  PRIVACY_INCIDENT_RATE_METRIC,
] as const;
