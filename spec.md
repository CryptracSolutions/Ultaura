# Comprehensive Specification: Privacy & Compliance Posture Improvements

## Executive Summary

This specification covers the implementation of vendor and compliance posture improvements around audio/transcript processing in Ultaura. The goal is to address HIPAA-adjacent positioning concerns and provide customers with transparent, configurable privacy controls.

### Key Deliverables

1. **New consent types**: `audio_processing` and `recording` consent with payer acknowledgment and voice consent flows
2. **Account-level privacy settings**: Toggles for recording and AI summarization/memory extraction
3. **Data retention**: Configurable retention periods (30/90/365 days/indefinite) with automated cleanup
4. **Recording disclosure**: TwiML announcement at call start ("This call may be recorded")
5. **Voice consent collection**: First-call consent flow for memory storage
6. **Data deletion**: Hard delete from database and Twilio recordings
7. **Data export**: JSON/CSV download of account data
8. **Audit logging**: Full consent change audit trail
9. **Privacy Center UI**: Dedicated dashboard page at `/dashboard/privacy`

---

## 1. Objective and Scope

### Problem Statement

Ultaura currently lacks:
- Explicit consent mechanisms for audio processing and recording
- Per-account privacy controls for AI features
- Configurable data retention with hard deletion
- Recording disclosure announcements
- Voice consent collection during calls
- Data export/portability features
- Audit logging for consent changes
- Centralized privacy management UI

### Business Context

**Impact**: High (HIPAA-adjacent positioning can be undermined quickly)
**Likelihood**: Medium (depends on customers + claims)
**Symptoms**: Customers ask about retention, BAAs, model training, call recording laws

### Affected Areas

| Component | Location | Current Issue |
|-----------|----------|---------------|
| Realtime calls | `telephony/src/websocket/grok-bridge.ts` | Audio sent to xAI without explicit consent |
| Post-call summarization | `telephony/src/services/call-summarization.ts` | No disable option per account |
| Optional Twilio recording | `telephony/src/utils/twilio.ts` | No consent, no retention policy |
| Recording migration | `20260104000007_add_call_recording.sql` | Recording SID stored but no deletion API |

### Scope

This specification covers all privacy and compliance features required before launch. No migration of existing data is needed as there are no production customers.

### Regulatory Framework

- General privacy best practices
- HIPAA considerations (though not claiming HIPAA compliance)
- US state laws (general coverage, no specific state focus)
- Two-party consent state compliance for call recording

---

## 2. Architecture Overview

```
+------------------------------------------------------------------+
|                    Privacy Architecture                           |
+------------------------------------------------------------------+
|                                                                   |
|  +----------------+    +------------------+    +----------------+ |
|  | Privacy        |--->| Account          |--->| Telephony      | |
|  | Center UI      |    | Settings         |    | Backend        | |
|  +----------------+    +------------------+    +----------------+ |
|         |                     |                       |          |
|         v                     v                       v          |
|  +----------------+    +------------------+    +----------------+ |
|  | Consent        |    | Retention        |    | Voice          | |
|  | Audit Log      |    | Cleanup Job      |    | Consent Flow   | |
|  +----------------+    +------------------+    +----------------+ |
|         |                     |                       |          |
|         +---------------------+-----------------------+          |
|                               |                                  |
|                               v                                  |
|                   +----------------------+                       |
|                   |    Supabase          |                       |
|                   |    Database          |                       |
|                   +----------------------+                       |
|                               |                                  |
|                               v                                  |
|                   +----------------------+                       |
|                   |  Twilio APIs         |                       |
|                   |  (Recordings)        |                       |
|                   +----------------------+                       |
+------------------------------------------------------------------+
```

### Integration Points

1. **Dashboard** (`/dashboard/privacy`) - Privacy Center for account-level controls
2. **Line Setup** (`AddLineModal`) - Vendor disclosure acknowledgment
3. **Telephony** - Recording disclosure, voice consent, privacy-aware call handling
4. **Database** - New tables for privacy settings, consent audit, voice consent
5. **Scheduled Jobs** - Daily retention cleanup at 3 AM UTC

---

## 3. Database Schema Changes

### 3.1 Migration: Account Privacy Settings

**File**: `supabase/migrations/20260115000001_account_privacy_settings.sql`

```sql
-- Extend consent type enum with new values
ALTER TYPE ultaura_consent_type ADD VALUE IF NOT EXISTS 'audio_processing';
ALTER TYPE ultaura_consent_type ADD VALUE IF NOT EXISTS 'recording';

-- Retention period enum
CREATE TYPE ultaura_retention_period AS ENUM ('30_days', '90_days', '365_days', 'indefinite');

-- Account-level privacy settings
CREATE TABLE ultaura_account_privacy_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Feature toggles (account level)
  recording_enabled boolean NOT NULL DEFAULT false,
  ai_summarization_enabled boolean NOT NULL DEFAULT true,

  -- Data retention
  retention_period ultaura_retention_period NOT NULL DEFAULT '90_days',

  -- Payer acknowledgment of vendor disclosure
  vendor_disclosure_acknowledged_at timestamptz,
  vendor_disclosure_acknowledged_by uuid REFERENCES public.users(id),

  UNIQUE(account_id)
);

CREATE INDEX idx_privacy_settings_account ON ultaura_account_privacy_settings(account_id);

ALTER TABLE ultaura_account_privacy_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view privacy settings for their accounts"
  ON ultaura_account_privacy_settings FOR SELECT
  USING (can_access_ultaura_account(account_id));

CREATE POLICY "Users can update privacy settings for their accounts"
  ON ultaura_account_privacy_settings FOR UPDATE
  USING (can_access_ultaura_account(account_id));

CREATE POLICY "Users can insert privacy settings for their accounts"
  ON ultaura_account_privacy_settings FOR INSERT
  WITH CHECK (can_access_ultaura_account(account_id));

-- Auto-create row for new accounts
CREATE OR REPLACE FUNCTION create_privacy_settings_for_account()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO ultaura_account_privacy_settings (account_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_create_privacy_settings
AFTER INSERT ON ultaura_accounts
FOR EACH ROW EXECUTE FUNCTION create_privacy_settings_for_account();

-- Backfill existing accounts (if any)
INSERT INTO ultaura_account_privacy_settings (account_id)
SELECT id FROM ultaura_accounts
ON CONFLICT (account_id) DO NOTHING;
```

### 3.2 Migration: Consent Audit Log

**File**: `supabase/migrations/20260115000002_consent_audit_log.sql`

```sql
CREATE TYPE ultaura_consent_audit_action AS ENUM (
  'granted',
  'revoked',
  'updated',
  'voice_consent_given',
  'voice_consent_denied',
  'retention_changed',
  'recording_toggled',
  'summarization_toggled',
  'vendor_acknowledged',
  'data_export_requested',
  'data_deletion_requested'
);

CREATE TABLE ultaura_consent_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Who
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  line_id uuid REFERENCES ultaura_lines(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('payer', 'line_voice', 'system')),

  -- What
  action ultaura_consent_audit_action NOT NULL,
  consent_type text, -- e.g., 'audio_processing', 'recording', 'data_retention'
  old_value jsonb,
  new_value jsonb,

  -- Where
  ip_address inet,
  user_agent text,
  call_session_id uuid REFERENCES ultaura_call_sessions(id) ON DELETE SET NULL,

  -- Context
  metadata jsonb
);

CREATE INDEX idx_audit_log_account_created ON ultaura_consent_audit_log(account_id, created_at DESC);
CREATE INDEX idx_audit_log_action ON ultaura_consent_audit_log(action, created_at DESC);
CREATE INDEX idx_audit_log_line ON ultaura_consent_audit_log(line_id, created_at DESC) WHERE line_id IS NOT NULL;

ALTER TABLE ultaura_consent_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit logs for their accounts"
  ON ultaura_consent_audit_log FOR SELECT
  USING (can_access_ultaura_account(account_id));

-- No INSERT/UPDATE/DELETE policies for users - service role only for immutability
```

### 3.3 Migration: Line Voice Consent

**File**: `supabase/migrations/20260115000003_line_voice_consent.sql`

```sql
CREATE TYPE ultaura_voice_consent_status AS ENUM ('pending', 'granted', 'denied');

CREATE TABLE ultaura_line_voice_consent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Memory consent (required for personalization)
  memory_consent ultaura_voice_consent_status NOT NULL DEFAULT 'pending',
  memory_consent_at timestamptz,
  memory_consent_call_session_id uuid REFERENCES ultaura_call_sessions(id) ON DELETE SET NULL,

  UNIQUE(line_id)
);

CREATE INDEX idx_voice_consent_line ON ultaura_line_voice_consent(line_id);
CREATE INDEX idx_voice_consent_account ON ultaura_line_voice_consent(account_id);

ALTER TABLE ultaura_line_voice_consent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view voice consent for their accounts"
  ON ultaura_line_voice_consent FOR SELECT
  USING (can_access_ultaura_account(account_id));

-- Service role only for updates (from telephony)

-- Auto-create row for new lines
CREATE OR REPLACE FUNCTION create_voice_consent_for_line()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO ultaura_line_voice_consent (line_id, account_id)
  VALUES (NEW.id, NEW.account_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_create_voice_consent
AFTER INSERT ON ultaura_lines
FOR EACH ROW EXECUTE FUNCTION create_voice_consent_for_line();

-- Backfill existing lines (if any)
INSERT INTO ultaura_line_voice_consent (line_id, account_id)
SELECT id, account_id FROM ultaura_lines
ON CONFLICT (line_id) DO NOTHING;
```

### 3.4 Migration: Data Export Requests

**File**: `supabase/migrations/20260115000004_data_export_requests.sql`

```sql
CREATE TYPE ultaura_export_status AS ENUM ('pending', 'processing', 'ready', 'expired', 'failed');
CREATE TYPE ultaura_export_format AS ENUM ('json', 'csv');

CREATE TABLE ultaura_data_export_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Export config
  format ultaura_export_format NOT NULL DEFAULT 'json',
  include_memories boolean NOT NULL DEFAULT true,
  include_call_metadata boolean NOT NULL DEFAULT true,
  include_reminders boolean NOT NULL DEFAULT true,

  -- Status
  status ultaura_export_status NOT NULL DEFAULT 'pending',
  processed_at timestamptz,
  expires_at timestamptz,

  -- Download
  download_url text,
  file_size_bytes bigint,

  -- Error handling
  error_message text
);

CREATE INDEX idx_export_requests_account ON ultaura_data_export_requests(account_id, created_at DESC);
CREATE INDEX idx_export_requests_status ON ultaura_data_export_requests(status) WHERE status IN ('pending', 'processing');

ALTER TABLE ultaura_data_export_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view export requests for their accounts"
  ON ultaura_data_export_requests FOR SELECT
  USING (can_access_ultaura_account(account_id));

CREATE POLICY "Users can insert export requests for their accounts"
  ON ultaura_data_export_requests FOR INSERT
  WITH CHECK (can_access_ultaura_account(account_id));
```

### 3.5 Migration: Privacy Columns

**File**: `supabase/migrations/20260115000005_privacy_columns.sql`

```sql
-- Add deletion tracking to call_sessions
ALTER TABLE ultaura_call_sessions
  ADD COLUMN IF NOT EXISTS recording_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS recording_deletion_reason text;

-- Add deletion tracking to memories
ALTER TABLE ultaura_memories
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_reason text CHECK (
    deletion_reason IN ('retention_policy', 'user_request', 'consent_revoked', 'account_deletion')
  );

-- Index for retention cleanup
CREATE INDEX IF NOT EXISTS idx_memories_created_active
  ON ultaura_memories(created_at, active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_call_sessions_created
  ON ultaura_call_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_call_insights_created
  ON ultaura_call_insights(created_at);
```

### 3.6 Migration: Retention Cleanup Functions

**File**: `supabase/migrations/20260115000006_retention_cleanup.sql`

```sql
-- Function to calculate retention cutoff date
CREATE OR REPLACE FUNCTION get_retention_cutoff(p_account_id uuid)
RETURNS timestamptz AS $$
DECLARE
  v_retention_period ultaura_retention_period;
  v_cutoff timestamptz;
BEGIN
  SELECT retention_period INTO v_retention_period
  FROM ultaura_account_privacy_settings
  WHERE account_id = p_account_id;

  IF v_retention_period IS NULL OR v_retention_period = 'indefinite' THEN
    RETURN NULL;
  END IF;

  CASE v_retention_period
    WHEN '30_days' THEN v_cutoff := now() - interval '30 days';
    WHEN '90_days' THEN v_cutoff := now() - interval '90 days';
    WHEN '365_days' THEN v_cutoff := now() - interval '365 days';
    ELSE v_cutoff := NULL;
  END CASE;

  RETURN v_cutoff;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup data for a single account (returns recording SIDs for Twilio deletion)
CREATE OR REPLACE FUNCTION cleanup_account_retention(p_account_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_cutoff timestamptz;
  v_deleted_memories int := 0;
  v_deleted_insights int := 0;
  v_recordings_to_delete text[];
BEGIN
  v_cutoff := get_retention_cutoff(p_account_id);

  IF v_cutoff IS NULL THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'indefinite_retention');
  END IF;

  -- Hard delete memories older than cutoff
  WITH deleted AS (
    DELETE FROM ultaura_memories
    WHERE account_id = p_account_id
      AND created_at < v_cutoff
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_memories FROM deleted;

  -- Hard delete call insights older than cutoff
  WITH deleted AS (
    DELETE FROM ultaura_call_insights
    WHERE account_id = p_account_id
      AND created_at < v_cutoff
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_insights FROM deleted;

  -- Get recording SIDs to delete from Twilio
  SELECT array_agg(recording_sid) INTO v_recordings_to_delete
  FROM ultaura_call_sessions
  WHERE account_id = p_account_id
    AND created_at < v_cutoff
    AND recording_sid IS NOT NULL
    AND recording_deleted_at IS NULL;

  RETURN jsonb_build_object(
    'deleted_memories', v_deleted_memories,
    'deleted_insights', v_deleted_insights,
    'recordings_to_delete', COALESCE(v_recordings_to_delete, ARRAY[]::text[]),
    'cutoff_date', v_cutoff
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to run cleanup for all accounts (called by cron)
CREATE OR REPLACE FUNCTION run_retention_cleanup()
RETURNS jsonb AS $$
DECLARE
  v_account record;
  v_result jsonb;
  v_total_memories int := 0;
  v_total_insights int := 0;
  v_all_recordings text[] := ARRAY[]::text[];
BEGIN
  FOR v_account IN
    SELECT account_id FROM ultaura_account_privacy_settings
    WHERE retention_period != 'indefinite'
  LOOP
    v_result := cleanup_account_retention(v_account.account_id);
    v_total_memories := v_total_memories + COALESCE((v_result->>'deleted_memories')::int, 0);
    v_total_insights := v_total_insights + COALESCE((v_result->>'deleted_insights')::int, 0);
    v_all_recordings := v_all_recordings || COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(v_result->'recordings_to_delete')),
      ARRAY[]::text[]
    );
  END LOOP;

  RETURN jsonb_build_object(
    'total_deleted_memories', v_total_memories,
    'total_deleted_insights', v_total_insights,
    'recordings_to_delete', v_all_recordings,
    'completed_at', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule daily cleanup at 3 AM UTC (requires pg_cron extension)
SELECT cron.schedule(
  'retention-cleanup-daily',
  '0 3 * * *',
  $$SELECT run_retention_cleanup()$$
);
```

---

## 4. Backend Implementation

### 4.1 Type Definitions

**File**: `src/lib/ultaura/types.ts` (additions)

```typescript
// Add to existing types file

export type RetentionPeriod = '30_days' | '90_days' | '365_days' | 'indefinite';
export type VoiceConsentStatus = 'pending' | 'granted' | 'denied';
export type ConsentAuditAction =
  | 'granted'
  | 'revoked'
  | 'updated'
  | 'voice_consent_given'
  | 'voice_consent_denied'
  | 'retention_changed'
  | 'recording_toggled'
  | 'summarization_toggled'
  | 'vendor_acknowledged'
  | 'data_export_requested'
  | 'data_deletion_requested';

export interface AccountPrivacySettings {
  id: string;
  accountId: string;
  createdAt: string;
  updatedAt: string;
  recordingEnabled: boolean;
  aiSummarizationEnabled: boolean;
  retentionPeriod: RetentionPeriod;
  vendorDisclosureAcknowledgedAt: string | null;
  vendorDisclosureAcknowledgedBy: string | null;
}

export interface LineVoiceConsent {
  id: string;
  lineId: string;
  accountId: string;
  createdAt: string;
  updatedAt: string;
  memoryConsent: VoiceConsentStatus;
  memoryConsentAt: string | null;
  memoryConsentCallSessionId: string | null;
}

export interface ConsentAuditEntry {
  id: string;
  createdAt: string;
  accountId: string;
  lineId: string | null;
  actorUserId: string | null;
  actorType: 'payer' | 'line_voice' | 'system';
  action: ConsentAuditAction;
  consentType: string | null;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  callSessionId: string | null;
  metadata: Record<string, unknown> | null;
}

export interface DataExportRequest {
  id: string;
  accountId: string;
  requestedBy: string;
  createdAt: string;
  format: 'json' | 'csv';
  includeMemories: boolean;
  includeCallMetadata: boolean;
  includeReminders: boolean;
  status: 'pending' | 'processing' | 'ready' | 'expired' | 'failed';
  processedAt: string | null;
  expiresAt: string | null;
  downloadUrl: string | null;
  fileSizeBytes: number | null;
  errorMessage: string | null;
}
```

### 4.2 Privacy Server Actions

**File**: `src/lib/ultaura/privacy.ts` (new file)

```typescript
'use server';

import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import getLogger from '~/core/logger';
import { headers } from 'next/headers';
import type {
  AccountPrivacySettings,
  LineVoiceConsent,
  ConsentAuditEntry,
  RetentionPeriod,
  DataExportRequest,
} from './types';

const logger = getLogger();

// ============================================
// PRIVACY SETTINGS
// ============================================

export async function getAccountPrivacySettings(
  accountId: string
): Promise<AccountPrivacySettings | null> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_account_privacy_settings')
    .select('*')
    .eq('account_id', accountId)
    .single();

  if (error) {
    logger.error({ error, accountId }, 'Failed to get privacy settings');
    return null;
  }

  return {
    id: data.id,
    accountId: data.account_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    recordingEnabled: data.recording_enabled,
    aiSummarizationEnabled: data.ai_summarization_enabled,
    retentionPeriod: data.retention_period,
    vendorDisclosureAcknowledgedAt: data.vendor_disclosure_acknowledged_at,
    vendorDisclosureAcknowledgedBy: data.vendor_disclosure_acknowledged_by,
  };
}

export async function updatePrivacySettings(
  accountId: string,
  updates: {
    recordingEnabled?: boolean;
    aiSummarizationEnabled?: boolean;
    retentionPeriod?: RetentionPeriod;
  }
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseServerComponentClient();
  const headersList = await headers();

  // Get current settings for audit log
  const current = await getAccountPrivacySettings(accountId);

  const dbUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.recordingEnabled !== undefined) {
    dbUpdates.recording_enabled = updates.recordingEnabled;
  }
  if (updates.aiSummarizationEnabled !== undefined) {
    dbUpdates.ai_summarization_enabled = updates.aiSummarizationEnabled;
  }
  if (updates.retentionPeriod !== undefined) {
    dbUpdates.retention_period = updates.retentionPeriod;
  }

  const { error } = await client
    .from('ultaura_account_privacy_settings')
    .update(dbUpdates)
    .eq('account_id', accountId);

  if (error) {
    logger.error({ error, accountId }, 'Failed to update privacy settings');
    return { success: false, error: 'Failed to update settings' };
  }

  // Log audit entries for each change
  if (updates.recordingEnabled !== undefined &&
      updates.recordingEnabled !== current?.recordingEnabled) {
    await logConsentAudit({
      accountId,
      actorType: 'payer',
      action: 'recording_toggled',
      consentType: 'recording',
      oldValue: current?.recordingEnabled,
      newValue: updates.recordingEnabled,
      ipAddress: headersList.get('x-forwarded-for')?.split(',')[0] || null,
      userAgent: headersList.get('user-agent') || null,
    } as ConsentAuditEntry);
  }

  if (updates.aiSummarizationEnabled !== undefined &&
      updates.aiSummarizationEnabled !== current?.aiSummarizationEnabled) {
    await logConsentAudit({
      accountId,
      actorType: 'payer',
      action: 'summarization_toggled',
      consentType: 'audio_processing',
      oldValue: current?.aiSummarizationEnabled,
      newValue: updates.aiSummarizationEnabled,
      ipAddress: headersList.get('x-forwarded-for')?.split(',')[0] || null,
      userAgent: headersList.get('user-agent') || null,
    } as ConsentAuditEntry);
  }

  if (updates.retentionPeriod !== undefined &&
      updates.retentionPeriod !== current?.retentionPeriod) {
    await logConsentAudit({
      accountId,
      actorType: 'payer',
      action: 'retention_changed',
      consentType: 'data_retention',
      oldValue: current?.retentionPeriod,
      newValue: updates.retentionPeriod,
      ipAddress: headersList.get('x-forwarded-for')?.split(',')[0] || null,
      userAgent: headersList.get('user-agent') || null,
    } as ConsentAuditEntry);
  }

  return { success: true };
}

export async function acknowledgeVendorDisclosure(
  accountId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseServerComponentClient();
  const headersList = await headers();

  const { error } = await client
    .from('ultaura_account_privacy_settings')
    .update({
      vendor_disclosure_acknowledged_at: new Date().toISOString(),
      vendor_disclosure_acknowledged_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('account_id', accountId);

  if (error) {
    logger.error({ error, accountId }, 'Failed to acknowledge vendor disclosure');
    return { success: false, error: 'Failed to acknowledge' };
  }

  await logConsentAudit({
    accountId,
    actorUserId: userId,
    actorType: 'payer',
    action: 'vendor_acknowledged',
    ipAddress: headersList.get('x-forwarded-for')?.split(',')[0] || null,
    userAgent: headersList.get('user-agent') || null,
  } as ConsentAuditEntry);

  return { success: true };
}

// ============================================
// VOICE CONSENT
// ============================================

export async function getLineVoiceConsent(
  lineId: string
): Promise<LineVoiceConsent | null> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_line_voice_consent')
    .select('*')
    .eq('line_id', lineId)
    .single();

  if (error) {
    logger.error({ error, lineId }, 'Failed to get voice consent');
    return null;
  }

  return {
    id: data.id,
    lineId: data.line_id,
    accountId: data.account_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    memoryConsent: data.memory_consent,
    memoryConsentAt: data.memory_consent_at,
    memoryConsentCallSessionId: data.memory_consent_call_session_id,
  };
}

// ============================================
// AUDIT LOGGING
// ============================================

export async function logConsentAudit(
  entry: Partial<ConsentAuditEntry>
): Promise<void> {
  const client = getSupabaseServerComponentClient();

  const { error } = await client
    .from('ultaura_consent_audit_log')
    .insert({
      account_id: entry.accountId,
      line_id: entry.lineId || null,
      actor_user_id: entry.actorUserId || null,
      actor_type: entry.actorType || 'system',
      action: entry.action,
      consent_type: entry.consentType || null,
      old_value: entry.oldValue || null,
      new_value: entry.newValue || null,
      ip_address: entry.ipAddress || null,
      user_agent: entry.userAgent || null,
      call_session_id: entry.callSessionId || null,
      metadata: entry.metadata || null,
    });

  if (error) {
    logger.error({ error, entry }, 'Failed to log consent audit');
  }
}

export async function getConsentAuditLog(
  accountId: string,
  options?: { limit?: number; offset?: number }
): Promise<ConsentAuditEntry[]> {
  const client = getSupabaseServerComponentClient();

  let query = client
    .from('ultaura_consent_audit_log')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error } = await query;

  if (error) {
    logger.error({ error, accountId }, 'Failed to get audit log');
    return [];
  }

  return data.map(row => ({
    id: row.id,
    createdAt: row.created_at,
    accountId: row.account_id,
    lineId: row.line_id,
    actorUserId: row.actor_user_id,
    actorType: row.actor_type,
    action: row.action,
    consentType: row.consent_type,
    oldValue: row.old_value,
    newValue: row.new_value,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    callSessionId: row.call_session_id,
    metadata: row.metadata,
  }));
}

// ============================================
// DATA EXPORT
// ============================================

export async function requestDataExport(
  accountId: string,
  userId: string,
  options?: {
    format?: 'json' | 'csv';
    includeMemories?: boolean;
    includeCallMetadata?: boolean;
    includeReminders?: boolean;
  }
): Promise<{ success: boolean; requestId?: string; error?: string }> {
  const client = getSupabaseServerComponentClient();
  const headersList = await headers();

  // Check for pending exports
  const { data: pending } = await client
    .from('ultaura_data_export_requests')
    .select('id')
    .eq('account_id', accountId)
    .in('status', ['pending', 'processing'])
    .single();

  if (pending) {
    return { success: false, error: 'An export is already in progress' };
  }

  const { data, error } = await client
    .from('ultaura_data_export_requests')
    .insert({
      account_id: accountId,
      requested_by: userId,
      format: options?.format || 'json',
      include_memories: options?.includeMemories ?? true,
      include_call_metadata: options?.includeCallMetadata ?? true,
      include_reminders: options?.includeReminders ?? true,
    })
    .select('id')
    .single();

  if (error) {
    logger.error({ error, accountId }, 'Failed to create export request');
    return { success: false, error: 'Failed to create export request' };
  }

  await logConsentAudit({
    accountId,
    actorUserId: userId,
    actorType: 'payer',
    action: 'data_export_requested',
    ipAddress: headersList.get('x-forwarded-for')?.split(',')[0] || null,
    userAgent: headersList.get('user-agent') || null,
  } as ConsentAuditEntry);

  return { success: true, requestId: data.id };
}

export async function getDataExportRequests(
  accountId: string
): Promise<DataExportRequest[]> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_data_export_requests')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    logger.error({ error, accountId }, 'Failed to get export requests');
    return [];
  }

  return data.map(row => ({
    id: row.id,
    accountId: row.account_id,
    requestedBy: row.requested_by,
    createdAt: row.created_at,
    format: row.format,
    includeMemories: row.include_memories,
    includeCallMetadata: row.include_call_metadata,
    includeReminders: row.include_reminders,
    status: row.status,
    processedAt: row.processed_at,
    expiresAt: row.expires_at,
    downloadUrl: row.download_url,
    fileSizeBytes: row.file_size_bytes,
    errorMessage: row.error_message,
  }));
}

// ============================================
// DATA DELETION
// ============================================

export async function requestAccountDataDeletion(
  accountId: string,
  userId: string,
  reason: 'user_request' | 'consent_revoked'
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseServerComponentClient();
  const headersList = await headers();

  // Get all recording SIDs to delete (for async Twilio deletion)
  const { data: recordings } = await client
    .from('ultaura_call_sessions')
    .select('recording_sid')
    .eq('account_id', accountId)
    .not('recording_sid', 'is', null);

  // Hard delete memories
  await client
    .from('ultaura_memories')
    .delete()
    .eq('account_id', accountId);

  // Hard delete call insights
  await client
    .from('ultaura_call_insights')
    .delete()
    .eq('account_id', accountId);

  // Log audit
  await logConsentAudit({
    accountId,
    actorUserId: userId,
    actorType: 'payer',
    action: 'data_deletion_requested',
    metadata: {
      reason,
      recordingsToDelete: recordings?.length || 0,
    },
    ipAddress: headersList.get('x-forwarded-for')?.split(',')[0] || null,
    userAgent: headersList.get('user-agent') || null,
  } as ConsentAuditEntry);

  // Note: Twilio recording deletion happens via async job in telephony
  // The telephony service should poll for recordings needing deletion

  return { success: true };
}
```

### 4.3 Telephony Privacy Service

**File**: `telephony/src/services/privacy.ts` (new file)

```typescript
import { getSupabaseClient } from '../utils/supabase.js';
import { getTwilioClient } from '../utils/twilio.js';
import { logger } from '../server.js';
import type { AccountPrivacySettings, LineVoiceConsent } from '@ultaura/types';

// ============================================
// PRIVACY SETTINGS LOOKUP
// ============================================

export async function getAccountPrivacySettings(
  accountId: string
): Promise<AccountPrivacySettings | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('ultaura_account_privacy_settings')
    .select('*')
    .eq('account_id', accountId)
    .single();

  if (error) {
    logger.error({ error, accountId }, 'Failed to get privacy settings');
    return null;
  }

  return {
    id: data.id,
    accountId: data.account_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    recordingEnabled: data.recording_enabled,
    aiSummarizationEnabled: data.ai_summarization_enabled,
    retentionPeriod: data.retention_period,
    vendorDisclosureAcknowledgedAt: data.vendor_disclosure_acknowledged_at,
    vendorDisclosureAcknowledgedBy: data.vendor_disclosure_acknowledged_by,
  };
}

export async function getLineVoiceConsent(
  lineId: string
): Promise<LineVoiceConsent | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('ultaura_line_voice_consent')
    .select('*')
    .eq('line_id', lineId)
    .single();

  if (error) {
    logger.error({ error, lineId }, 'Failed to get voice consent');
    return null;
  }

  return {
    id: data.id,
    lineId: data.line_id,
    accountId: data.account_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    memoryConsent: data.memory_consent,
    memoryConsentAt: data.memory_consent_at,
    memoryConsentCallSessionId: data.memory_consent_call_session_id,
  };
}

export async function updateLineVoiceConsent(
  lineId: string,
  accountId: string,
  callSessionId: string,
  updates: {
    memoryConsent?: 'granted' | 'denied';
  }
): Promise<void> {
  const supabase = getSupabaseClient();

  const dbUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.memoryConsent) {
    dbUpdates.memory_consent = updates.memoryConsent;
    dbUpdates.memory_consent_at = new Date().toISOString();
    dbUpdates.memory_consent_call_session_id = callSessionId;
  }

  const { error } = await supabase
    .from('ultaura_line_voice_consent')
    .update(dbUpdates)
    .eq('line_id', lineId);

  if (error) {
    logger.error({ error, lineId }, 'Failed to update voice consent');
    return;
  }

  // Log audit
  await supabase
    .from('ultaura_consent_audit_log')
    .insert({
      account_id: accountId,
      line_id: lineId,
      actor_type: 'line_voice',
      action: updates.memoryConsent === 'granted' ? 'voice_consent_given' : 'voice_consent_denied',
      consent_type: 'audio_processing',
      new_value: updates.memoryConsent,
      call_session_id: callSessionId,
    });
}

// ============================================
// TWILIO RECORDING DELETION
// ============================================

export async function deleteRecording(recordingSid: string): Promise<boolean> {
  try {
    const client = getTwilioClient();
    await client.recordings(recordingSid).remove();
    logger.info({ recordingSid }, 'Twilio recording deleted');
    return true;
  } catch (error) {
    logger.error({ error, recordingSid }, 'Failed to delete Twilio recording');
    return false;
  }
}

export async function deleteAccountRecordings(accountId: string): Promise<{
  deleted: number;
  failed: number;
}> {
  const supabase = getSupabaseClient();

  const { data: sessions } = await supabase
    .from('ultaura_call_sessions')
    .select('id, recording_sid')
    .eq('account_id', accountId)
    .not('recording_sid', 'is', null)
    .is('recording_deleted_at', null);

  let deleted = 0;
  let failed = 0;

  for (const session of sessions || []) {
    if (!session.recording_sid) continue;

    const success = await deleteRecording(session.recording_sid);

    if (success) {
      await supabase
        .from('ultaura_call_sessions')
        .update({
          recording_deleted_at: new Date().toISOString(),
          recording_deletion_reason: 'user_request',
        })
        .eq('id', session.id);
      deleted++;
    } else {
      failed++;
    }
  }

  return { deleted, failed };
}

// ============================================
// RETENTION CLEANUP JOB
// ============================================

export async function runRetentionCleanup(): Promise<{
  deletedMemories: number;
  deletedInsights: number;
  deletedRecordings: number;
  failedRecordings: number;
}> {
  const supabase = getSupabaseClient();

  // Call the database function
  const { data, error } = await supabase.rpc('run_retention_cleanup');

  if (error) {
    logger.error({ error }, 'Retention cleanup RPC failed');
    return { deletedMemories: 0, deletedInsights: 0, deletedRecordings: 0, failedRecordings: 0 };
  }

  const recordingsToDelete: string[] = data?.recordings_to_delete || [];
  let deletedRecordings = 0;
  let failedRecordings = 0;

  // Delete recordings from Twilio
  for (const recordingSid of recordingsToDelete) {
    const success = await deleteRecording(recordingSid);
    if (success) {
      deletedRecordings++;

      // Mark as deleted in database
      await supabase
        .from('ultaura_call_sessions')
        .update({
          recording_deleted_at: new Date().toISOString(),
          recording_deletion_reason: 'retention_policy',
        })
        .eq('recording_sid', recordingSid);
    } else {
      failedRecordings++;
    }
  }

  logger.info({
    deletedMemories: data?.total_deleted_memories || 0,
    deletedInsights: data?.total_deleted_insights || 0,
    deletedRecordings,
    failedRecordings,
  }, 'Retention cleanup completed');

  return {
    deletedMemories: data?.total_deleted_memories || 0,
    deletedInsights: data?.total_deleted_insights || 0,
    deletedRecordings,
    failedRecordings,
  };
}
```

---

## 5. Telephony Changes

### 5.1 Modified Call Summarization

**File**: `telephony/src/services/call-summarization.ts`

Add privacy checks at the beginning of the `summarizeAndExtractMemoriesFromBuffer` function:

```typescript
// Add imports at top
import { getAccountPrivacySettings, getLineVoiceConsent } from './privacy.js';

// Modify summarizeAndExtractMemoriesFromBuffer function:
export async function summarizeAndExtractMemoriesFromBuffer(buffer: EphemeralBuffer): Promise<void> {
  if (!buffer.turns.length) {
    return;
  }

  try {
    // Check if AI summarization is enabled for this account
    const privacySettings = await getAccountPrivacySettings(buffer.accountId);
    if (!privacySettings?.aiSummarizationEnabled) {
      logger.info({ accountId: buffer.accountId }, 'AI summarization disabled - skipping memory extraction');
      return;
    }

    // Check if line has granted memory consent
    const voiceConsent = await getLineVoiceConsent(buffer.lineId);
    if (voiceConsent?.memoryConsent !== 'granted') {
      logger.info({ lineId: buffer.lineId }, 'Memory consent not granted - skipping memory extraction');
      return;
    }

    // ... rest of existing implementation
  } catch (error) {
    logger.error({ error, callSessionId: buffer.callSessionId }, 'End-of-call summarization failed');
  }
}
```

### 5.2 Modified Outbound TwiML

**File**: `telephony/src/routes/twilio-outbound.ts`

Add recording disclosure before streaming:

```typescript
// Add new function for recording disclosure
export function generateRecordingDisclosureTwiML(
  callSessionId: string,
  websocketUrl: string,
  languageCode?: string
): string {
  const { voice, language } = getVoiceConfigForLanguage(languageCode);
  const streamUrl = `${websocketUrl}?callSessionId=${callSessionId}`;

  const disclosureMessage = languageCode === 'es'
    ? 'Esta llamada puede ser grabada para fines de calidad.'
    : 'This call may be recorded for quality purposes.';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="${language}">${escapeXml(disclosureMessage)}</Say>
  <Pause length="1" />
  <Connect>
    <Stream url="${streamUrl}">
      <Parameter name="callSessionId" value="${callSessionId}" />
    </Stream>
  </Connect>
</Response>`;
}
```

### 5.3 Modified Grok Bridge

**File**: `telephony/src/websocket/grok-bridge.ts`

Add consent-aware prompt building:

```typescript
// In GrokBridgeOptions interface, add:
interface GrokBridgeOptions {
  // ... existing options
  hasMemoryConsent: boolean;
  needsConsentPrompt: boolean;
}

// Add consent prompt section to system prompt when needed
private getConsentPromptSection(): string {
  return `## First Call Memory Consent

At the START of this call, you MUST ask for permission to remember things:

"Before we get started, I'd like to ask - would it be okay if I remember things you tell me?
This helps me personalize our conversations. You can say yes or no."

Based on their response:
- If they say YES or agree: Call the grant_memory_consent tool
- If they say NO or decline: Call the deny_memory_consent tool

Do NOT store any memories until you receive explicit consent.`;
}

// Modify buildSystemPrompt to include consent prompt when needed
private buildSystemPrompt(overrides?: { memories?: Memory[] }): string {
  // ... existing code

  // Add consent prompt if needed
  if (this.options.needsConsentPrompt) {
    prompt += '\n\n' + this.getConsentPromptSection();
  }

  // If memory consent not granted, exclude memory-related instructions
  if (!this.options.hasMemoryConsent) {
    // Return limited prompt without memory tools
  }

  // ... rest of existing implementation
}
```

### 5.4 Voice Consent Tool

**File**: `telephony/src/routes/tools/voice-consent.ts` (new file)

```typescript
import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getCallSession } from '../../services/call-session.js';
import { updateLineVoiceConsent } from '../../services/privacy.js';
import { requireInternalAuth } from '../middleware.js';

export const voiceConsentRouter = Router();
voiceConsentRouter.use(requireInternalAuth);

voiceConsentRouter.post('/grant_memory_consent', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId } = req.body;

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.json({ success: false, error: 'Session not found' });
      return;
    }

    await updateLineVoiceConsent(lineId, session.account_id, callSessionId, {
      memoryConsent: 'granted',
    });

    logger.info({ lineId, callSessionId }, 'Memory consent granted via voice');

    res.json({
      success: true,
      message: 'Memory consent recorded. You can now remember things the user shares.',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to grant memory consent');
    res.json({ success: false, error: 'Failed to record consent' });
  }
});

voiceConsentRouter.post('/deny_memory_consent', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId } = req.body;

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.json({ success: false, error: 'Session not found' });
      return;
    }

    await updateLineVoiceConsent(lineId, session.account_id, callSessionId, {
      memoryConsent: 'denied',
    });

    logger.info({ lineId, callSessionId }, 'Memory consent denied via voice');

    res.json({
      success: true,
      message: 'Noted. Conversations will not be remembered for personalization.',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to deny memory consent');
    res.json({ success: false, error: 'Failed to record consent' });
  }
});
```

### 5.5 New Grok Tools

Add to tool definitions for consent:

```typescript
// Add to telephony/src/websocket/grok-bridge.ts tools array
{
  type: 'function',
  name: 'grant_memory_consent',
  description: 'Call when user agrees to have their conversations remembered for personalization.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
},
{
  type: 'function',
  name: 'deny_memory_consent',
  description: 'Call when user declines to have their conversations remembered.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
}
```

---

## 6. Frontend Implementation

### 6.1 Privacy Center Page

**File**: `src/app/dashboard/(app)/privacy/page.tsx` (new file)

```typescript
import { redirect } from 'next/navigation';
import getLogger from '~/core/logger';
import requireSession from '~/lib/user/require-session';
import { getUserOrganization } from '~/lib/server/organizations/get-user-organization';
import { getUltauraAccount } from '~/lib/ultaura/accounts';
import {
  getAccountPrivacySettings,
  getConsentAuditLog,
  getDataExportRequests
} from '~/lib/ultaura/privacy';
import { getLines } from '~/lib/ultaura/lines';
import { PrivacyCenterClient } from './PrivacyCenterClient';

export const metadata = {
  title: 'Privacy Center | Ultaura',
};

export default async function PrivacyCenterPage() {
  const logger = getLogger();
  const session = await requireSession();
  const organization = await getUserOrganization(session.user.id);

  if (!organization) {
    redirect('/dashboard');
  }

  const account = await getUltauraAccount(organization.id);
  if (!account) {
    redirect('/dashboard');
  }

  const [privacySettings, lines, auditLog, exportRequests] = await Promise.all([
    getAccountPrivacySettings(account.id),
    getLines(account.id),
    getConsentAuditLog(account.id, { limit: 50 }),
    getDataExportRequests(account.id),
  ]);

  return (
    <PrivacyCenterClient
      account={account}
      privacySettings={privacySettings}
      lines={lines}
      auditLog={auditLog}
      exportRequests={exportRequests}
      userId={session.user.id}
    />
  );
}
```

### 6.2 Privacy Center Client Component

**File**: `src/app/dashboard/(app)/privacy/PrivacyCenterClient.tsx` (new file)

This component includes:
- Vendor disclosure notice
- Call recording toggle
- AI memory/personalization toggle
- Data retention period selector (30/90/365 days/indefinite)
- Data export request button with status
- Data deletion button with confirmation
- Consent audit history

See full implementation in Section 4.2 of the detailed specification.

### 6.3 Modified AddLineModal

**File**: `src/app/dashboard/(app)/lines/components/AddLineModal.tsx`

Add vendor disclosure checkbox:

```typescript
// Add new state
const [vendorAcknowledged, setVendorAcknowledged] = useState(false);

// Add vendor disclosure checkbox before existing disclosures
<label className="flex items-start gap-3 cursor-pointer">
  <input
    type="checkbox"
    checked={vendorAcknowledged}
    onChange={(e) => setVendorAcknowledged(e.target.checked)}
    className="mt-1 h-4 w-4 rounded border-input accent-primary focus:ring-ring"
  />
  <span className="text-sm text-foreground">
    I understand that Ultaura uses xAI and Twilio to power voice conversations.
    Audio is processed in real-time by these services.{' '}
    <a href="/privacy" className="text-primary hover:underline" target="_blank">
      Learn more
    </a>
  </span>
</label>

// Update submit disabled condition
disabled={isLoading || !disclosure || !consent || !vendorAcknowledged}
```

### 6.4 Navigation Update

**File**: `src/app/dashboard/(app)/components/AppSidebarNavigation.tsx`

Add Privacy Center link:

```typescript
{
  label: 'Privacy',
  path: '/dashboard/privacy',
  icon: ShieldIcon,
}
```

---

## 7. API Endpoints Summary

### New Endpoints (Frontend)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/ultaura/privacy/settings` | Get account privacy settings |
| PUT | `/api/ultaura/privacy/settings` | Update privacy settings |
| POST | `/api/ultaura/privacy/vendor-ack` | Acknowledge vendor disclosure |
| GET | `/api/ultaura/privacy/audit-log` | Get consent audit log |
| POST | `/api/ultaura/privacy/export` | Request data export |
| GET | `/api/ultaura/privacy/exports` | List export requests |
| POST | `/api/ultaura/privacy/delete` | Request data deletion |

### New Endpoints (Telephony)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/tools/grant_memory_consent` | Grant voice consent for memories |
| POST | `/tools/deny_memory_consent` | Deny voice consent for memories |

---

## 8. Testing Considerations

### Unit Tests

- Privacy settings CRUD operations
- Consent audit logging
- Data export request handling
- Retention cutoff date calculations
- Voice consent state transitions

### Integration Tests

- End-to-end privacy settings update flow
- Recording disclosure in call TwiML
- Voice consent collection in first call
- Retention cleanup job execution
- Twilio recording deletion via API

### Manual Testing Checklist

- [ ] Create line with vendor disclosure acknowledgment
- [ ] Toggle recording on/off and verify calls respect setting
- [ ] Toggle AI summarization and verify memory extraction stops
- [ ] Change retention period and verify cleanup job respects it
- [ ] First call voice consent prompt appears for new lines
- [ ] Consent granted enables memory features
- [ ] Consent denied disables memory storage
- [ ] Data export generates downloadable file
- [ ] Data deletion removes memories and recordings from Twilio
- [ ] Audit log captures all consent changes
- [ ] Re-consent prompt appears in dashboard after revocation

---

## 9. Security Considerations

### Access Control

- Privacy settings accessible only by authenticated users with account access
- Audit log is append-only (no user UPDATE/DELETE policies)
- Voice consent updates only via service role from telephony
- Export downloads require authenticated session

### Data Protection

- All existing encryption (AES-256-GCM) continues for memories
- Recordings encrypted by Twilio
- Export files encrypted at rest in Supabase Storage
- IP addresses logged in audit but not exposed to regular users

### Audit Trail

- All consent changes logged with timestamp, actor, IP, user agent
- Audit log retained indefinitely regardless of retention settings
- Call session IDs linked for voice consent tracking

---

## 10. Dependencies

### External

- **Twilio Recording API**: For deleting recordings via `client.recordings(sid).remove()`
- **Supabase Storage**: For storing data export files
- **pg_cron extension**: For scheduled retention cleanup (already used for rate limit cleanup)

### Internal

- `@ultaura/types`: New privacy-related TypeScript types
- `@ultaura/prompts`: New consent tool definitions

---

## 11. File-by-File Implementation Guide

### Database Migrations (create in order)

1. `supabase/migrations/20260115000001_account_privacy_settings.sql`
2. `supabase/migrations/20260115000002_consent_audit_log.sql`
3. `supabase/migrations/20260115000003_line_voice_consent.sql`
4. `supabase/migrations/20260115000004_data_export_requests.sql`
5. `supabase/migrations/20260115000005_privacy_columns.sql`
6. `supabase/migrations/20260115000006_retention_cleanup.sql`

### Backend Files

| File | Action | Description |
|------|--------|-------------|
| `src/lib/ultaura/types.ts` | Modify | Add privacy types |
| `src/lib/ultaura/privacy.ts` | Create | Privacy server actions |
| `src/lib/ultaura/index.ts` | Modify | Export privacy functions |
| `telephony/src/services/privacy.ts` | Create | Telephony privacy service |
| `telephony/src/routes/tools/voice-consent.ts` | Create | Voice consent endpoints |
| `telephony/src/services/call-summarization.ts` | Modify | Add privacy checks |
| `telephony/src/routes/twilio-outbound.ts` | Modify | Add recording disclosure |
| `telephony/src/websocket/grok-bridge.ts` | Modify | Add consent tools and prompts |
| `telephony/src/server.ts` | Modify | Register voice consent routes |

### Frontend Files

| File | Action | Description |
|------|--------|-------------|
| `src/app/dashboard/(app)/privacy/page.tsx` | Create | Privacy Center page |
| `src/app/dashboard/(app)/privacy/PrivacyCenterClient.tsx` | Create | Privacy Center UI |
| `src/app/dashboard/(app)/lines/components/AddLineModal.tsx` | Modify | Add vendor disclosure |
| `src/app/dashboard/(app)/components/AppSidebarNavigation.tsx` | Modify | Add Privacy nav link |

### Implementation Order

1. **Phase 1: Database** - Run all 6 migrations
2. **Phase 2: Types** - Add privacy types to `types.ts`
3. **Phase 3: Backend Server Actions** - Create `privacy.ts`
4. **Phase 4: Telephony Service** - Create telephony privacy service
5. **Phase 5: Voice Consent** - Add voice consent tool and routes
6. **Phase 6: Grok Bridge** - Modify prompts and add consent handling
7. **Phase 7: Call Summarization** - Add privacy checks
8. **Phase 8: TwiML** - Add recording disclosure
9. **Phase 9: Privacy Center UI** - Create page and components
10. **Phase 10: AddLineModal** - Add vendor disclosure checkbox
11. **Phase 11: Navigation** - Add sidebar link
12. **Phase 12: Testing** - Full integration testing

---

## 12. Assumptions

1. **No existing production customers** - No data migration needed
2. **pg_cron extension available** - For scheduled retention cleanup
3. **Twilio recording deletion API available** - Standard Twilio feature
4. **Supabase Storage configured** - For data export files
5. **Single implementation phase** - All features before launch
6. **Account-level controls** - Not per-line for privacy settings
7. **Default recording disabled** - `recording_enabled` defaults to `false`
8. **Default AI summarization enabled** - `ai_summarization_enabled` defaults to `true`
9. **Default 90-day retention** - `retention_period` defaults to `'90_days'`
10. **Voice consent required** - Memory storage requires voice consent from the line

---

## 13. Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| Regulatory focus? | General privacy + HIPAA + US state laws |
| xAI handling? | Document & disclose in Privacy Policy + in-app |
| Per-account vs per-line? | Account level controls |
| Consent collection? | Both payer dashboard + voice during first call |
| Retention options? | 30, 90, 365 days, or Indefinite |
| Recording disclosure? | Always announce, Ultaura speaks it |
| Disabled behavior? | Calls work, no memory features |
| Deletion method? | Hard delete from DB and Twilio |
| Data export? | Dashboard download, metadata + memories only |
| Default retention? | 90 days |
| Phasing? | Single implementation before launch |
