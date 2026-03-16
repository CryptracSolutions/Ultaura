// NOTE: This module only emits structured log events using the server-side
// logger. It intentionally does NOT import 'server-only' so that server
// actions (which have their own server guarantee via 'use server') can import
// it without triggering the module guard. Do not add any client-side code here.
import getLogger from '~/core/logger';

const logger = getLogger();

/**
 * Emits a structured log event when an owner views the Health Profile for the
 * first time. This is a write-once signal — subsequent views are tracked by
 * last_viewed_at in account state, not here.
 */
export function emitHealthFirstView(accountId: string): void {
  logger.info(
    {
      event: 'health_profile.first_view',
      accountId,
    },
    'Health Profile first viewed by owner',
  );
}

/**
 * Emits a structured log event when an owner acknowledges the Health
 * disclaimer. This fires once per disclaimer version per account.
 */
export function emitDisclaimerAcknowledged(accountId: string): void {
  logger.info(
    {
      event: 'health_profile.disclaimer_acknowledged',
      accountId,
    },
    'Health Profile disclaimer acknowledged',
  );
}

/**
 * Emits a structured log event when a consent request is initiated.
 * type: 'owner_request' (family-managed re-prompt) | 'self_service' (self toggle)
 */
export function emitConsentRequestTiming(
  accountId: string,
  lineId: string,
  type: 'owner_request' | 'self_service_grant' | 'self_service_revoke',
): void {
  logger.info(
    {
      event: 'health_profile.consent_request',
      accountId,
      lineId,
      type,
    },
    'Health Profile consent request initiated',
  );
}

/**
 * Emits when a Health item (condition, medication, observation, document) is created.
 * Payload: allowed fields only — no decrypted text, titles, or filenames.
 */
export function emitHealthItemCreated(
  accountId: string,
  lineId: string,
  entityType: 'condition' | 'medication' | 'observation' | 'document',
  entityId: string,
): void {
  logger.info(
    {
      event: 'health_profile.item_created',
      accountId,
      lineId,
      entityType,
      entityId,
    },
    'Health item created',
  );
}

/**
 * Emits when Health consent is granted (spoken or self-service).
 */
export function emitHealthConsentGranted(
  accountId: string,
  lineId: string,
  source: 'spoken' | 'self_service',
): void {
  logger.info(
    {
      event: 'health_profile.consent_granted',
      accountId,
      lineId,
      source,
    },
    'Health consent granted',
  );
}

/**
 * Emits when a Health suggestion is reviewed (approved or dismissed).
 */
export function emitHealthSuggestionReviewed(
  accountId: string,
  lineId: string,
  suggestionId: string,
  outcome: 'approved_new' | 'approved_update' | 'dismissed',
): void {
  logger.info(
    {
      event: 'health_profile.suggestion_reviewed',
      accountId,
      lineId,
      suggestionId,
      outcome,
    },
    'Health suggestion reviewed',
  );
}

/**
 * Emits when an owner revisits Health Profile after the first view.
 */
export function emitHealthProfileRevisit(accountId: string): void {
  logger.info(
    {
      event: 'health_profile.revisit',
      accountId,
    },
    'Health Profile revisited',
  );
}
