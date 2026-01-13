# Workflow Fit Feature Specification

## Executive Summary

This specification defines the implementation of the "Workflow Fit" feature for Ultaura, enabling support for two distinct user workflows:

1. **Self User (Senior)** - Setting up Ultaura for themselves
2. **Family/Caregiver** - Setting up Ultaura for a loved one

The feature requires modifications across onboarding, navigation, database schema, server actions, weekly summaries, and a new family notification recipient system.

---

## Table of Contents

1. [Data Model Changes](#1-data-model-changes)
2. [Onboarding Flow](#2-onboarding-flow)
3. [Dashboard Navigation](#3-dashboard-navigation)
4. [Privacy and Sharing](#4-privacy-and-sharing)
5. [Family Invitation System](#5-family-invitation-system)
6. [Weekly Summaries](#6-weekly-summaries)
7. [Mode Switching](#7-mode-switching)
8. [Birthday Feature](#8-birthday-feature)
9. [Inbound Calling Toggle](#9-inbound-calling-toggle)
10. [API Changes](#10-api-changes)
11. [Implementation Plan](#11-implementation-plan)
12. [Testing Considerations](#12-testing-considerations)

---

## 1. Data Model Changes

### 1.1 ultaura_accounts Table Modifications

Add the following columns to the existing `ultaura_accounts` table:

```sql
-- Migration: 20260114000001_workflow_fit_accounts.sql

ALTER TABLE ultaura_accounts
ADD COLUMN user_type text NOT NULL DEFAULT 'family_managed'
  CHECK (user_type IN ('self', 'family_managed'));

ALTER TABLE ultaura_accounts
ADD COLUMN sharing_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE ultaura_accounts
ADD COLUMN sharing_enabled_at timestamptz;

COMMENT ON COLUMN ultaura_accounts.user_type IS
  'Workflow type: self (senior using for themselves) or family_managed (caregiver managing for loved one)';

COMMENT ON COLUMN ultaura_accounts.sharing_enabled IS
  'Whether data sharing is enabled. Self users default to false, family_managed defaults to true';

COMMENT ON COLUMN ultaura_accounts.sharing_enabled_at IS
  'Timestamp when sharing was enabled. Data before this timestamp is not shared';
```

### 1.2 New Table: ultaura_notification_recipients

Create a new table for managing family notification recipients:

```sql
-- Migration: 20260114000002_notification_recipients.sql

CREATE TABLE ultaura_notification_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  phone_e164 text,
  is_trusted_contact boolean NOT NULL DEFAULT false,
  trusted_contact_id uuid REFERENCES ultaura_trusted_contacts(id) ON DELETE SET NULL,
  -- Store hashed token for security (SHA-256 hash of the actual token)
  -- The plaintext token is sent in emails but never stored
  confirmation_token_hash text UNIQUE,
  confirmation_token_expires_at timestamptz,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_account_email UNIQUE (account_id, email)
);

CREATE INDEX idx_notification_recipients_account
  ON ultaura_notification_recipients(account_id);

CREATE INDEX idx_notification_recipients_token
  ON ultaura_notification_recipients(confirmation_token_hash)
  WHERE confirmation_token_hash IS NOT NULL;

-- RLS Policies
ALTER TABLE ultaura_notification_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notification recipients for their accounts"
  ON ultaura_notification_recipients FOR SELECT
  USING (can_access_ultaura_account(account_id));

CREATE POLICY "Users can insert notification recipients for their accounts"
  ON ultaura_notification_recipients FOR INSERT
  WITH CHECK (can_access_ultaura_account(account_id));

CREATE POLICY "Users can update notification recipients for their accounts"
  ON ultaura_notification_recipients FOR UPDATE
  USING (can_access_ultaura_account(account_id));

CREATE POLICY "Users can delete notification recipients for their accounts"
  ON ultaura_notification_recipients FOR DELETE
  USING (can_access_ultaura_account(account_id));

-- Limit to 5 recipients per account
CREATE OR REPLACE FUNCTION check_notification_recipient_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM ultaura_notification_recipients
    WHERE account_id = NEW.account_id
    AND unsubscribed_at IS NULL
  ) >= 5 THEN
    RAISE EXCEPTION 'Maximum of 5 notification recipients per account';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_notification_recipient_limit
  BEFORE INSERT ON ultaura_notification_recipients
  FOR EACH ROW EXECUTE FUNCTION check_notification_recipient_limit();

-- Note: The trigger handles the 5-recipient limit. In rare cases of concurrent inserts,
-- the application should catch the exception and display a user-friendly error message.
-- This is acceptable given low concurrency expectations for this operation.
```

### 1.3 Existing Infrastructure to Leverage

The following already exists in the database and can be used:

| Resource | Location | Status |
|----------|----------|--------|
| `ultaura_lines.inbound_allowed` | Boolean field (default: true) | Needs UI toggle |
| `ultaura_memories.privacy_scope` | Supports `line_only` and `shareable_with_payer` | Ready |
| `ultaura_memories.source` | Supports `caregiver_seed`, `payer_ack`, `line_voice` | Ready |
| `ultaura_milestones` | Full milestone system with `birthday` type support | Ready |
| `ultaura_notification_preferences` | Weekly summary settings per line | Ready |
| `ultaura_trusted_contacts` | Emergency contact system | Ready |

---

## 2. Onboarding Flow

### 2.1 User Type Selection Step (New Step 0)

Create a new component that appears as the **first step** of onboarding:

**File:** `/src/app/onboarding/components/UserTypeStep.tsx`

**UI Design:**
- Two large cards/buttons:
  1. **"For me (Senior)"** → `userType: 'self'`
  2. **"For a loved one (Family/Caregiver)"** → `userType: 'family_managed'`

```typescript
export interface UserTypeStepData {
  userType: 'self' | 'family_managed';
}
```

### 2.2 Self User Flow

Steps for `userType: 'self'`:

| Step | Component | Description |
|------|-----------|-------------|
| 0 | UserTypeStep | Choose "For me (Senior)" |
| 1 | PhoneCollectionStep | Collect user's phone number (E.164 validation) |
| 2 | BirthdayStep | Optional birthday (month/day only) |
| 3 | PlanSelectionStep | Highlight Care plan (1-line, recommended for self) |
| 4 | CompleteOnboardingStep | Create account, line, then redirect to verification |

**Key behaviors:**
- Phone NUMBER is collected and validated (E.164 format) during onboarding
- Phone VERIFICATION (Twilio SMS code) happens immediately after onboarding completes
- Line is created with `status: 'pending'` during CompleteOnboardingStep
- User is redirected to `/dashboard/lines/[shortId]/verify` after onboarding
- Organization name = user's profile display name
- Team invites step is skipped entirely
- `sharing_enabled` defaults to `false`

**Phone verification flow:**
1. User enters phone in PhoneCollectionStep (validated for E.164 format)
2. CompleteOnboardingStep creates account + line with `status: 'pending'`
3. User redirected to `/dashboard/lines/[shortId]/verify`
4. Existing verification UI sends Twilio code and verifies
5. On success, line status becomes `'active'`

### 2.3 Family/Caregiver Flow

Steps for `userType: 'family_managed'`:

| Step | Component | Description |
|------|-----------|-------------|
| 0 | UserTypeStep | Choose "For a loved one (Family/Caregiver)" |
| 1 | OrganizationInfoStep | Account/organization name |
| 2 | LovedOneSetupStep | Loved one's name, phone (E.164), timezone |
| 3 | PlanSelectionStep | Highlight Comfort/Family plans (multi-line) |
| 4 | OrganizationInvitesStep | Optional team invites |
| 5 | CompleteOnboardingStep | Complete setup |

**Key behaviors:**
- First line (loved one) is created during onboarding with `status: 'pending'`
- Loved one's phone NUMBER is collected but VERIFICATION happens in dashboard (same as current flow)
- User is redirected to `/dashboard/lines/[shortId]/verify` after onboarding
- Organization name is explicitly collected
- Team invites available for dashboard access
- `sharing_enabled` defaults to `true`

**Plan recommendations:**
- Comfort plan highlighted as "Most Popular" for single loved one
- Family plan highlighted for users mentioning multiple loved ones

### 2.4 OnboardingContainer Updates

**File:** `/src/app/onboarding/components/OnboardingContainer.tsx`

```typescript
// Updated step configuration
const SELF_USER_STEPS = [
  'onboarding:userType',
  'onboarding:phoneCollection', // Collect phone (no Twilio verification yet)
  'onboarding:birthday', // optional, can be skipped
  'onboarding:plan',
  'onboarding:complete', // Creates account + line, redirects to verify
];

const FAMILY_STEPS_WITH_INVITES = [
  'onboarding:userType',
  'onboarding:info',
  'onboarding:lovedOneSetup',
  'onboarding:plan',
  'onboarding:invites',
  'onboarding:complete',
];

const FAMILY_STEPS_NO_INVITES = [
  'onboarding:userType',
  'onboarding:info',
  'onboarding:lovedOneSetup',
  'onboarding:plan',
  'onboarding:complete',
];

// Form state additions
defaultValues: {
  data: {
    userType: null as 'self' | 'family_managed' | null,
    organization: '',
    selectedPlanId: 'comfort' as PlanId,
    invites: [] as Invite[],
    // Self user specific
    selfPhoneE164: '',
    selfBirthday: null as { month: number; day: number } | null,
    // Family user specific
    lovedOneName: '',
    lovedOnePhoneE164: '',
    lovedOneTimezone: 'America/Los_Angeles',
  },
  currentStep: 0,
}
```

### 2.5 Onboarding Complete Route Updates

**File:** `/src/app/onboarding/complete/route.ts`

Update the handler to:

1. Accept `userType` parameter from form data
2. **For self users:**
   - Use profile display name as organization/account name
   - Create line with collected phone and `status: 'pending'`
   - Add birthday milestone if provided (use `source: 'family_input'`)
   - Set `sharing_enabled: false`
   - Set `user_type: 'self'`
   - Return `lineShortId` for redirect to verification
3. **For family users:**
   - Use provided organization name
   - Create first line with loved one's info and `status: 'pending'`
   - Set `sharing_enabled: true`
   - Set `user_type: 'family_managed'`
   - Return `lineShortId` for redirect to verification

**Redirect behavior:**
```typescript
// After successful onboarding completion
const returnUrl = `/dashboard/lines/${lineShortId}/verify`;
return NextResponse.redirect(new URL(returnUrl, request.url));
```

---

## 3. Dashboard Navigation

### 3.1 Navigation Config Updates

**File:** `/src/navigation.config.tsx`

Create conditional navigation based on user type:

```typescript
export interface NavigationContext {
  userType: 'self' | 'family_managed';
  accountId: string;
}

const NAVIGATION_CONFIG = (context?: NavigationContext): NavigationConfig => {
  const isSelfUser = context?.userType === 'self';

  const items: NavigationItem[] = [
    {
      label: 'Home',
      path: getPath(''),
      Icon: Squares2X2Icon,
      end: true,
    },
    {
      label: isSelfUser ? 'My Line' : 'Lines',
      path: getPath('lines'),
      Icon: PhoneIcon,
      activeMatch: isLineRouteActive,
    },
    {
      label: 'Reminders',
      path: getPath('reminders'),
      Icon: BellIcon,
    },
    {
      label: 'Calls',
      path: getPath('calls'),
      Icon: CalendarDaysIcon,
    },
  ];

  // Only show Insights and Alerts for family/caregiver users
  if (!isSelfUser) {
    items.push(
      {
        label: 'Insights',
        path: getPath('insights'),
        Icon: EyeIcon,
      },
      {
        label: 'Alerts',
        path: getPath('alerts'),
        Icon: ExclamationTriangleIcon,
      }
    );
  }

  items.push(
    {
      label: 'Usage',
      path: getPath('usage'),
      Icon: ChartBarIcon,
    },
    {
      label: 'Privacy',
      path: getPath('privacy'),
      Icon: ShieldCheckIcon,
    },
    {
      label: 'Settings',
      collapsible: false,
      children: [
        { label: 'Profile', path: getPath('settings/profile') },
        { label: 'Subscription', path: getPath('settings/subscription') },
      ],
    }
  );

  return { items };
};
```

### 3.2 Navigation Differences Summary

| Navigation Item | Self User | Family/Caregiver |
|-----------------|-----------|------------------|
| Home | ✅ Visible | ✅ Visible |
| Lines → "My Line" | ✅ Renamed | ✅ "Lines" |
| Reminders | ✅ Visible | ✅ Visible |
| Calls | ✅ Visible | ✅ Visible |
| Insights | ❌ Hidden | ✅ Visible |
| Alerts | ❌ Hidden | ✅ Visible |
| Usage | ✅ Visible | ✅ Visible |
| Privacy | ✅ Visible | ✅ Visible |
| Settings | ✅ Visible | ✅ Visible |

### 3.3 Navigation Rendering Updates

**File:** `/src/app/dashboard/(app)/components/AppSidebarNavigation.tsx`

Filter navigation items directly in the renderer using existing hooks (no new provider needed):

```typescript
'use client';

import { useMemo } from 'react';
import { useUltauraAccount } from '~/lib/ultaura/hooks';
import { NAVIGATION_CONFIG } from '~/navigation.config';

function AppSidebarNavigation() {
  const { data: account } = useUltauraAccount();
  const userType = account?.userType ?? 'family_managed';

  const filteredItems = useMemo(() => {
    const config = NAVIGATION_CONFIG({ userType });

    if (userType === 'self') {
      // Filter out Insights and Alerts for self users
      return config.items.filter(item => {
        if ('path' in item) {
          const hiddenPaths = ['/insights', '/alerts'];
          return !hiddenPaths.some(p => item.path.includes(p));
        }
        return true;
      });
    }

    return config.items;
  }, [userType]);

  // Render filteredItems...
}
```

**Note:** This approach avoids creating a new context provider. The `useUltauraAccount()` hook should be created or the account data can be fetched in the server component layout and passed as a prop.

---

## 4. Privacy and Sharing

### 4.1 Default Settings by User Type

| Setting | Self User Default | Family/Caregiver Default |
|---------|-------------------|--------------------------|
| `user_type` | `'self'` | `'family_managed'` |
| `sharing_enabled` | `false` | `true` |
| `inbound_allowed` | `true` | `true` |
| Weekly summary | Sent to self | Sent to account holder + recipients |
| Insights page | Hidden | Visible |
| Alerts page | Hidden | Visible |

### 4.2 Sharing Toggle for Self Users

**Location:** Privacy settings page (`/dashboard/privacy`)

Add a new section for self users:

```typescript
// Only show for self users who haven't enabled sharing
{account.user_type === 'self' && !sharingEnabled && (
  <Section>
    <SectionHeader
      title="Family Sharing"
      description="Enable sharing to let family members receive updates about your wellbeing."
    />
    <SectionBody>
      <p className="text-sm text-muted-foreground">
        When enabled, you can invite family members to receive weekly summaries
        and alerts. Only data from after you enable sharing will be shared -
        your previous conversations remain private.
      </p>
      <Button onClick={handleEnableSharing}>
        Enable family sharing
      </Button>
    </SectionBody>
  </Section>
)}
```

### 4.3 Privacy Page Sections

For self users, the Privacy page should include:
- **Sharing toggle** (Enable/disable family sharing)
- **Invited family list** (when sharing enabled)
- **Data export request** (existing)
- **Delete history** (existing)
- **Consent audit log** (existing)
- **Vendor disclosures** (existing)

---

## 5. Family Invitation System

### 5.1 Overview

Family members can be invited to receive notifications (weekly summaries and alerts) without needing dashboard access or an Ultaura account.

**Key constraints:**
- Maximum 5 invited family members per account
- All invited members receive the same notifications (no per-recipient config)
- No account creation required for invited members
- Duplicate emails allowed (can have their own Ultaura account)
- Unsubscribe is silent removal (shows status in settings)

### 5.2 Invitation Flow

```
1. Account holder invites family member
   ├── Enter name and email
   ├── Optional: "Also add as emergency contact?" checkbox
   └── System generates confirmation token (expires in 7 days)

2. Email sent to invitee
   ├── Subject: "You've been invited to receive updates from [Account Name]"
   ├── Explains what they'll receive
   └── Contains confirmation link

3. Family member confirms
   ├── Clicks link → sees confirmation page
   ├── No account creation required
   ├── Sets confirmed_at timestamp
   └── If checkbox was checked → creates trusted contact

4. Ongoing
   ├── Receives weekly summaries via email
   ├── Receives alert notifications
   └── Can unsubscribe at any time via link in emails
```

### 5.3 Server Actions

**File:** `/src/lib/ultaura/notification-recipients.ts`

```typescript
'use server';

import crypto from 'crypto';

// Helper: Generate secure token and its hash
function generateSecureToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

// Helper: Hash a token for lookup
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Get all notification recipients for an account
export async function getNotificationRecipients(
  accountId: string
): Promise<NotificationRecipient[]>;

// Invite a new family member
export async function inviteNotificationRecipient(
  accountId: string,
  input: {
    name: string;
    email: string;
    addAsTrustedContact?: boolean; // Combined flow
  }
): Promise<ActionResult<NotificationRecipient>> {
  // Generate token (plaintext sent in email, hash stored in DB)
  const { token, hash } = generateSecureToken();

  // Insert with hashed token
  const { data, error } = await supabase
    .from('ultaura_notification_recipients')
    .insert({
      account_id: accountId,
      name: input.name,
      email: input.email,
      is_trusted_contact: input.addAsTrustedContact ?? false,
      confirmation_token_hash: hash, // Store hash, not plaintext
      confirmation_token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    })
    .select()
    .single();

  // Send email with plaintext token
  await sendInviteEmail({ ...input, token });

  return { success: true, data };
}

// Remove an invited family member
export async function removeNotificationRecipient(
  recipientId: string
): Promise<ActionResult<void>>;

// Confirm invitation (public - no auth, uses token)
export async function confirmNotificationRecipient(
  token: string
): Promise<ActionResult<{ accountName: string }>> {
  const tokenHash = hashToken(token);

  const { data, error } = await supabase
    .from('ultaura_notification_recipients')
    .update({ confirmed_at: new Date().toISOString() })
    .eq('confirmation_token_hash', tokenHash)
    .gt('confirmation_token_expires_at', new Date().toISOString())
    .is('confirmed_at', null)
    .select('account_id')
    .single();

  if (error || !data) {
    return { success: false, error: 'Invalid or expired token' };
  }

  // Fetch account name for confirmation page
  const { data: account } = await supabase
    .from('ultaura_accounts')
    .select('name')
    .eq('id', data.account_id)
    .single();

  return { success: true, data: { accountName: account?.name ?? 'Unknown' } };
}

// Unsubscribe (public - no auth, uses token)
export async function unsubscribeNotificationRecipient(
  token: string
): Promise<ActionResult<void>> {
  const tokenHash = hashToken(token);

  const { error } = await supabase
    .from('ultaura_notification_recipients')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('confirmation_token_hash', tokenHash);

  if (error) {
    return { success: false, error: 'Failed to unsubscribe' };
  }

  return { success: true, data: undefined };
}
```

### 5.4 API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/ultaura/invite` | POST | Sends invitation email |
| `/api/ultaura/confirm/[token]` | GET | Confirmation landing page |
| `/api/ultaura/confirm/[token]` | POST | Confirms the invitation |
| `/api/ultaura/unsubscribe/[token]` | GET | Unsubscribe landing page |
| `/api/ultaura/unsubscribe/[token]` | POST | Processes unsubscribe |

### 5.5 Email Template

**File:** `/src/lib/emails/notification-invite.tsx`

```typescript
export default function renderNotificationInviteEmail(props: {
  recipientName: string;
  accountName: string;
  lineName: string;
  inviterName: string;
  confirmLink: string;
}): string;
```

**Email content:**
- Personalized greeting
- Explanation of Ultaura service
- What they'll receive (weekly summaries, alerts)
- Clear confirmation call-to-action
- Privacy assurance

### 5.6 Combined Trusted Contact Flow

When inviting a family member, the account holder can optionally check "Also add as emergency contact". This:

1. Creates the notification recipient record
2. After confirmation, also creates a trusted contact record
3. Links the two via `trusted_contact_id` field
4. Family member receives both summaries AND safety alerts

---

## 6. Weekly Summaries

### 6.1 Current Implementation

Weekly summaries are already implemented with:
- Hourly scheduler in telephony service
- Full summary content (call stats, mood, topics, concerns, follow-ups)
- Email sending via Nodemailer
- Notification preferences per line

### 6.2 Recipient Logic Updates

**File:** `/telephony/src/services/weekly-summary.ts`

Update to send to multiple recipients based on user type:

```typescript
export async function generateWeeklySummaryForLine(line: WeeklySummaryLine): Promise<void> {
  // ... existing aggregation logic ...

  // IMPORTANT: Forward-looking data filter for self users who enabled sharing
  // Only include data created AFTER sharing was enabled
  const sharingEnabledAt = account?.sharing_enabled_at;
  const dataFilterTimestamp = (account?.user_type === 'self' && sharingEnabledAt)
    ? sharingEnabledAt
    : '1970-01-01T00:00:00Z'; // No filter for family_managed accounts

  // When fetching call insights for summary, apply the timestamp filter
  const { data: callInsights } = await supabase
    .from('ultaura_call_insights')
    .select('*')
    .eq('line_id', line.id)
    .gte('created_at', dataFilterTimestamp)
    .order('created_at', { ascending: false });

  const recipients: string[] = [];

  // Always include billing email (account holder or self user)
  if (account?.billing_email) {
    recipients.push(account.billing_email);
  }

  // For family_managed accounts OR self users with sharing enabled,
  // add confirmed notification recipients
  if (
    account?.user_type === 'family_managed' ||
    (account?.user_type === 'self' && account?.sharing_enabled)
  ) {
    const { data: notificationRecipients } = await supabase
      .from('ultaura_notification_recipients')
      .select('email')
      .eq('account_id', account.id)
      .not('confirmed_at', 'is', null)
      .is('unsubscribed_at', null);

    for (const recipient of notificationRecipients || []) {
      if (!recipients.includes(recipient.email)) {
        recipients.push(recipient.email);
      }
    }
  }

  // Send to each recipient
  for (const email of recipients) {
    await sendWeeklySummaryEmail({
      ...summary,
      billingEmail: email,
      isSelfUser: account?.user_type === 'self',
      isPrimaryRecipient: email === account?.billing_email,
    });
  }
}
```

### 6.3 Email Template Updates

**File:** `/src/lib/emails/weekly-summary.tsx`

Update to handle self-user context:

```typescript
// Different greeting for self users vs family recipients
const greeting = isSelfUser
  ? `Here's your weekly summary`
  : `Here's the weekly summary for ${lineName}`;

// Generate unsubscribe link for non-primary recipients
const unsubscribeLink = `${process.env.NEXT_PUBLIC_SITE_URL}/api/ultaura/unsubscribe/${recipientToken}`;

// Include unsubscribe link for non-primary recipients
{!isPrimaryRecipient && (
  <footer>
    <a href={unsubscribeLink}>Unsubscribe from these updates</a>
  </footer>
)}
```

**Email headers for compliance:**
```typescript
// Add List-Unsubscribe header for email clients
headers: {
  'List-Unsubscribe': `<${unsubscribeLink}>`,
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
}
```

---

## 7. Mode Switching

### 7.1 Self to Family Mode Upgrade

Self users can upgrade to family mode to unlock additional features.

**Location:** Privacy settings page (for self users only)

**Behavior:**
- One-way upgrade (self → family)
- Keeps existing line as-is (no re-verification)
- Unlocks:
  - Insights page becomes visible
  - Alerts page becomes visible
  - Can add additional lines (if plan allows)
  - Can invite family notification recipients

**Implementation:**

```typescript
// Server action
export async function upgradeSelfToFamilyMode(
  accountId: string
): Promise<ActionResult<void>> {
  const client = getSupabaseServerComponentClient();

  const { error } = await client
    .from('ultaura_accounts')
    .update({
      user_type: 'family_managed',
      sharing_enabled: true,
      sharing_enabled_at: new Date().toISOString(),
    })
    .eq('id', accountId)
    .eq('user_type', 'self'); // Only allow upgrade from self

  if (error) {
    return { success: false, error: createError(ErrorCodes.DATABASE_ERROR) };
  }

  revalidatePath('/dashboard', 'layout');
  return { success: true, data: undefined };
}
```

### 7.2 UI for Upgrade

```typescript
// In Privacy settings page
{account.user_type === 'self' && (
  <Section>
    <SectionHeader
      title="Upgrade to Family Mode"
      description="Unlock additional features for family monitoring."
    />
    <SectionBody>
      <p className="text-sm text-muted-foreground">
        Upgrading to family mode will:
      </p>
      <ul className="text-sm text-muted-foreground list-disc ml-4">
        <li>Show the Insights page with conversation analytics</li>
        <li>Show the Alerts page for wellness monitoring</li>
        <li>Allow adding additional phone lines (if your plan supports it)</li>
        <li>Enable inviting family members for notifications</li>
      </ul>
      <p className="text-sm text-muted-foreground mt-2">
        Your existing settings and data will be preserved.
      </p>
      <Button onClick={handleUpgrade} className="mt-4">
        Upgrade to Family Mode
      </Button>
    </SectionBody>
  </Section>
)}
```

---

## 8. Birthday Feature

### 8.1 Collection During Self-User Onboarding

**File:** `/src/app/onboarding/components/BirthdayStep.tsx`

```typescript
export interface BirthdayStepData {
  birthday: { month: number; day: number } | null;
}
```

**UI Design:**
- Month dropdown (January - December)
- Day input (1-31 with validation)
- "Skip" button to proceed without birthday
- Preview text: "Ultaura will celebrate your birthday with you!"

**Note:** No year is collected for privacy reasons.

### 8.2 Auto-Add to Milestones

When birthday is provided during onboarding:

```typescript
// In onboarding complete route
if (body.selfBirthday) {
  await adminClient
    .from('ultaura_milestones')
    .insert({
      account_id: accountId,
      line_id: lineId,
      milestone_type: 'birthday',
      title: 'My Birthday',
      date_month: body.selfBirthday.month,
      date_day: body.selfBirthday.day,
      is_recurring: true,
      source: 'family_input', // Using existing enum value (user-provided data)
      privacy_scope: 'line_only',
    });
}
```

**Note:** The `source` field uses `'family_input'` which is an existing enum value appropriate for user-provided data during onboarding. The existing enum values are: `'conversation'`, `'family_input'`, `'calendar_import'`.
```

### 8.3 Call Behavior

The telephony service already handles milestones. When a call occurs near a birthday milestone:
- Grok has access to milestone context
- Mentions/celebrates the birthday naturally in conversation
- May reminisce about past birthdays if user shares

---

## 9. Inbound Calling Toggle

### 9.1 Current State

The `inbound_allowed` field already exists:
- **Database column:** `ultaura_lines.inbound_allowed` (boolean, default: `true`)
- **Telephony handling:** Inbound calls check this field and reject with message if `false`
- **Missing:** UI toggle in line settings

### 9.2 UI Addition

**File:** `/src/app/dashboard/(app)/lines/[lineId]/settings/SettingsClient.tsx`

Add after voicemail settings section:

```typescript
{/* Inbound Calling */}
<div className="pt-6 border-t border-border">
  <div className="flex items-start justify-between gap-4">
    <div className="flex-1">
      <label className="flex items-center gap-2 text-sm font-medium text-foreground">
        <PhoneIncoming className="w-4 h-4 text-muted-foreground" />
        Allow Inbound Calls
      </label>
      <p className="text-sm text-muted-foreground mt-1">
        When enabled, {line.display_name} can call Ultaura to start a
        conversation at any time. Disable to only receive scheduled calls.
      </p>
    </div>
    <Switch
      checked={inboundAllowed}
      onCheckedChange={setInboundAllowed}
      disabled={disabled}
    />
  </div>
</div>
```

**State management:**

```typescript
const [inboundAllowed, setInboundAllowed] = useState(line.inbound_allowed ?? true);

// Track changes
const hasInboundChanges = inboundAllowed !== (line.inbound_allowed ?? true);

// Include in submission
if (hasLineChanges) {
  await updateLine(line.id, {
    // ... other fields
    inboundAllowed,
  });
}
```

---

## 10. API Changes

### 10.1 Type Definitions

**File:** `/src/lib/ultaura/types.ts`

```typescript
export type UserType = 'self' | 'family_managed';

export interface NotificationRecipient {
  id: string;
  accountId: string;
  name: string;
  email: string;
  phoneE164: string | null;
  isTrustedContact: boolean;
  trustedContactId: string | null;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
  createdAt: string;
}

// Update UltauraAccount interface
export interface UltauraAccount {
  // ... existing fields ...
  userType: UserType;
  sharingEnabled: boolean;
  sharingEnabledAt: string | null;
}
```

### 10.2 Updated Server Actions

**File:** `/src/lib/ultaura/accounts.ts`

```typescript
// Update getOrCreateUltauraAccount to accept userType
export async function getOrCreateUltauraAccount(
  organizationId: number,
  userId: string,
  name: string,
  email: string,
  options?: {
    userType?: 'self' | 'family_managed';
  }
): Promise<{ accountId: string; isNew: boolean }>;

// Update account sharing settings
export async function updateAccountSharing(
  accountId: string,
  sharingEnabled: boolean
): Promise<ActionResult<void>>;

// Upgrade self user to family mode
export async function upgradeSelfToFamilyMode(
  accountId: string
): Promise<ActionResult<void>>;
```

### 10.3 New Server Actions

**File:** `/src/lib/ultaura/notification-recipients.ts`

```typescript
export async function getNotificationRecipients(
  accountId: string
): Promise<NotificationRecipient[]>;

export async function inviteNotificationRecipient(
  accountId: string,
  input: {
    name: string;
    email: string;
    addAsTrustedContact?: boolean;
  }
): Promise<ActionResult<NotificationRecipient>>;

export async function removeNotificationRecipient(
  recipientId: string
): Promise<ActionResult<void>>;

export async function confirmNotificationRecipient(
  token: string
): Promise<ActionResult<{ accountName: string }>>;

export async function unsubscribeNotificationRecipient(
  token: string
): Promise<ActionResult<void>>;
```

---

## 11. Implementation Plan

### Phase 1: Database & Types

**Tasks:**
1. Create database migration for `ultaura_accounts` columns
2. Create database migration for `ultaura_notification_recipients` table
3. Update TypeScript type definitions
4. Update Zod validation schemas

**Files:**
- `/supabase/migrations/20260114000001_workflow_fit_accounts.sql`
- `/supabase/migrations/20260114000002_notification_recipients.sql`
- `/src/lib/ultaura/types.ts`
- `/packages/schemas/src/account.ts`

### Phase 2: Onboarding Flow

**Tasks:**
1. Create `UserTypeStep` component
2. Create `PhoneCollectionStep` for self users (E.164 validation, no Twilio yet)
3. Create `BirthdayStep` component (optional step)
4. Create `LovedOneSetupStep` for family users
5. Update `OnboardingContainer` with conditional flows
6. Update onboarding complete route handler (create line with `status: 'pending'`)
7. Update redirect to `/dashboard/lines/[shortId]/verify` after completion

**Files:**
- `/src/app/onboarding/components/UserTypeStep.tsx`
- `/src/app/onboarding/components/PhoneCollectionStep.tsx`
- `/src/app/onboarding/components/BirthdayStep.tsx`
- `/src/app/onboarding/components/LovedOneSetupStep.tsx`
- `/src/app/onboarding/components/OnboardingContainer.tsx`
- `/src/app/onboarding/complete/route.ts`

### Phase 3: Navigation & Dashboard

**Tasks:**
1. Update navigation config to accept `userType` parameter
2. Add filtering logic to `AppSidebarNavigation.tsx` (no new provider needed)
3. Create `useUltauraAccount()` hook if not exists
4. Rename "Lines" to "My Line" for self users

**Files:**
- `/src/navigation.config.tsx`
- `/src/app/dashboard/(app)/components/AppSidebarNavigation.tsx`
- `/src/lib/ultaura/hooks.ts` (add useUltauraAccount if needed)

### Phase 4: Privacy & Sharing

**Tasks:**
1. Add sharing toggle to Privacy Center
2. Implement sharing enable/disable server action
3. Add "Enable family sharing" button for self users
4. Add upgrade to family mode functionality

**Files:**
- `/src/app/dashboard/(app)/privacy/PrivacyCenterClient.tsx`
- `/src/lib/ultaura/accounts.ts`

### Phase 5: Invitation System

**Tasks:**
1. Implement server actions for notification recipients
2. Create API routes for confirm/unsubscribe
3. Create invitation email template
4. Build InvitedFamilyList UI component
5. Add "Invite Family" section to Privacy Center
6. Implement combined trusted contact flow

**Files:**
- `/src/lib/ultaura/notification-recipients.ts`
- `/src/app/api/ultaura/invite/route.ts`
- `/src/app/api/ultaura/confirm/[token]/route.ts`
- `/src/app/api/ultaura/unsubscribe/[token]/route.ts`
- `/src/lib/emails/notification-invite.tsx`
- `/src/app/dashboard/(app)/privacy/components/InvitedFamilyList.tsx`

### Phase 6: Weekly Summaries

**Tasks:**
1. Update weekly summary scheduler for multi-recipient support
2. Modify recipient logic based on user type and sharing status
3. Update email templates for self-user context
4. Add unsubscribe links for non-primary recipients

**Files:**
- `/telephony/src/services/weekly-summary.ts`
- `/telephony/src/scheduler/weekly-summary-scheduler.ts`
- `/src/lib/emails/weekly-summary.tsx`
- `/src/app/api/telephony/weekly-summary/route.ts`

### Phase 7: Polish & Finishing

**Tasks:**
1. Add inbound calling toggle to line settings
2. Plan recommendations based on user type
3. End-to-end testing of both flows
4. Edge case testing

**Files:**
- `/src/app/dashboard/(app)/lines/[lineId]/settings/SettingsClient.tsx`
- `/src/app/onboarding/components/PlanSelectionStep.tsx`

---

## 12. Testing Considerations

### 12.1 Onboarding Flows

- [ ] Self user completes full onboarding flow
- [ ] Family user completes full onboarding flow
- [ ] Self user skips optional birthday step
- [ ] Family user skips optional invites step
- [ ] Phone is collected (E.164 validated) during onboarding
- [ ] Line is created with `status: 'pending'` during onboarding
- [ ] User is redirected to verification page after onboarding
- [ ] Phone verification works on redirect (existing verify flow)
- [ ] Plan recommendations differ by user type (Care for self, Comfort/Family for caregivers)
- [ ] Birthday milestone is created with `source: 'family_input'`

### 12.2 Navigation

- [ ] Self user sees "My Line" instead of "Lines"
- [ ] Self user does NOT see Insights page
- [ ] Self user does NOT see Alerts page
- [ ] Family user sees all navigation items
- [ ] Navigation updates immediately after mode upgrade

### 12.3 Mode Switching

- [ ] Self user can upgrade to family mode
- [ ] Existing data is preserved after upgrade
- [ ] Existing line remains verified after upgrade
- [ ] Navigation updates after upgrade
- [ ] Sharing is enabled after upgrade
- [ ] Cannot downgrade from family to self

### 12.4 Invitation System

- [ ] Can invite up to 5 family members
- [ ] Error shown when exceeding 5 recipient limit (trigger exception handled gracefully)
- [ ] Invitation email is sent correctly with plaintext token
- [ ] Token is stored as SHA-256 hash in database (not plaintext)
- [ ] Confirmation link works (hashed token lookup)
- [ ] Confirmation shows success message with account name
- [ ] Expired tokens (>7 days) are rejected
- [ ] Unsubscribe link works (hashed token lookup)
- [ ] Unsubscribed recipient no longer receives emails
- [ ] Duplicate emails allowed (different accounts)
- [ ] Combined trusted contact creation works

### 12.5 Weekly Summaries

- [ ] Self user receives their own summary
- [ ] Family account holder receives summary
- [ ] All confirmed recipients receive summary
- [ ] Unsubscribed recipients do NOT receive summary
- [ ] Email content differs for self users (greeting text)
- [ ] Unsubscribe link appears for non-primary recipients
- [ ] List-Unsubscribe header is included for email client compliance
- [ ] Forward-looking filter: only data after `sharing_enabled_at` is included for self users

### 12.6 Privacy & Sharing

- [ ] Self user sharing defaults to OFF
- [ ] Family user sharing defaults to ON
- [ ] Only NEW data shared after enabling (forward-only)
- [ ] `sharing_enabled_at` timestamp is set correctly
- [ ] Trusted contacts work regardless of sharing setting

### 12.7 Edge Cases

- [ ] Existing accounts default to `user_type: 'family_managed'`
- [ ] Self user with trusted contacts (safety alerts still work)
- [ ] Family member invited has their own Ultaura account (works)
- [ ] Token expiration is enforced (7 days)
- [ ] Expired token shows appropriate error
- [ ] Race condition on recipient limit (trigger handles it)
- [ ] Account deleted → recipients cascade deleted

---

## Appendix A: Critical Files Reference

| Category | File Path | Purpose |
|----------|-----------|---------|
| Onboarding | `/src/app/onboarding/components/OnboardingContainer.tsx` | Core onboarding flow controller |
| Navigation Config | `/src/navigation.config.tsx` | Dashboard navigation configuration |
| Navigation Renderer | `/src/app/dashboard/(app)/components/AppSidebarNavigation.tsx` | Sidebar with filtering logic |
| Types | `/src/lib/ultaura/types.ts` | TypeScript type definitions |
| Actions | `/src/lib/ultaura/actions.ts` | Server actions |
| Weekly Summary | `/telephony/src/services/weekly-summary.ts` | Summary generation service |
| Email Templates | `/src/lib/emails/` | All email templates |
| Line Settings | `/src/app/dashboard/(app)/lines/[lineId]/settings/` | Line settings UI |
| Privacy Page | `/src/app/dashboard/(app)/privacy/` | Privacy center page |
| Migrations | `/supabase/migrations/` | Database migrations |
| Milestones | `/src/lib/ultaura/milestones.ts` | Milestone server actions |
| Phone Verification | `/src/app/dashboard/(app)/lines/[lineId]/verify/` | Existing phone verification flow |

## Appendix B: Environment Variables

No new environment variables required. Existing infrastructure is sufficient:

- `EMAIL_*` - Email sending configuration
- `TWILIO_*` - SMS infrastructure (for future use)
- `ULTAURA_INTERNAL_API_SECRET` - Webhook authentication

## Appendix C: Assumptions

1. **Backward compatibility:** Existing accounts default to `user_type: 'family_managed'`
2. **One-way upgrade:** Self users can upgrade to family mode but not vice versa
3. **No year in birthday:** Only month/day collected for privacy
4. **Email-only invitations:** SMS invitations may be added in future
5. **Scheduled calls only:** No proactive check-in calls for either user type
6. **Single notification level:** All invited family receive same notifications
7. **Phone verification reuses existing flow:** No new Twilio verification logic needed
8. **Token security:** Confirmation tokens are hashed (SHA-256) before storage
9. **Milestone source enum:** Uses existing `'family_input'` value for onboarding-provided data
10. **Forward-looking sharing:** Data created before `sharing_enabled_at` is never shared with recipients
