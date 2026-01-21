# Privacy/Permission Model Implementation Specification

## Objective

Implement a comprehensive privacy/permission model for Ultaura that:
- Enforces senior privacy choices as non-overridable
- Ensures proper consent/tier gating for ALL payer-facing surfaces (email routes AND dashboard server actions)
- Provides clear separation between safety notifications (always allowed) and wellness/insights notifications (require consent)
- Makes private topics completely invisible to payers (not just uneditable)
- Ensures private memories (`privacy_scope='line_only'`) never appear in payer-facing content generation

## Scope

This implementation affects:
1. **Email notification routes** (weekly summary, wellness alerts, missed calls)
2. **Dashboard server actions** (insights, alerts, all data retrieval)
3. **Dashboard UI** for line settings and privacy controls
4. **Database RLS policies** and server action guards (with column-level privilege revoke)
5. **AI prompt system** for privacy phrase detection
6. **Telephony services** (pause mode enforcement, safety notifications, memory filtering)
7. **Voice tools** (new `set_insights_enabled` tool, pause mode logging)
8. **Data export service** (privacy-filtered exports)

---

## Core Principles

1. **"Family" includes the payer**: Privacy requests ("don't tell my family", "don't tell anyone") must apply to the payer and all recipients equally.

2. **Universal consent/tier gating**: Both `self` and `family_managed` user types must respect `sharing_consent` and `sharing_tier` for non-safety notifications - enforced at BOTH email routes AND dashboard server actions.

3. **Safety notifications are always allowed**: High-tier safety events always notify payer (email + optional SMS) and trusted contacts (SMS) regardless of consent status.

4. **Senior privacy choices are non-overridable**: Payers cannot directly modify senior-controlled settings - they can only request re-prompts through voice.

5. **Private topics are completely invisible**: Payers cannot see that topics are marked private. The `private_topic_codes` field must never be accessible to authenticated users (enforced via column-level privilege revoke).

6. **Pause mode = selective pause**: Suppresses family-facing outputs (emails, dashboard for family_managed) but:
   - Data collection continues for senior's benefit
   - Self users can ALWAYS view their own data (pause only affects family-facing outputs)
   - Safety events remain completely unaffected

7. **Private memories never leak**: Content generation for payer-facing artifacts (summaries, alerts) must exclude `privacy_scope='line_only'` memories from context.

---

## Deliverables Overview

1. **PERMISSIONS.md** - Complete permission matrix at repo root
2. **Sharing gate helper** - Single reusable function for consent/tier/privacy checks (with separated internal-only data)
3. **Server action lockdown** - Guards on all payer-facing data retrieval with org ownership validation
4. **Email route consent enforcement** - Gates before email delivery with explicit self-account handling
5. **Dashboard UI changes** - Remove senior-controlled field editing
6. **Column-level privilege revoke** - Hide `private_topic_codes` from authenticated users via `REVOKE SELECT(column)`
7. **Telephony pause enforcement** - Suppress ALL family-facing artifacts (weekly, wellness, missed-calls) during pause
8. **Safety notification to payer** - Email-only for v1 (SMS requires opt-in storage)
9. **Private memory filtering** - Exclude `privacy_scope='line_only'` from payer-facing generation
10. **New `set_insights_enabled` voice tool** - Dedicated tool for insights toggle
11. **Prompt updates** - Privacy phrase detection with profile wiring
12. **Pause audit logging** - End-to-end actor tracking for pause changes
13. **Data exports** - Privacy-filtered export implementation
14. **Tests** - Following existing Vitest patterns

---

## Technical Requirements

### 1. Sharing Gate Helper (Central Enforcement)

Create a single "sharing gate" helper that applies consent + tier + pause filtering. This helper must be used by ALL payer-facing surfaces.

**CRITICAL DESIGN DECISIONS:**
1. **Separated API**: Private topic codes are returned via separate internal-only function, NOT in the main gate result (prevents accidental exposure)
2. **Pause semantics**: Pause suppresses family-facing outputs, but `self` users can ALWAYS view their own data during pause
3. **Org ownership validation**: All admin client queries must validate that the current user owns the account before querying

**File**: Create `/Users/josephsilvagnoli/Ultaura/src/lib/ultaura/sharing-gate.ts`

```typescript
import { SupabaseClient } from '@supabase/supabase-js';

export type SharingTier = 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';
export type VoiceConsentStatus = 'pending' | 'granted' | 'denied';

// Internal context - NEVER expose directly to callers
interface InternalSharingGateContext {
  userType: 'self' | 'family_managed';
  sharingConsent: VoiceConsentStatus;
  sharingTier: SharingTier;
  isPaused: boolean;
  insightsEnabled: boolean;
  privateTopicCodes: string[];  // Internal only - never in public result
}

// Public result - safe to use in server action returns
export interface SharingGateResult {
  canAccessNonSafety: boolean;  // false if consent not granted (for family_managed)
  effectiveTier: SharingTier;   // tier_4 for self, actual tier for family_managed
  allowMood: boolean;           // tier_2+
  allowTopics: boolean;         // tier_3+
  allowConcerns: boolean;       // tier_4 only
  isFamilyOutputSuppressed: boolean;  // true if pause should suppress family outputs (NOT self viewing)
  isSelfUser: boolean;          // true if user_type='self'
}

/**
 * Validates that the current session owns the account.
 * MUST be called before any admin client queries with arbitrary accountId.
 */
export async function validateAccountOwnership(
  userClient: SupabaseClient,  // User-scoped client (with RLS)
  accountId: string
): Promise<boolean> {
  const { data } = await userClient
    .from('ultaura_accounts')
    .select('id')
    .eq('id', accountId)
    .maybeSingle();
  return data !== null;
}

/**
 * Fetches sharing gate context for a line.
 * Uses admin client internally but does NOT expose privateTopicCodes.
 */
export async function getSharingGate(
  adminClient: SupabaseClient,
  lineId: string,
  accountId: string
): Promise<SharingGateResult> {
  const context = await fetchInternalContext(adminClient, lineId, accountId);
  return evaluateSharingGate(context);
}

/**
 * Internal-only: Fetches private topic codes for filtering.
 * Call ONLY when you need to filter topics before returning data.
 * The result should NEVER be stored in any return object.
 *
 * CRITICAL: Must use admin/service-role client. After the column privilege
 * revoke migration, authenticated clients CANNOT read private_topic_codes.
 * Never call this with a user-scoped client.
 */
export async function getPrivateTopicCodes(
  adminClient: SupabaseClient,  // MUST be admin/service-role client
  lineId: string
): Promise<string[]> {
  const { data } = await adminClient
    .from('ultaura_insight_privacy')
    .select('private_topic_codes')
    .eq('line_id', lineId)
    .maybeSingle();
  return (data?.private_topic_codes as string[]) ?? [];
}

/**
 * Filters topics array to exclude private topics.
 * Call getPrivateTopicCodes() to get codes, use them here, then discard.
 */
export function filterPrivateTopics<T extends { code?: string; topic_code?: string }>(
  topics: T[],
  privateTopicCodes: string[]
): T[] {
  const privateSet = new Set(privateTopicCodes);
  return topics.filter(t => {
    const code = t.code || t.topic_code;
    return code ? !privateSet.has(code) : true;
  });
}

// --- Internal implementation (not exported) ---

async function fetchInternalContext(
  client: SupabaseClient,
  lineId: string,
  accountId: string
): Promise<InternalSharingGateContext> {
  // Fetch account user_type
  const { data: account } = await client
    .from('ultaura_accounts')
    .select('user_type')
    .eq('id', accountId)
    .single();

  // Fetch voice consent
  const { data: voiceConsent } = await client
    .from('ultaura_line_voice_consent')
    .select('sharing_consent, sharing_tier')
    .eq('line_id', lineId)
    .maybeSingle();

  // Fetch insight privacy (is_paused only)
  // NOTE: private_topic_codes is NOT fetched here - use getPrivateTopicCodes() separately
  const { data: privacy } = await client
    .from('ultaura_insight_privacy')
    .select('is_paused, insights_enabled')  // NO private_topic_codes
    .eq('line_id', lineId)
    .maybeSingle();

  return {
    userType: (account?.user_type ?? 'family_managed') as 'self' | 'family_managed',
    sharingConsent: (voiceConsent?.sharing_consent ?? 'pending') as VoiceConsentStatus,
    sharingTier: (voiceConsent?.sharing_tier ?? 'tier_1') as SharingTier,
    isPaused: privacy?.is_paused ?? false,
    insightsEnabled: privacy?.insights_enabled ?? true,
    privateTopicCodes: [],  // Always empty - use getPrivateTopicCodes() when needed
  };
}

function evaluateSharingGate(context: InternalSharingGateContext): SharingGateResult {
  const isSelfUser = context.userType === 'self';

  // Self users viewing their own data always get full access
  // IMPORTANT: Pause does NOT block self users from viewing their own data
  if (isSelfUser) {
    return {
      canAccessNonSafety: true,
      effectiveTier: 'tier_4',
      allowMood: true,
      allowTopics: true,
      allowConcerns: true,
      isFamilyOutputSuppressed: false,  // Self users never blocked by pause
      isSelfUser: true,
    };
  }

  // Family-managed: require consent for non-safety access
  const consentGranted = context.sharingConsent === 'granted';
  const effectiveTier = consentGranted ? context.sharingTier : 'tier_1';

  return {
    canAccessNonSafety: consentGranted,
    effectiveTier,
    allowMood: consentGranted && effectiveTier !== 'tier_1',
    allowTopics: consentGranted && (effectiveTier === 'tier_3' || effectiveTier === 'tier_4'),
    allowConcerns: consentGranted && effectiveTier === 'tier_4',
    isFamilyOutputSuppressed: context.isPaused,  // Only affects family_managed
    isSelfUser: false,
  };
}
```

### 1.1 Org Ownership Validation Pattern

**CRITICAL**: When using admin client to query by `accountId`, ALWAYS validate ownership first:

```typescript
// Pattern for server actions using admin client
export async function getWellnessAlerts(accountId: string) {
  const userClient = getSupabaseServerActionClient();
  await requireSession(userClient);

  // VALIDATE: User must own this account (RLS check)
  const ownsAccount = await validateAccountOwnership(userClient, accountId);
  if (!ownsAccount) {
    throw new Error('Access denied');
  }

  // Now safe to use admin client
  const adminClient = getSupabaseServerActionClient({ admin: true });
  // ... query with adminClient ...
}
```

---

### 2. Dashboard Server Action Consent/Tier Enforcement

**CRITICAL**: Multiple server actions currently return non-tier-gated insight data. These must be updated to use the sharing gate.

#### 2.1 Update `getWellnessAlerts`
**File**: `/Users/josephsilvagnoli/Ultaura/src/lib/ultaura/alerts.ts`

**Current State** (lines 13-61):
Returns full title/summary without any consent/tier gating.

**Required Changes**:
1. Add org ownership validation BEFORE admin client usage
2. Fetch sharing gate for each line
3. Block access if consent not granted OR family outputs suppressed
4. Apply tier-based content redaction (NO text parsing - keep tier_3 generic)

**Implementation**:
```typescript
import {
  validateAccountOwnership,
  getSharingGate,
  SharingGateResult
} from './sharing-gate';

export async function getWellnessAlerts(
  accountId: string,
  options: { limit?: number } = {}
): Promise<WellnessAlert[]> {
  const userClient = getSupabaseServerActionClient();
  await requireSession(userClient);

  // VALIDATE: User must own this account (prevents cross-account leaks with admin client)
  const ownsAccount = await validateAccountOwnership(userClient, accountId);
  if (!ownsAccount) {
    throw new Error('Access denied');
  }

  const adminClient = getSupabaseServerActionClient({ admin: true });

  // Fetch account to check user_type
  const { data: account } = await adminClient
    .from('ultaura_accounts')
    .select('user_type')
    .eq('id', accountId)
    .single();

  const isSelfUser = account?.user_type === 'self';

  // Fetch alerts with line info
  const { data: alerts, error } = await adminClient
    .from('ultaura_wellness_alerts')
    .select(`
      id,
      line_id,
      created_at,
      alert_type,
      severity,
      title,
      summary,
      acknowledged_at,
      ultaura_lines!inner(display_name, account_id)
    `)
    .eq('ultaura_lines.account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 50);

  if (error || !alerts) return [];

  // For each alert, check consent and apply tier filtering
  const filteredAlerts: WellnessAlert[] = [];

  for (const alert of alerts) {
    // Self users see all their own alerts (pause never blocks self)
    if (isSelfUser) {
      filteredAlerts.push(mapAlert(alert));
      continue;
    }

    // Family-managed: check consent/tier/pause
    const gate = await getSharingGate(adminClient, alert.line_id, accountId);

    // Block if consent not granted
    if (!gate.canAccessNonSafety) continue;

    // Block if family outputs suppressed (pause mode)
    if (gate.isFamilyOutputSuppressed) continue;

    // Apply tier-based content redaction
    const redactedAlert = redactAlertByTier(alert, gate.effectiveTier);
    if (redactedAlert) {
      filteredAlerts.push(redactedAlert);
    }
  }

  return filteredAlerts;
}

function redactAlertByTier(
  alert: RawAlert,
  tier: SharingTier
): WellnessAlert | null {
  // tier_1: No wellness alerts allowed
  if (tier === 'tier_1') return null;

  // tier_2: trend-level only, generic wellness observation
  if (tier === 'tier_2') {
    if (alert.alert_type === 'mood_drop') {
      return {
        ...mapAlert(alert),
        title: 'Mood change noted',
        summary: 'A mood trend was observed during recent calls.',
      };
    }
    // health/cognitive get generic message at tier_2
    return {
      ...mapAlert(alert),
      title: 'Wellness observation',
      summary: 'A wellness observation was noted. Consider checking in.',
    };
  }

  // tier_3: GENERIC only (no text parsing - could leak specifics)
  // If category-level alerts are desired, add structured metadata to DB schema
  if (tier === 'tier_3') {
    if (alert.alert_type === 'mood_drop') {
      return {
        ...mapAlert(alert),
        title: 'Mood change noted',
        summary: 'A mood trend was observed during recent calls.',
      };
    }
    // health/cognitive: keep generic (DO NOT parse summary text for categories)
    return {
      ...mapAlert(alert),
      title: 'Wellness observation',
      summary: 'A wellness observation was noted. Consider checking in.',
    };
  }

  // tier_4: full content (still minimum necessary, no quotes/private topics)
  return mapAlert(alert);
}
```

**Future Enhancement (Optional)**: To support category-level alerts at tier_3 without text parsing:
1. Add `alert_category` column to `ultaura_wellness_alerts` table
2. Populate category at alert creation time in telephony
3. Use stored category instead of parsing summary text

#### 2.2 Update Insight Server Actions
**File**: `/Users/josephsilvagnoli/Ultaura/src/lib/ultaura/insights.ts`

The following functions need consent/tier enforcement added:
- `getEmotionalTrends` (line 1241) - mood data, requires tier_2+
- `getMoodCalendar` (line 1313) - mood data, requires tier_2+
- `getConversationHighlights` (line 1412) - topic data, requires tier_3+
- `getMemoryActivity` (line 1558) - memory data, requires tier_4
- `getRelationshipIndicators` (line 1592) - relationship data, requires tier_4

**Implementation Pattern** (apply to each function):
```typescript
import { getSharingGate, getPrivateTopicCodes, filterPrivateTopics } from './sharing-gate';

export async function getEmotionalTrends(lineId: string): Promise<EmotionalTrends> {
  const line = await getAuthorizedLine(lineId);
  if (!line) return emptyEmotionalTrends;

  const adminClient = getSupabaseServerActionClient({ admin: true });

  // Get sharing gate
  const gate = await getSharingGate(adminClient, lineId, line.account_id);

  // Self users always see their own data (pause never blocks self)
  if (!gate.isSelfUser) {
    // Block if consent not granted
    if (!gate.canAccessNonSafety) return emptyEmotionalTrends;

    // Block if family outputs suppressed (pause mode)
    if (gate.isFamilyOutputSuppressed) return emptyEmotionalTrends;

    // Mood data requires tier_2+
    if (!gate.allowMood) return emptyEmotionalTrends;
  }

  // ... existing query logic ...
}

// For topic-based data (getConversationHighlights):
export async function getConversationHighlights(lineId: string): Promise<ConversationHighlights> {
  const line = await getAuthorizedLine(lineId);
  if (!line) return emptyHighlights;

  const adminClient = getSupabaseServerActionClient({ admin: true });
  const gate = await getSharingGate(adminClient, lineId, line.account_id);

  if (!gate.isSelfUser) {
    if (!gate.canAccessNonSafety) return emptyHighlights;
    if (gate.isFamilyOutputSuppressed) return emptyHighlights;
    if (!gate.allowTopics) return emptyHighlights;  // tier_3+ required
  }

  // Fetch data...
  const highlights = await fetchHighlights(adminClient, lineId);

  // Filter private topics - get codes, use them, then discard
  const privateCodes = await getPrivateTopicCodes(adminClient, lineId);
  const filteredTopics = filterPrivateTopics(highlights.topics, privateCodes);
  // privateCodes is discarded here - never stored in return object

  return {
    ...highlights,
    topics: filteredTopics,
  };
}
```

#### 2.3 Remove `private_topic_codes` from Returns
**File**: `/Users/josephsilvagnoli/Ultaura/src/lib/ultaura/insights.ts`

**Current State**:
- `getInsightPrivacy` (line 514) returns entire row including `private_topic_codes`
- `getInsightsDashboard` (line 1191) returns `privateTopicCodes`

**Required Changes**:
1. `getInsightPrivacy` - Remove `private_topic_codes` from returned object (or don't call it from dashboard)
2. `getInsightsDashboard` - Remove `privateTopicCodes` from return object

```typescript
// In getInsightsDashboard, remove this line:
// privateTopicCodes: (privacy?.private_topic_codes as string[]) || [],

// Also remove it from the InsightsDashboard type
```

---

### 3. Server Action Guards for Senior-Controlled Fields

**CRITICAL**: `updateInsightPrivacy` uses admin client, so DB triggers won't prevent payer writes. Must add application-level guards.

#### 3.1 Lock Down `updateInsightPrivacy`
**File**: `/Users/josephsilvagnoli/Ultaura/src/lib/ultaura/insights.ts`

**Current State** (lines 1721-1737):
Accepts any `Partial<InsightPrivacyRow>` including `private_topic_codes` and `insights_enabled`.

**Required Changes**:
1. Add explicit allowlist of fields payers can update
2. Block `private_topic_codes` and `insights_enabled` from payer updates
3. Self users can update `insights_enabled` directly

```typescript
// Payer-allowed fields (non-senior-controlled)
const PAYER_ALLOWED_FIELDS = ['is_paused', 'paused_at', 'paused_reason'] as const;

// Senior-controlled fields (voice-only)
const SENIOR_CONTROLLED_FIELDS = ['private_topic_codes', 'insights_enabled'] as const;

export async function updateInsightPrivacy(
  lineId: string,
  settings: Partial<InsightPrivacyRow>
): Promise<void> {
  const line = await getAuthorizedLine(lineId);
  if (!line) {
    throw new Error('Line not found');
  }

  // Fetch account to check user_type
  const client = await getAdminClient();
  const { data: account } = await client
    .from('ultaura_accounts')
    .select('user_type')
    .eq('id', line.account_id)
    .single();

  const isSelfUser = account?.user_type === 'self';

  // Filter settings based on user type
  const allowedSettings: Partial<InsightPrivacyRow> = {};

  for (const [key, value] of Object.entries(settings)) {
    if (value === undefined) continue;

    // Self users can update insights_enabled directly
    if (isSelfUser && key === 'insights_enabled') {
      allowedSettings[key] = value;
      continue;
    }

    // Check if field is senior-controlled
    if (SENIOR_CONTROLLED_FIELDS.includes(key as any)) {
      // Throw error for protected field updates - gives clear UI feedback
      // (vs silently skipping which confuses users)
      throw new Error(`Cannot update senior-controlled field: ${key}. This setting can only be changed via voice.`);
    }

    // Allow payer-controlled fields
    if (PAYER_ALLOWED_FIELDS.includes(key as any)) {
      allowedSettings[key] = value;
    }
  }

  // If no allowed updates, return early
  if (Object.keys(allowedSettings).length === 0) {
    return;
  }

  const base = await fetchInsightPrivacyBase(client, lineId);
  await upsertInsightPrivacy(client, lineId, { ...base, ...allowedSettings });
}
```

---

### 4. Private Topic Complete Invisibility (DB Layer Enforcement)

**CRITICAL**: Server-action-only enforcement is NOT sufficient. An authenticated user can query `ultaura_insight_privacy.private_topic_codes` directly via Supabase client. We MUST use DB-layer enforcement.

#### 4.1 Column-Level Privilege Revoke (Preferred Approach)
**File**: Create `supabase/migrations/YYYYMMDDHHMMSS_private_topic_invisibility.sql`

```sql
-- Migration: Make private_topic_codes inaccessible to authenticated users
--
-- Strategy: Use column-level privilege revoke.
-- This keeps RLS working normally while hiding just the private_topic_codes column.

-- Revoke SELECT on the specific column from authenticated users
-- They can still read all other columns via RLS
REVOKE SELECT(private_topic_codes) ON ultaura_insight_privacy FROM authenticated;

-- EXPLICIT: Grant service_role SELECT on private_topic_codes
-- (Service role may already have access, but this makes it explicit for safety)
GRANT SELECT(private_topic_codes) ON ultaura_insight_privacy TO service_role;

-- Add comment for documentation
COMMENT ON COLUMN ultaura_insight_privacy.private_topic_codes IS
  'Senior-controlled private topics. Column access REVOKED from authenticated role. '
  'Only service_role (telephony, admin) can read this column.';
```

**CRITICAL POST-MIGRATION REQUIREMENT**: Any code using `select('*')` on `ultaura_insight_privacy` with the authenticated role will **FAIL** after this migration. All dashboard/server action queries must be updated to use explicit column lists BEFORE deploying this migration.

#### 4.2 Update Application Queries

**Dashboard/Server Actions** (authenticated context):
- STOP using `select('*')` on `ultaura_insight_privacy`
- Explicitly select only allowed columns

**Files to Update**:
```typescript
// Before (would fail after migration):
const { data } = await userClient
  .from('ultaura_insight_privacy')
  .select('*')  // Would error: permission denied for column private_topic_codes
  .eq('line_id', lineId);

// After (safe):
const { data } = await userClient
  .from('ultaura_insight_privacy')
  .select('id, line_id, insights_enabled, is_paused, paused_at, paused_reason')  // Explicit columns
  .eq('line_id', lineId);
```

**Telephony/Admin Operations** (service role context):
- Continue using `select('*')` or explicit columns including `private_topic_codes`
- Service role has full column access

#### 4.3 Combined Enforcement

The full protection comes from BOTH layers:
1. **DB Layer**: Authenticated users cannot SELECT `private_topic_codes` column (column privilege revoked)
2. **Server Action Layer**: `getPrivateTopicCodes()` uses admin client, never exposed in returns

---

### 5. Email Route Consent Enforcement

**CRITICAL**: All email routes must handle:
1. Self-account emails (billing email to self user) - ALWAYS allowed for non-safety
2. Family-managed account emails - require consent + not paused
3. Added recipients - require consent + not paused (for both self and family_managed)

#### 5.1 Email Route Decision Matrix

| User Type | Recipient Type | Consent Required? | Pause Blocks? |
|-----------|----------------|-------------------|---------------|
| self | Billing email (self) | No | No |
| self | Added recipients | Yes | Yes |
| family_managed | Billing email (payer) | Yes | Yes |
| family_managed | Added recipients | Yes | Yes |

**Safety emails (Section 6) bypass ALL gates.**

#### 5.2 Weekly Summary Route
**File**: `/Users/josephsilvagnoli/Ultaura/src/app/api/telephony/weekly-summary/route.ts`

**Current State** (lines 158-164):
Bypasses consent for `family_managed` users.

**Required Changes**:
1. Self user billing email: always send (no consent/pause gate)
2. Family-managed billing email: require consent AND not paused
3. All added recipients: require consent AND not paused

```typescript
// Fetch voice consent AND insight privacy
const { data: voiceConsent } = await supabase
  .from('ultaura_line_voice_consent')
  .select('sharing_consent, sharing_tier')
  .eq('line_id', payload.lineId)
  .maybeSingle();

const { data: privacy } = await supabase
  .from('ultaura_insight_privacy')
  .select('is_paused')
  .eq('line_id', payload.lineId)
  .maybeSingle();

const sharingConsent = voiceConsent?.sharing_consent ?? 'pending';
const isPaused = privacy?.is_paused ?? false;
const isSelfUser = account.user_type === 'self';

// Determine who can receive emails
const canSendToBillingEmail = isSelfUser || (sharingConsent === 'granted' && !isPaused);
const canSendToRecipients = sharingConsent === 'granted' && !isPaused;

// If no one can receive, skip entirely
if (!canSendToBillingEmail && !canSendToRecipients) {
  return NextResponse.json({ success: true, skipped: 'no_eligible_recipients' });
}

// Build recipient list
const recipients: string[] = [];

if (canSendToBillingEmail) {
  recipients.push(account.billing_email);
}

if (canSendToRecipients) {
  const addedRecipients = await getConfirmedRecipients(supabase, account.id);
  recipients.push(...addedRecipients.map(r => r.email));
}

// Apply tier filtering to content for all recipients
const sharingTier = voiceConsent?.sharing_tier ?? 'tier_1';
// ... tier-based content filtering ...
```

#### 5.3 Wellness Alerts Route
**File**: `/Users/josephsilvagnoli/Ultaura/src/app/api/telephony/wellness-alerts/route.ts`

**Required Changes**:
1. Self user billing email: always send
2. Family-managed: require consent AND not paused
3. All recipients: require consent AND not paused
4. Apply tier filtering (keep tier_3 generic - no text parsing)

```typescript
const isSelfUser = account.user_type === 'self';
const sharingConsent = voiceConsent?.sharing_consent ?? 'pending';
const isPaused = privacy?.is_paused ?? false;

// Determine eligibility
const canSendToBillingEmail = isSelfUser || (sharingConsent === 'granted' && !isPaused);
const canSendToRecipients = sharingConsent === 'granted' && !isPaused;

if (!canSendToBillingEmail && !canSendToRecipients) {
  return NextResponse.json({ success: true, skipped: 'no_eligible_recipients' });
}

// Apply tier filtering (required even for self - minimum necessary)
const sharingTier = voiceConsent?.sharing_tier ?? 'tier_1';

// tier_1: No wellness alerts (unless self user who always gets full tier_4)
const effectiveTier = isSelfUser ? 'tier_4' : sharingTier;
if (effectiveTier === 'tier_1') {
  return NextResponse.json({ success: true, skipped: 'tier_restricted' });
}

// Redact content based on tier (NO text parsing - keep tier_3 generic)
const { title, summary } = redactAlertContentByTier(
  payload.alertType,
  payload.title,
  payload.summary,
  effectiveTier
);
```

#### 5.4 Missed Calls Route
**File**: `/Users/josephsilvagnoli/Ultaura/src/app/api/telephony/missed-calls/route.ts`

```typescript
const isSelfUser = account.user_type === 'self';
const sharingConsent = voiceConsent?.sharing_consent ?? 'pending';
const isPaused = privacy?.is_paused ?? false;

// Self user billing email: always send
// Family-managed: require consent AND not paused
const canSendToBillingEmail = isSelfUser || (sharingConsent === 'granted' && !isPaused);

if (!canSendToBillingEmail) {
  return NextResponse.json({ success: true, skipped: 'consent_or_pause_blocked' });
}

// Missed calls are tier_1 compatible (call stats only, no memory/topic content)
```

---

### 6. Safety Notification to Payer

**CRITICAL GAP**: Currently only trusted contacts receive SMS. Payer must also be notified.

**V1 SCOPE**: Email only for payer notification. SMS to payer requires opt-in storage (phone number + preference), which is deferred to v2.

#### 6.1 Current Safety Pipeline

**Entry Point**: `telephony/src/routes/tools/safety-event.ts`

At line 278-285, after verifier confirms a high-tier safety event:
```typescript
if (verifierResult.decision === 'confirm') {
  await notifyTrustedContacts({
    accountId,
    callSessionId,
    lineId,
    tier: 'high',
    actionTaken,
  });
}
```

**Required Change**: Add payer email notification alongside trusted contact SMS:
```typescript
if (verifierResult.decision === 'confirm') {
  // Existing: SMS to trusted contacts
  await notifyTrustedContacts({
    accountId,
    callSessionId,
    lineId,
    tier: 'high',
    actionTaken,
  });

  // NEW: Email to payer (always, bypasses consent/pause)
  await notifyPayerSafetyEmail({
    accountId,
    lineId,
    tier: 'high',
    actionTaken,
  });
}
```

#### 6.2 Create Payer Safety Email Function
**File**: `/Users/josephsilvagnoli/Ultaura/telephony/src/services/safety-notifications.ts`

Add alongside existing `notifyTrustedContacts`:

```typescript
export async function notifyPayerSafetyEmail(
  options: {
    accountId: string;
    lineId: string;
    tier: 'high';
    actionTaken: string;
  }
): Promise<void> {
  const supabase = getSupabaseClient();

  // Fetch account and line info
  const { data: account } = await supabase
    .from('ultaura_accounts')
    .select('billing_email')
    .eq('id', options.accountId)
    .single();

  const { data: line } = await supabase
    .from('ultaura_lines')
    .select('display_name')
    .eq('id', options.lineId)
    .single();

  if (!account?.billing_email) {
    logger.warn({ accountId: options.accountId }, 'No billing email for safety alert');
    return;
  }

  // Map action to description (minimum necessary)
  const actionDescription = mapActionToDescription(options.actionTaken);

  // Send email via internal API
  try {
    await fetch(`${process.env.ULTAURA_APP_URL}/api/telephony/safety-alert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': process.env.ULTAURA_INTERNAL_API_SECRET!,
      },
      body: JSON.stringify({
        email: account.billing_email,
        lineName: line?.display_name || 'Your loved one',
        severity: options.tier,
        actionTaken: actionDescription,
        dashboardUrl: `${process.env.ULTAURA_APP_URL}/dashboard/alerts`,
      }),
    });
  } catch (error) {
    logger.error({ error, accountId: options.accountId }, 'Failed to send safety email to payer');
  }
}

function mapActionToDescription(action: string): string {
  switch (action) {
    case 'suggested_988': return 'We suggested calling the 988 crisis line';
    case 'suggested_911': return 'We suggested calling 911';
    default: return 'We provided support during the call';
  }
}
```

#### 6.3 V2: Payer Safety SMS (Future)

**Schema Required** (not in v1):
```sql
-- Add to ultaura_accounts for payer safety SMS opt-in
ALTER TABLE ultaura_accounts
  ADD COLUMN safety_sms_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN safety_sms_phone text;  -- E.164 format
```

**UI Required**: Single toggle + phone input in Account Settings

**Implementation**: When `safety_sms_enabled = true` and `safety_sms_phone` is set, send SMS alongside email for high-severity safety events.

#### 6.4 Create Safety Alert Email Route
**File**: Create `/Users/josephsilvagnoli/Ultaura/src/app/api/telephony/safety-alert/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { render } from '@react-email/render';
import { SafetyAlertEmail } from '~/lib/emails/safety-alert';
import { sendEmail } from '~/lib/email';

export async function POST(request: NextRequest) {
  // Validate webhook secret
  const secret = request.headers.get('X-Webhook-Secret');
  if (secret !== process.env.ULTAURA_INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await request.json();

  const html = await render(
    SafetyAlertEmail({
      lineName: payload.lineName,
      severity: payload.severity,
      actionTaken: payload.actionTaken,
      dashboardUrl: payload.dashboardUrl,
    })
  );

  await sendEmail({
    to: payload.email,
    subject: `Ultaura Safety Alert: ${payload.lineName} may need support`,
    html,
  });

  return NextResponse.json({ success: true });
}
```

#### 6.5 Create Safety Alert Email Template
**File**: Create `/Users/josephsilvagnoli/Ultaura/src/lib/emails/safety-alert.tsx`

```typescript
// Minimum necessary content - no insight details
export function SafetyAlertEmail({
  lineName,
  severity,
  actionTaken,
  dashboardUrl,
}: SafetyAlertEmailProps) {
  return (
    <Html>
      <Body>
        <Container>
          <Heading>Ultaura Safety Alert</Heading>
          <Text>
            <strong>{lineName}</strong> may need your support.
          </Text>
          <Text>
            During their recent call, {actionTaken.toLowerCase()}.
          </Text>
          <Text>
            <strong>Recommended action:</strong> Please reach out and check in with them.
          </Text>
          <Button href={dashboardUrl}>View in Dashboard</Button>
          <Hr />
          <Text style={{ fontSize: '12px', color: '#666' }}>
            Safety alerts are always sent regardless of notification preferences.
            This is not medical advice - please contact emergency services if needed.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

---

### 7. Pause Mode Enforcement (Complete)

**Policy**: Selective pause - suppress ALL family-facing outputs, but data collection continues for senior's benefit and safety.

#### 7.1 Pause Mode Scope

| Artifact | Paused Behavior | Enforcement Point |
|----------|-----------------|-------------------|
| Weekly summaries | Suppressed | `weekly-summary.ts` |
| Wellness alerts | Suppressed | `wellness-alerts.ts` |
| Missed call emails | Suppressed | `missed-calls/route.ts` |
| Dashboard data (family) | Suppressed | Server actions via gate |
| Dashboard data (self) | **NOT suppressed** | Server actions via gate |
| Safety notifications | **NOT suppressed** | `safety-notifications.ts` |
| Data collection | **NOT suppressed** | All insight tools |

#### 7.2 Weekly Summary Generation
**File**: `/Users/josephsilvagnoli/Ultaura/telephony/src/services/weekly-summary.ts`

**Current State** (line 1071):
Only checks `insights_enabled`, not `is_paused`.

**Required Change**:
```typescript
// Line 1071 - Add is_paused check
if (privacy?.insights_enabled === false || privacy?.is_paused) {
  return;  // Skip weekly summary when disabled OR paused
}
```

#### 7.3 Wellness Alert Generation
**File**: `/Users/josephsilvagnoli/Ultaura/telephony/src/services/wellness-alerts.ts`

**Current State** (line 176):
Already checks `is_paused` - no change needed.

#### 7.4 Missed Call Alert Generation

Missed call flow has two enforcement points:

**1. Telephony Detection** (increment counter + trigger check):
- **File**: `/Users/josephsilvagnoli/Ultaura/telephony/src/services/call-session.ts`
- **Function**: `updateLineAfterCall()` (lines 85-158) - detects missed calls via `isMissedCall()`, increments `consecutive_missed_calls`, calls `checkMissedCallAlert()`
- **File**: `/Users/josephsilvagnoli/Ultaura/telephony/src/services/weekly-summary.ts`
- **Function**: `checkMissedCallAlert()` - triggers email via internal API call

**2. Email Route** (delivery):
- **File**: `/Users/josephsilvagnoli/Ultaura/src/app/api/telephony/missed-calls/route.ts`
- This is where pause/consent check should be enforced

**Required Changes**:

Option A: Check in `checkMissedCallAlert()` before calling email API:
```typescript
// In telephony/src/services/weekly-summary.ts checkMissedCallAlert()
const { data: privacy } = await supabase
  .from('ultaura_insight_privacy')
  .select('is_paused')
  .eq('line_id', lineId)
  .maybeSingle();

const { data: account } = await supabase
  .from('ultaura_accounts')
  .select('user_type')
  .eq('id', accountId)
  .single();

// Skip email trigger if paused (family_managed only - self always receives)
if (account?.user_type === 'family_managed' && privacy?.is_paused) {
  return; // Don't trigger missed call notification
}
```

Option B: Check in `missed-calls/route.ts` (see Section 5.4)

#### 7.5 Data Collection (Keep Active)
The following should continue during pause (for senior's benefit):
- `log-call-insights.ts` - Keep collecting (senior can review)
- `log-mood-snapshot.ts` - Keep collecting
- `log-cognitive-observation.ts` - Keep collecting
- `log-health-mention.ts` - Keep collecting (but alerts suppressed)

Safety events remain completely unaffected by pause mode.

#### 7.6 Dashboard Surface Pause Checklist

**CRITICAL**: Every payer-facing dashboard endpoint must check `isFamilyOutputSuppressed` from the sharing gate. Self users viewing their own data are NEVER blocked.

| Dashboard Surface | File/Function | Pause Check Required |
|-------------------|---------------|---------------------|
| **Insights Dashboard** | `getInsightsDashboard()` | Yes (family_managed only) |
| **Emotional Trends** | `getEmotionalTrends()` | Yes (family_managed only) |
| **Mood Calendar** | `getMoodCalendar()` | Yes (family_managed only) |
| **Conversation Highlights** | `getConversationHighlights()` | Yes (family_managed only) |
| **Memory Activity** | `getMemoryActivity()` | Yes (family_managed only) |
| **Relationship Indicators** | `getRelationshipIndicators()` | Yes (family_managed only) |
| **Wellness Alerts List** | `getWellnessAlerts()` | Yes (family_managed only) |
| **Line Insights Page** | `getLineInsights()` | Yes (family_managed only) |
| **Weekly Summary View** | `getWeeklySummary()` | Yes (family_managed only) |
| **Call History** | `getCallSessions()` | No (call metadata is tier_1) |
| **Usage Dashboard** | `getUsageSummary()` | No (billing data exempt) |

**Implementation Pattern**:
```typescript
// In each affected server action:
const gate = await getSharingGate(adminClient, lineId, accountId);

// Self users always see their own data
if (!gate.isSelfUser && gate.isFamilyOutputSuppressed) {
  return emptyResult;  // Return empty, not error
}
```

---

### 8. New `set_insights_enabled` Voice Tool

#### 8.1 Create Tool Handler
**File**: Create `/Users/josephsilvagnoli/Ultaura/telephony/src/routes/tools/set-insights-enabled.ts`

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseClient } from '../../services/supabase';
import { logConsentAuditEvent } from '../../services/privacy';

const SetInsightsEnabledSchema = z.object({
  callSessionId: z.string().uuid(),
  lineId: z.string().uuid(),
  accountId: z.string().uuid(),
  enabled: z.boolean(),
});

const router = Router();

router.post('/set_insights_enabled', async (req, res) => {
  const parsed = SetInsightsEnabledSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const { callSessionId, lineId, accountId, enabled } = parsed.data;
  const supabase = getSupabaseClient();

  // Fetch current state
  const { data: current } = await supabase
    .from('ultaura_insight_privacy')
    .select('insights_enabled')
    .eq('line_id', lineId)
    .maybeSingle();

  const oldValue = current?.insights_enabled ?? true;

  // Update insights_enabled
  const { error } = await supabase
    .from('ultaura_insight_privacy')
    .upsert({
      line_id: lineId,
      insights_enabled: enabled,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'line_id' });

  if (error) {
    return res.status(500).json({ error: 'Failed to update insights setting' });
  }

  // Clear reprompt flag if set
  await supabase
    .from('ultaura_line_voice_consent')
    .update({ insights_reprompt_requested_at: null })
    .eq('line_id', lineId);

  // Log audit event
  await logConsentAuditEvent({
    accountId,
    lineId,
    callSessionId,
    actorType: 'line_voice',
    action: 'insights_enabled_changed',
    oldValue: { insights_enabled: oldValue },
    newValue: { insights_enabled: enabled },
  });

  return res.json({
    success: true,
    message: enabled
      ? "I'll continue noting things from our conversations to help personalize our chats."
      : "I'll stop noting things from our conversations. Your privacy is important.",
  });
});

export default router;
```

#### 8.2 Add Tool Definition
**File**: `/Users/josephsilvagnoli/Ultaura/packages/prompts/src/tools/definitions.ts`

```typescript
{
  name: 'set_insights_enabled',
  description: 'Enable or disable insights collection for the senior. Call when they want to turn on/off having their conversations analyzed for personalization and family updates. This is a durable privacy setting.',
  parameters: {
    type: 'object',
    properties: {
      enabled: {
        type: 'boolean',
        description: 'true to enable insights collection, false to disable',
      },
    },
    required: ['enabled'],
  },
},
```

#### 8.3 Add Prompt Wiring for Reprompt (Complete)

**Step 1: Create Section File**
**File**: `/Users/josephsilvagnoli/Ultaura/packages/prompts/src/golden/sections/insights-consent.ts`

```typescript
export const INSIGHTS_CONSENT_SECTION = {
  tag: 'insights_consent',
  full: `## Insights Preference

If {insightsRepromptRequested} is true, the family has requested we check with {userName} about their insights preference.

Ask naturally near the end of the call:
"By the way, your family wanted me to check - would you like me to continue noting things from our conversations? This helps personalize our chats and lets them see general updates about how you're doing. You can say yes, no, or ask me to explain more."

Based on their response:
- If they agree: call set_insights_enabled with enabled=true
- If they decline: call set_insights_enabled with enabled=false
- If unsure: explain that it helps us remember their preferences and share general wellness trends with family, but no specific details or quotes

Respect their choice without pressure.`,
};
```

**Step 2: Wire Section into Profile Selection**
**File**: `/Users/josephsilvagnoli/Ultaura/packages/prompts/src/profiles/index.ts`

Add `INSIGHTS_CONSENT_SECTION` to the section list for all profiles:

```typescript
import { INSIGHTS_CONSENT_SECTION } from '../golden/sections/insights-consent';

// Add to profile sections array
const profileSections = [
  // ... existing sections ...
  INSIGHTS_CONSENT_SECTION,
];
```

**Step 3: Update Prompt Context to Supply Variable**
**File**: `/Users/josephsilvagnoli/Ultaura/telephony/src/services/prompt-context.ts`

Add `insightsRepromptRequested` to the context variables:

```typescript
export interface PromptContextVariables {
  // ... existing variables ...
  insightsRepromptRequested: boolean;
}

export async function buildPromptContext(
  supabase: SupabaseClient,
  lineId: string
): Promise<PromptContextVariables> {
  // ... existing fetches ...

  // Fetch insights reprompt status
  const { data: voiceConsent } = await supabase
    .from('ultaura_line_voice_consent')
    .select('insights_reprompt_requested_at')
    .eq('line_id', lineId)
    .maybeSingle();

  const insightsRepromptRequested = voiceConsent?.insights_reprompt_requested_at !== null;

  return {
    // ... existing variables ...
    insightsRepromptRequested,
  };
}
```

**Step 4: Register Tool in Tool Handler**
**File**: `/Users/josephsilvagnoli/Ultaura/telephony/src/routes/tools/index.ts`

```typescript
import setInsightsEnabled from './set-insights-enabled';

// Add to tool routes
router.use(setInsightsEnabled);
```

---

### 9. Fix `requestSharingRePrompt` User-Type Guard

**File**: `/Users/josephsilvagnoli/Ultaura/src/lib/ultaura/privacy.ts`

**Current State** (lines 412-497):
Missing user-type guard - should only be callable for `family_managed` accounts.

**Required Change**:
```typescript
export async function requestSharingRePrompt(
  lineId: string
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseServerActionClient();
  await requireSession(client);

  const line = await getAuthorizedLine(lineId);
  if (!line) {
    return { success: false, error: 'Line not found' };
  }

  // Fetch account to check user_type
  const adminClient = getSupabaseServerActionClient({ admin: true });
  const { data: account } = await adminClient
    .from('ultaura_accounts')
    .select('user_type')
    .eq('id', line.account_id)
    .single();

  // Only family_managed accounts need re-prompt requests
  // Self users can change their own sharing settings directly
  if (account?.user_type !== 'family_managed') {
    return { success: false, error: 'Sharing changes are managed directly for self accounts' };
  }

  // ... rest of existing logic ...
}
```

---

### 10. Dashboard UI Updates

#### 10.1 Remove Private Topic Editing
**File**: `/Users/josephsilvagnoli/Ultaura/src/app/dashboard/(app)/lines/[lineId]/settings/SettingsClient.tsx`

Remove:
- `privateTopicCodes` state
- `togglePrivateTopic` function
- Any UI rendering `privateTopicCodes`
- `private_topic_codes` from `updateInsightPrivacy` calls

#### 10.2 Convert `insights_enabled` to Request Pattern
For `family_managed` accounts only - show read-only status with "Request Change" button.
Self users can toggle directly.

```typescript
// Check if insights reprompt already requested
const insightsRepromptRequested = voiceConsent?.insights_reprompt_requested_at !== null;

{userType === 'self' ? (
  <Switch checked={insightsEnabled} onCheckedChange={setInsightsEnabled} />
) : (
  <div className="flex items-center justify-between">
    <div>
      <p>Status: {insightsEnabled ? 'Enabled' : 'Disabled'}</p>
      <p className="text-sm text-muted-foreground">
        {line.display_name} controls this setting.
      </p>
    </div>
    <Button
      variant="outline"
      onClick={handleRequestInsightsRePrompt}
      disabled={insightsRepromptRequested}
    >
      {insightsRepromptRequested ? 'Change Requested' : 'Request Change'}
    </Button>
  </div>
)}
```

---

### 11. Database Migration

**File**: Create `supabase/migrations/YYYYMMDDHHMMSS_senior_privacy_hardening.sql`

```sql
-- Migration: Senior Privacy Field Hardening
-- 1. Add reprompt/tracking columns
-- 2. Note: Server action guards handle protection (admin client bypasses triggers)

-- Add insights reprompt column
ALTER TABLE ultaura_line_voice_consent
  ADD COLUMN IF NOT EXISTS insights_reprompt_requested_at timestamptz;

-- Add recording re-enable tracking columns
ALTER TABLE ultaura_line_voice_consent
  ADD COLUMN IF NOT EXISTS recording_reenable_decline_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recording_reenable_blocked_at timestamptz;

-- Add action enum for consent audit log
DO $$
BEGIN
  -- Add new audit actions if enum exists
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ultaura_consent_audit_action') THEN
    ALTER TYPE ultaura_consent_audit_action ADD VALUE IF NOT EXISTS 'insights_enabled_changed';
    ALTER TYPE ultaura_consent_audit_action ADD VALUE IF NOT EXISTS 'pause_mode_changed';
    ALTER TYPE ultaura_consent_audit_action ADD VALUE IF NOT EXISTS 'insights_reprompt_requested';
  END IF;
END $$;

-- Note: private_topic_codes protection is handled at server action level
-- because updateInsightPrivacy uses admin client which bypasses RLS/triggers.
-- The sharing-gate helper ensures private_topic_codes is never returned to payers.
```

---

### 12. Prompt Updates for Privacy Phrase Detection

**File**: `/Users/josephsilvagnoli/Ultaura/packages/prompts/src/golden/sections/privacy-policy.ts`

See Section 4 of original spec - add explicit phrases ("don't tell anyone", Spanish equivalents) and semantic instruction.

---

### 13. Private Memory Filtering for Payer-Facing Artifacts

**CRITICAL**: Payer-facing content must NEVER directly reference `privacy_scope='line_only'` memories.

#### 13.1 What "Private Memory Disclosure" Means

| Level | Description | Status |
|-------|-------------|--------|
| **Direct** | Memory content literally included in payer-facing output | Prevented (filter before use) |
| **Reference** | Memory IDs or keys referenced in output | Prevented (filter before use) |
| **Derived** | AI output influenced by private memory in context | Prevented (sanitized insight generation - see 13.4) |

**Important**: Weekly summaries and wellness alerts are currently generated from **stored call metrics and AI observations** (mood snapshots, cognitive observations, wellness alerts logged during calls), NOT from stored memories or transcripts. The memory table is for personalization during live calls. No full transcript is stored post-call.

#### 13.2 Where Memories Are Currently Used

Examined the codebase to identify where memories flow:

| Service | Reads Memories? | Payer-Facing Output? | Action |
|---------|-----------------|----------------------|--------|
| `weekly-summary.ts` | NO (uses call data) | Yes | No change needed |
| `wellness-alerts.ts` | NO (uses call observations) | Yes | No change needed |
| `prompt-context.ts` | YES (for call context) | No (internal to AI) | Privacy marking honored |
| `exports.ts` | YES (via decrypt helper) | Yes | Filter after decrypt (Section 15) |

#### 13.3 Enforcement for Memory Retrieval

When memories ARE used for payer-facing purposes (e.g., future features), apply this pattern:

**File**: `/Users/josephsilvagnoli/Ultaura/telephony/src/services/memory.ts`

```typescript
// For any payer-facing context building
export async function fetchMemoriesForPayerContext(
  supabase: SupabaseClient,
  accountId: string,
  lineId: string
): Promise<DecryptedMemory[]> {
  const memories = await fetchDecryptedMemories(supabase, accountId, lineId, {
    active: true,
  });

  // CRITICAL: Exclude private memories from payer-facing use
  return memories.filter(m => m.privacyScope !== 'line_only');
}
```

#### 13.4 Derived Content Protection (v1)

**CRITICAL**: The hard requirement is that private memories (`privacy_scope='line_only'`) must NEVER influence payer-facing artifacts.

##### 13.4.1 Architectural Constraint: No Post-Call Re-Extraction

**Current Architecture** (verified in codebase):
- **No call data stored post-call**: Only 500-char turn summaries exist in the ephemeral buffer (`ephemeral-buffer.ts`), which is cleared at call end. No full transcript is persisted.
- **Insights generated during call**: Grok calls `log_call_insights` tool during the call, based on its current context (which includes memories)
- **Fallback extraction**: `insights-fallback.ts` uses ephemeral buffer at call end, but buffer is cleared immediately after
- **Re-extraction NOT possible**: No stored call data or buffer exists after call ends

**Implication**: We cannot "re-extract" insights with sanitized context after the fact. Protection must happen BEFORE insights are generated.

##### 13.4.2 v1 Solution: Exclude Private Memories from Prompt Context

For `family_managed` accounts, **filter private memories OUT of the prompt context** so the AI never sees them during the call. This guarantees the AI's observations (and thus insights) cannot be influenced by private memories.

**Trade-off**: Reduced personalization for seniors with private memories in family_managed accounts. This is acceptable because:
1. The guarantee of no private influence is a hard requirement
2. Most personalization comes from non-private memories
3. Private memories are still stored for the senior's records

**File**: `/Users/josephsilvagnoli/Ultaura/telephony/src/websocket/media-stream.ts`

When loading memories for the call (approximately line where `getMemoriesForLine` is called):

```typescript
// Before passing to GrokBridge, filter private memories for family_managed
let memoriesForPrompt = memories;

if (account.user_type === 'family_managed') {
  // Exclude private memories from AI context
  // This ensures insights cannot be influenced by private memories
  memoriesForPrompt = memories.filter(m => m.privacyScope !== 'line_only');

  logger.info({
    callSessionId,
    lineId,
    totalMemories: memories.length,
    filteredCount: memories.length - memoriesForPrompt.length,
  }, 'Filtered private memories from family_managed call context');
}

// Pass filtered memories to GrokBridge
const grokBridge = new GrokBridge({
  ...options,
  memories: memoriesForPrompt,  // Uses filtered memories
});
```

**Alternative Location**: `/Users/josephsilvagnoli/Ultaura/telephony/src/services/memory.ts`

Add filter parameter to `getMemoriesForLine`:

```typescript
export async function getMemoriesForLine(
  accountId: string,
  lineId: string,
  options?: {
    limit?: number;
    includeInactive?: boolean;
    excludePrivate?: boolean;  // NEW: Filter out privacy_scope='line_only'
  }
): Promise<Memory[]> {
  // ... existing code ...

  let visible = normalized.filter(isMemoryVisible);

  // NEW: Exclude private memories if requested
  if (options?.excludePrivate) {
    visible = visible.filter(m => m.privacyScope !== 'line_only');
  }

  // ... rest of scoring/sorting ...
}
```

##### 13.4.3 Defense in Depth: Topic Filtering at Read Time

Additionally, filter private topic codes when reading insights for payer-facing surfaces.

**Decrypted Insight Structure** (from `@ultaura/types` → `CallInsights`):
```typescript
interface CallInsights {
  mood_overall: 'positive' | 'neutral' | 'low';
  mood_intensity: number;  // 0-3
  engagement_score: number;  // 1-10
  social_need_level: number;  // 0-3
  topics: Array<{ code: TopicCode; weight: number }>;  // e.g., { code: 'family', weight: 0.8 }
  private_topics: TopicCode[];  // Topics marked private during THIS call
  concerns: Array<{ code: ConcernCode; severity: number; confidence: number; is_novel?: boolean }>;
  needs_follow_up: boolean;
  follow_up_reasons: FollowUpReasonCode[];
  confidence_overall: number;
}
```

**Where filtering is needed** in `/Users/josephsilvagnoli/Ultaura/src/lib/ultaura/insights.ts`:

| Function | Line | Current State | Action |
|----------|------|---------------|--------|
| `buildWeeklyInsightsData` | ~1017-1027 | ✅ Already filters via `callPrivateTopics` + stored `privateTopics` | Verify stored topics fetched via service_role |
| `getConversationHighlights` | ~1531-1536 | ❌ No filtering | Add private topic filtering |
| `getInsightsDashboard` | ~1191 | Check | Verify topics filtered before return |

**Implementation pattern** (using existing code structure):
```typescript
// In getConversationHighlights, after decrypting insights:
const privateTopicCodes = await getPrivateTopicCodes(adminClient, lineId);
const storedPrivateTopics = new Set<string>(privateTopicCodes);

// For each insight, combine stored private topics with call-specific private_topics
const callPrivateTopics = new Set<string>(insight.private_topics ?? []);
storedPrivateTopics.forEach((topic) => callPrivateTopics.add(topic));

// Filter topics
const filteredTopics = (insight.topics ?? [])
  .filter((topic) => !callPrivateTopics.has(topic.code))
  .sort((a, b) => b.weight - a.weight)
  .slice(0, 3);
```

##### 13.4.4 What If Private Memories Were In Context?

If an insight was stored BEFORE this protection was implemented (legacy data), or if the filter is bypassed:

1. **Topic filtering catches it**: Private topic codes are filtered at read time
2. **Audit logging**: Log when private topic codes appear in stored `topics` array

```typescript
// In insight retrieval for payer-facing surfaces
function sanitizeInsightTopics(
  insight: CallInsights,
  storedPrivateTopicCodes: string[],
  lineId: string  // Pass lineId for logging context
): Array<{ code: TopicCode; weight: number }> {
  // Combine stored private topics with call-specific private_topics
  const allPrivate = new Set([
    ...storedPrivateTopicCodes,
    ...(insight.private_topics ?? []),
  ]);

  const foundPrivate = (insight.topics ?? []).filter(t => allPrivate.has(t.code));
  if (foundPrivate.length > 0) {
    logger.warn({
      lineId,
      privateTopicsFound: foundPrivate.map(t => t.code),
    }, 'Private topic codes found in stored insight - filtering for payer');
  }

  return (insight.topics ?? []).filter(t => !allPrivate.has(t.code));
}
```

##### 13.4.5 Prompt Instructions (Additional Layer)

Add to the AI prompt in `/Users/josephsilvagnoli/Ultaura/packages/prompts/src/profiles/index.ts`:

```
PRIVACY RULE FOR INSIGHTS:
When logging insights via log_call_insights, do NOT include topic codes or observations that relate to topics the senior has marked as private. Focus on general well-being observations.
```

**v1 Protection Summary**:
- Private memory **content**: Never directly shown to payers ✓
- Private memory **influence**: Blocked by excluding from prompt context ✓
- Private topic **references**: Filtered at read time ✓
- Explicit AI **leakage**: Prevented via prompt instructions ✓

##### 13.4.6 Core Guarantee Statement

**All payer-facing insight views are sourced from `ultaura_call_insights` records produced during the call.** By filtering private memories (`privacy_scope='line_only'`) from the model context for `family_managed` accounts before the call begins (Section 13.4.2), we guarantee no private-memory influence enters the stored insights.

The insight generation path is:
1. `media-stream.ts` loads memories → **private memories filtered for family_managed**
2. `GrokBridge` receives filtered memories in prompt context
3. Grok observes conversation and calls `log_call_insights` tool
4. `insights.ts` → `storeCallInsights()` encrypts and stores the insight
5. Dashboard/email surfaces decrypt and display (with topic filtering for defense-in-depth)

Since the AI never sees private memories for family_managed accounts, its observations (stored as `CallInsights`) cannot be influenced by them.

#### 13.5 Verification Pattern

For any future payer-facing memory use:

```typescript
function assertNoPrivateMemories(memories: DecryptedMemory[], context: string): void {
  const privateFound = memories.some(m => m.privacyScope === 'line_only');
  if (privateFound) {
    throw new Error(`Private memory found in payer-facing context: ${context}`);
  }
}
```

---

### 14. Pause Audit Logging (End-to-End)

Pause mode changes must be logged with actor information to maintain audit trail.

**IMPORTANT**: The existing DB constraint for `actor_type` is: `('payer', 'line_voice', 'system')`.
Use `'payer'` for dashboard actions, NOT `'payer_dashboard'`.

#### 14.1 Dashboard Server Action
**File**: `/Users/josephsilvagnoli/Ultaura/src/lib/ultaura/insights.ts`

Update `setPauseMode` to log audit event:

```typescript
export async function setPauseMode(
  lineId: string,
  paused: boolean,
  reason?: string
): Promise<void> {
  const line = await getAuthorizedLine(lineId);
  if (!line) throw new Error('Line not found');

  const adminClient = getSupabaseServerActionClient({ admin: true });

  // Fetch current state
  const { data: current } = await adminClient
    .from('ultaura_insight_privacy')
    .select('is_paused')
    .eq('line_id', lineId)
    .maybeSingle();

  const oldPaused = current?.is_paused ?? false;

  // Update pause state
  await adminClient
    .from('ultaura_insight_privacy')
    .upsert({
      line_id: lineId,
      is_paused: paused,
      paused_at: paused ? new Date().toISOString() : null,
      paused_reason: paused ? reason : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'line_id' });

  // Log audit event with actor = payer (constraint: 'payer' | 'line_voice' | 'system')
  await logConsentAuditEvent(adminClient, {
    account_id: line.account_id,
    line_id: lineId,
    actor_type: 'payer',  // Dashboard = payer actor
    action: 'pause_mode_changed',
    old_value: { is_paused: oldPaused },
    new_value: { is_paused: paused, reason },
  });
}
```

#### 14.2 Voice Tool (set-pause-mode)
**File**: `/Users/josephsilvagnoli/Ultaura/telephony/src/routes/tools/set-pause-mode.ts`

```typescript
router.post('/set_pause_mode', async (req, res) => {
  const { callSessionId, lineId, accountId, paused, reason } = req.body;
  const supabase = getSupabaseClient();

  // Fetch current state
  const { data: current } = await supabase
    .from('ultaura_insight_privacy')
    .select('is_paused')
    .eq('line_id', lineId)
    .maybeSingle();

  const oldPaused = current?.is_paused ?? false;

  // Update pause state
  await supabase
    .from('ultaura_insight_privacy')
    .upsert({
      line_id: lineId,
      is_paused: paused,
      paused_at: paused ? new Date().toISOString() : null,
      paused_reason: paused ? reason : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'line_id' });

  // Log audit event with actor = line_voice (senior via voice)
  await logConsentAuditEvent(supabase, {
    account_id: accountId,
    line_id: lineId,
    call_session_id: callSessionId,
    actor_type: 'line_voice',  // Voice = line_voice actor
    action: 'pause_mode_changed',
    old_value: { is_paused: oldPaused },
    new_value: { is_paused: paused, reason },
  });

  return res.json({ success: true });
});
```

#### 14.3 Audit Log Schema Compatibility

The existing `ultaura_consent_audit_log` table has:
- `actor_type`: Constrained to `('payer', 'line_voice', 'system')`
- `action`: Uses `ultaura_consent_audit_action` enum

**Migration needed** to add new action values:
```sql
ALTER TYPE ultaura_consent_audit_action ADD VALUE IF NOT EXISTS 'pause_mode_changed';
ALTER TYPE ultaura_consent_audit_action ADD VALUE IF NOT EXISTS 'insights_enabled_changed';
```

---

### 15. Data Export Implementation

The existing export service (`telephony/src/services/exports.ts`) already handles:
- Decrypted memory export via `fetchDecryptedMemories`
- `privacyScope` is included in the output
- Call insights are NOT currently exported (encrypted, no decrypt pipeline)

#### 15.1 Export Privacy Rules

| Data Type | Export Rule | Implementation |
|-----------|-------------|----------------|
| Memories with `privacy_scope='line_only'` | **Excluded** from payer exports | Filter after decryption |
| Private topic codes | **Never included** | Not exported (metadata only) |
| Call insights | **Not exported** | No decrypt pipeline exists |
| **All memories (family_managed, no consent)** | **Excluded** | Consent gate before memory export |

#### 15.2 Export Consent Gating
**CRITICAL**: Payer-initiated exports for family_managed accounts must respect consent:

- **Self user exports**: Full access to own data
- **Family_managed with `sharing_consent = 'granted'`**: Tier-appropriate export (see 15.3)
- **Family_managed with `sharing_consent != 'granted'`**: tier_1-only export (no memories, no call insights, call metadata only)

**File**: `/Users/josephsilvagnoli/Ultaura/telephony/src/services/exports.ts`

Add consent check at the start of export processing:

```typescript
// Near the top of processExportRequest, after fetching account
const isSelfUser = account.user_type === 'self';

// For family_managed, check consent on each line
const lineConsentMap = new Map<string, { consent: string; tier: string }>();

if (!isSelfUser && lines) {
  for (const line of lines) {
    const { data: voiceConsent } = await supabase
      .from('ultaura_line_voice_consent')
      .select('sharing_consent, sharing_tier')
      .eq('line_id', line.id)
      .maybeSingle();

    lineConsentMap.set(line.id, {
      consent: voiceConsent?.sharing_consent ?? 'pending',
      tier: voiceConsent?.sharing_tier ?? 'tier_1',
    });
  }
}

function canExportLineMemories(lineId: string): boolean {
  if (isSelfUser) return true;
  const consent = lineConsentMap.get(lineId);
  return consent?.consent === 'granted';
}

function getLineExportTier(lineId: string): string {
  if (isSelfUser) return 'tier_4';
  const consent = lineConsentMap.get(lineId);
  if (consent?.consent !== 'granted') return 'tier_1';
  return consent.tier;
}
```

#### 15.3 Export Service Updates with Consent
**File**: `/Users/josephsilvagnoli/Ultaura/telephony/src/services/exports.ts`

The existing code at lines 201-218 fetches decrypted memories. Add consent AND privacy filtering:

```typescript
if (request.include_memories && lines) {
  for (const line of lines) {
    // NEW: Check consent before exporting line memories
    if (!canExportLineMemories(line.id)) {
      // Consent not granted - skip this line's memories entirely
      continue;
    }

    const decrypted = await fetchDecryptedMemories(supabase, request.account_id, line.id, {
      active: true,  // NOTE: 'active' not 'is_active' - matches existing code
    });

    for (const memory of decrypted) {
      // Check if this is a payer export and filter private memories
      const isSelfExport = account.user_type === 'self';

      // Skip line_only memories for non-self exports
      if (!isSelfExport && memory.privacyScope === 'line_only') {
        continue;
      }

      memories.push({
        lineId: memory.lineId,
        type: memory.type,
        key: memory.key,
        value: memory.value,
        createdAt: memory.createdAt,
        privacyScope: memory.privacyScope,
      });
    }
  }
}
```

#### 15.4 Tier-Based Export Content Matrix

**Current Export Implementation** (from `exports.ts`):

| Data Type | Currently Exported? | tier_1 | tier_2+ | Self User |
|-----------|---------------------|--------|---------|-----------|
| **Account info** | ✓ Always | ✓ | ✓ | ✓ |
| **Line metadata** | ✓ Always | ✓ | ✓ | ✓ |
| **Call session metadata** | ✓ (if `include_call_metadata`) | ✓ | ✓ | ✓ |
| **Consent audit log** | ✓ Always | ✓ | ✓ | ✓ |
| **Reminders** (titles encrypted) | ✓ (if `include_reminders`) | ✓ | ✓ | ✓ |
| **Memories** (non-private) | ✓ (if `include_memories`) | ✗ | ✓ (tier_4) | ✓ |
| **Private memories** (`line_only`) | ✓ (if `include_memories`) | ✗ | ✗ | ✓ |
| **Weekly summaries** | ✗ Not implemented | - | - | - |
| **Wellness alerts** | ✗ Not implemented | - | - | - |
| **Call insights** | ✗ Not implemented | - | - | - |

**Consent Gating Rules**:
- **Self user**: Full access to all exportable data
- **family_managed with consent granted**: tier_4 access (memories excluding `line_only`)
- **family_managed without consent**: tier_1 only - NO memories, metadata only

**Implementation Notes**:
- Reminders: Title decryption may fail (indicated by `title_decryption_failed: true`). This is existing behavior.
- Memories: Only tier_4 allows memory export; lower tiers get no memories regardless of consent.
- Weekly summaries/wellness alerts/call insights: Currently not included in export schema. Future enhancement if needed.

#### 15.4.1 Export Metadata (Always Included)

These are always included regardless of consent (tier_1 compatible):
- Account info (id, createdAt, plan, status)
- Line metadata (id, displayName, phoneNumber, timezone, createdAt, preferences)
- Call session metadata (lineId, startedAt, duration, endReason, language) - no insight content
- Consent audit log (all consent actions)
- Reminders (with encrypted titles - decryption may fail)

#### 15.5 What's NOT Exported

The current export does NOT include:
- `ultaura_call_insights` (encrypted, would need decrypt+redact pipeline)
- `ultaura_insight_privacy.private_topic_codes` (not in export schema)
- Topic-level data from insights

**Future Enhancement**: If call insights export is needed:
1. Create `fetchDecryptedInsights` helper
2. Filter private topics from decrypted insights
3. Redact any content matching private topic codes

---

## PERMISSIONS.md Structure

Create `/Users/josephsilvagnoli/Ultaura/PERMISSIONS.md` with corrected enforcement points:

```markdown
# Ultaura Permission Matrix

## Enforcement Architecture

**Important**: RLS policies in this repo gate by account/organization access, NOT by sharing consent/tier. Consent and tier enforcement happens at:
1. **Server Actions** - Primary enforcement via `sharing-gate.ts` helper
2. **Email Routes** - Consent checks before email delivery
3. **Telephony Services** - Pause mode and consent checks at generation time

## Data Type Permissions

### Call Insights
| Actor | Permission | Enforcement Points |
|-------|------------|-------------------|
| Senior (voice) | Read/Write | Telephony tools (service role) |
| Payer | Consent+Tier gated read | `getInsightsDashboard()` server action, `sharing-gate.ts` |
| Org Members | Same as Payer | Server action checks (same session context) |
| Recipients | Consent+Tier gated (email only) | Email route checks |

### Wellness Alerts
| Actor | Permission | Enforcement Points |
|-------|------------|-------------------|
| Payer | Consent+Tier gated, pause-gated | `getWellnessAlerts()` server action, `wellness-alerts/route.ts` |
| Recipients | Consent+Tier gated | Email route checks |

### Safety Events
| Actor | Permission | Enforcement Points |
|-------|------------|-------------------|
| Payer | Always notified (email) | `safety-notifications.ts` -> `safety-alert/route.ts` |
| Trusted Contacts | Always notified (SMS) | `notifyTrustedContacts()` |

### Private Topics (`private_topic_codes`)
| Actor | Permission | Enforcement Points |
|-------|------------|-------------------|
| Senior | Write (via voice) | `mark-topic-private` tool (service role) |
| Payer | **None** (completely invisible) | Never returned from server actions |
| Org Members | **None** | Never returned from server actions |

### Senior-Controlled Settings (Non-Overridable)

These settings can ONLY be modified by the senior via voice tools:
1. `ultaura_insight_privacy.private_topic_codes` - `mark_topic_private` tool
2. `ultaura_insight_privacy.insights_enabled` - `set_insights_enabled` tool
3. `ultaura_topic_exclusions.excluded` - `exclude_topic` / `include_topic` tools
4. `ultaura_memories.privacy_scope` - `mark_private` tool
5. `ultaura_line_voice_consent.sharing_consent` - `sharing_consent` tool
6. `ultaura_line_voice_consent.sharing_tier` - `sharing_consent` tool
7. `ultaura_line_voice_consent.recording_consent` - `recording_consent` tool

**Enforcement**: Server action guards in `updateInsightPrivacy()` block payer writes to protected fields.
```

---

## Testing Requirements

### Test Framework
- Use Vitest (existing framework)
- Tests in `src/lib/ultaura/__tests__/` for server actions
- Tests in `telephony/src/__tests__/` for telephony services
- No API route handler tests (no existing harness)

### Recommended Tests

#### 1. Sharing Gate Helper Tests
**File**: `src/lib/ultaura/__tests__/sharing-gate.test.ts`

```typescript
import { filterPrivateTopics } from '../sharing-gate';

// Note: evaluateSharingGate is internal, test via integration tests
// Test the public filterPrivateTopics function

describe('filterPrivateTopics', () => {
  it('removes private topics from array', () => {
    const topics = [
      { code: 'family', weight: 0.8 },
      { code: 'health', weight: 0.6 },
      { code: 'hobbies', weight: 0.4 },
    ];

    const filtered = filterPrivateTopics(topics, ['family', 'health']);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].code).toBe('hobbies');
  });

  it('handles empty private codes', () => {
    const topics = [{ code: 'family', weight: 0.8 }];
    const filtered = filterPrivateTopics(topics, []);
    expect(filtered).toHaveLength(1);
  });
});
```

#### 2. Server Action Guard Tests
**File**: `src/lib/ultaura/__tests__/privacy-guards.test.ts`

Test that `updateInsightPrivacy` blocks payer writes to protected fields.

#### 3. Alert Tier Redaction Tests
**File**: `src/lib/ultaura/__tests__/alert-redaction.test.ts`

Test that alerts are properly redacted at each tier level (tier_3 = generic, not parsed).

#### 4. Pause Semantics Tests
**File**: `src/lib/ultaura/__tests__/pause-semantics.test.ts`

Test that self users can ALWAYS view their own data during pause.

#### 5. Private Memory Filter Tests
**File**: `telephony/src/__tests__/private-memory-filter.test.ts`

Test that `privacy_scope='line_only'` memories are excluded from payer-facing generation.

---

## Implementation Checklist

**Note**: This checklist is organized by feature area. For deployment, follow the **Deployment Order** section below (Migration Strategy) which specifies the mandatory sequencing for safe rollout.

### Phase 1: Core Infrastructure
- [ ] Create `sharing-gate.ts` helper with separated API (no private codes in result)
- [ ] Create database migration for new columns
- [ ] Add column-level privilege revoke: `REVOKE SELECT(private_topic_codes) FROM authenticated`
- [ ] Add explicit service role grant: `GRANT SELECT(private_topic_codes) TO service_role`
- [ ] Add new audit action enum values (`pause_mode_changed`, `insights_enabled_changed`)

### Phase 2: Server Action Lockdown
- [ ] Add org ownership validation (`validateAccountOwnership`) to admin client usage
- [ ] Update `updateInsightPrivacy` with field guards (throw error on protected field update)
- [ ] Update `getWellnessAlerts` with consent/tier gating + ownership check
- [ ] Update `getEmotionalTrends`, `getMoodCalendar`, etc. with gating
- [ ] Stop using `select('*')` on `ultaura_insight_privacy` (use explicit column list)
- [ ] Add user-type guard to `requestSharingRePrompt`
- [ ] Apply pause checklist to all dashboard surfaces (Section 7.6)

### Phase 3: Email Route Enforcement
- [ ] Update `weekly-summary/route.ts` with self-account carve-out
- [ ] Update `wellness-alerts/route.ts` with self-account carve-out + tier filtering
- [ ] Update `missed-calls/route.ts` with self-account carve-out

### Phase 4: Safety Notifications
- [ ] Update `safety-event.ts` to call `notifyPayerSafetyEmail` (line 279)
- [ ] Create `notifyPayerSafetyEmail` function in `safety-notifications.ts`
- [ ] Create `safety-alert/route.ts` for payer email
- [ ] Create `safety-alert.tsx` email template

### Phase 5: Telephony Updates
- [ ] Add `is_paused` check to weekly summary generation (`weekly-summary.ts`)
- [ ] Add `is_paused` check to missed call alert generation (`weekly-summary.ts` → `checkMissedCallAlert()`)
- [ ] Create `set_insights_enabled` tool with audit logging (actor_type='line_voice')
- [ ] Update `set-pause-mode` tool with audit logging (actor_type='line_voice')
- [ ] Add tool definition to prompts package
- [ ] Wire insights consent prompt section into profiles
- [ ] Update prompt-context with `insightsRepromptRequested` variable
- [ ] Register tool in tool handler index
- [ ] **Filter private memories from prompt context for family_managed** (Section 13.4):
  - [ ] Update `media-stream.ts` or `getMemoriesForLine()` to exclude `privacy_scope='line_only'` for family_managed
  - [ ] Add logging when private memories are filtered
  - [ ] Add `sanitizeInsightForPayer()` topic filtering at read time (defense in depth)

### Phase 6: Dashboard UI
- [ ] Remove private_topic_codes from SettingsClient.tsx
- [ ] Convert insights_enabled to request pattern for family_managed
- [ ] Add `requestInsightsRePrompt` server action
- [ ] Update `setPauseMode` with audit logging (actor_type='payer')

### Phase 7: Prompts
- [ ] Update privacy-policy.ts with expanded phrase detection

### Phase 8: Data Exports
- [ ] Add consent gating to exports in `exports.ts`:
  - [ ] Check `sharing_consent` per line for family_managed accounts
  - [ ] Block memory export when consent not granted (tier_1 = metadata only)
- [ ] Filter `privacy_scope='line_only'` memories after decryption for non-self exports
- [ ] Add `canExportLineMemories()` and `getLineExportTier()` helpers

### Phase 9: Documentation & Tests
- [ ] Create PERMISSIONS.md
- [ ] Add sharing gate tests
- [ ] Add server action guard tests (including error on protected field update)
- [ ] Add alert redaction tests (tier_3 = generic)
- [ ] Add pause semantics tests (self never blocked)
- [ ] Add export privacy filter tests
- [ ] Add export consent gating tests
- [ ] Add insight sanitization tests (verifySanitizedInsight)

---

## Migration Strategy

### Immediate Enforcement
All new privacy rules apply immediately to existing data.

### Deployment Order

**STRICT TWO-PHASE ROLLOUT** (order is mandatory):

---

**PHASE 1: Code Changes** (deploy and verify live BEFORE Phase 2)

| Step | Change | Files |
|------|--------|-------|
| 1.1 | Stop using `select('*')` on `ultaura_insight_privacy` | `insights.ts`, any file querying this table |
| 1.2 | Replace with explicit column list | `select('id, line_id, insights_enabled, is_paused, paused_at, paused_reason')` |
| 1.3 | Create `sharing-gate.ts` helper | New file, uses explicit columns |
| 1.4 | Add server action guards | `updateInsightPrivacy`, `getWellnessAlerts`, etc. |

**Verification**: Deploy Phase 1 to production. Confirm no errors in logs related to `ultaura_insight_privacy` queries. Only then proceed to Phase 2.

---

**PHASE 2: Database Migration** (deploy AFTER Phase 1 is verified)

| Step | Change |
|------|--------|
| 2.1 | Add new columns (insights_reprompt_requested_at, etc.) |
| 2.2 | `REVOKE SELECT(private_topic_codes) ON ultaura_insight_privacy FROM authenticated` |
| 2.3 | `GRANT SELECT(private_topic_codes) ON ultaura_insight_privacy TO service_role` |
| 2.4 | Add new audit action enum values |

**Why this order matters**: If migration runs before code changes, any `select('*')` query from authenticated users will fail with "permission denied for column private_topic_codes".

---

**PHASE 3: Remaining Changes** (can deploy in parallel with or after Phase 2)

See **Implementation Checklist** above (Phases 2-9) for the complete list. Key items:
- Server action consent/tier gating
- Email route self-account carve-outs
- Safety notification to payer (`safety-event.ts` → `notifyPayerSafetyEmail`)
- Private memory filtering for family_managed (Section 13.4)
- Dashboard UI updates
- PERMISSIONS.md
