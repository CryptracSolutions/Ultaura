# Dashboard Sharing — Implementation Spec

## 1. Goal

Allow account holders to grant confirmed notification recipients read-only access to the Ultaura dashboard, so family members can log in and view the senior's data (call history, insights, wellness trends, memories, schedules, reminders, and safety alerts) without the ability to modify anything.

## 2. Current State

### 2.1 Notification Recipients System

**Table:** `ultaura_notification_recipients` — stores family members added by the account holder to receive email alerts.
**Schema** (from `supabase/migrations/20260306000002_notification_recipients.sql` + `...0004`):
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `account_id` | uuid FK → `ultaura_accounts(id) ON DELETE CASCADE` | |
| `name` | text NOT NULL | |
| `email` | text NOT NULL | UNIQUE with `(account_id, email)` |
| `phone_e164` | text | nullable |
| `relationship` | text | nullable |
| `is_trusted_contact` | boolean DEFAULT false | |
| `trusted_contact_id` | uuid FK → `ultaura_trusted_contacts(id)` | nullable |
| `confirmation_token_hash` | text | unique partial index |
| `confirmation_token_expires_at` | timestamptz | |
| `confirmed_at` | timestamptz | **null = pending, non-null = confirmed** |
| `unsubscribed_at` | timestamptz | |
| `unsubscribe_token_hash` | text | unique partial index |
| `unsubscribe_token_expires_at` | timestamptz | |
| `created_at` / `updated_at` | timestamptz | |
**RLS:** All 4 policies (SELECT, INSERT, UPDATE, DELETE) use `can_access_ultaura_account(account_id)`.
**Limit:** 5 active recipients per account, enforced at 3 layers: DB triggers (INSERT + UPDATE), service constant `MAX_NOTIFICATION_RECIPIENTS = 5` (`notification-recipients.ts:22`), and UI constant `MAX_RECIPIENTS = 5` (`FamilyRecipientsSection.tsx:26`).
**Service functions** (`src/lib/ultaura/notification-recipients.ts`, 854 lines, `'use server'`):

- `getNotificationRecipients(accountId)` — fetches all recipients
- `inviteNotificationRecipient(accountId, input)` — invite flow with rollback on email failure
- `removeNotificationRecipient(recipientId)` — hard-deletes, calls `requireAccountOwner()`
- `confirmNotificationRecipient(token)` — sets `confirmed_at`, generates unsubscribe token
- `unsubscribeNotificationRecipient(token)` — sets `unsubscribed_at`
- `requireAccountOwner(client, accountId)` — verifies `created_by_user_id === auth.uid()`
  **UI:** The recipient management lives at `/dashboard/privacy?tab=family&section=recipients`. The `FamilyRecipientsSection.tsx` component renders the invite button + modal, and `InvitedFamilyList.tsx` renders the table with Name, Email, Phone, Status, and Remove action.
  **Type** (`src/lib/ultaura/types.ts:198-211`):

```typescript
interface NotificationRecipient {
  id: string;
  accountId: string;
  name: string;
  email: string;
  phoneE164: string | null;
  relationship?: string | null;
  isTrustedContact: boolean;
  trustedContactId: string | null;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### 2.2 Authentication & Authorization

**Memberships table** (`supabase/migrations/20221215192558_schema.sql:49`):

```sql
create table memberships (
  id bigint generated always as identity primary key,
  user_id uuid references public.users,
  organization_id bigint not null references public.organizations,
  role int not null,  -- 0=Member, 1=Admin, 2=Owner
  invited_email text,
  code text,
  created_at timestamptz not null default now(),
  unique (user_id, organization_id)
);
```

RLS: SELECT via `current_user_is_member_of_organization()`, INSERT via same, UPDATE/DELETE via `can_update_user_role()`.
**`can_access_ultaura_account(account_id)`** (`20241220000001_ultaura_schema.sql:390-411`):

```sql
-- Returns all account IDs for current user
create function get_ultaura_accounts_for_user() returns setof uuid as $$
  select ua.id from ultaura_accounts ua
  join memberships m on m.organization_id = ua.organization_id
  where m.user_id = auth.uid()
$$;
-- Checks if a specific account belongs to current user
create function can_access_ultaura_account(account_id uuid) returns boolean as $$
begin
  return account_id in (select get_ultaura_accounts_for_user());
end;
$$;
```

This function is used by **105 active RLS policies across 41 tables** — both SELECT and WRITE policies. This is the central access control gate for all Ultaura data.
**MembershipRole enum** (`src/lib/organizations/types/membership-role.ts`):

```typescript
enum MembershipRole {
  Member = 0,
  Admin = 1,
  Owner = 2,
}
```

**Permission checks** (`src/lib/organizations/permissions.ts`):

- `canInviteUsers(role)` → `role >= Admin`
- `canChangeBilling(role)` → `role === Owner`
- `canUpdateUser(current, target)` → `current > target`
  **Application-level auth helpers:**
- `requireAccountOwner()` (`notification-recipients.ts:130-152`) — checks `created_by_user_id === auth.uid()`
- `requireAccountOwnerContext()` (`privacy.ts:87-121`) — same pattern, used for privacy operations
- `requireSession()` (`src/lib/user/require-session.ts`) — validates auth session, redirects to sign-in
  **Account creation chain:** Signup → `/onboarding/complete` → `create_new_organization()` RPC (creates org + users record + Owner membership) → application code creates `ultaura_accounts` row → creates first line. The `accept_invite_to_organization()` RPC handles invited members: creates users record if needed, links pending membership.
  **Users table** (`20221215192558_schema.sql`): `{ id uuid PK, display_name text, photo_url text, onboarded bool, created_at timestamptz }`. RLS: users can only read/update their own row.

### 2.3 Dashboard Structure & Navigation

**Layout chain:**

```
src/app/dashboard/(app)/layout.tsx  (server — calls loadAppDataForUser + getUltauraAccount)
  └─ OrganizationScopeLayout.tsx    (client — 11 nested context providers)
       └─ RouteShellWithSidebar     (sidebar + content shell)
            ├─ AppSidebar           (desktop sidebar)
            ├─ TopNavBar            (desktop header)
            ├─ MobileDashboardHeader + MobileAppNavigation
            └─ {children}           (page content)
```

**Existing org cookie:** `OrganizationScopeLayout.tsx:62-65` persists the selected organization ID using a `${userId}-organizationId` cookie pattern. The account switcher (T11) must reuse this exact pattern — not create a new cookie name.

**`loadAppDataForUser()`** (`src/lib/server/loaders/load-app-data.ts:135-241`):

1. `requireSession()` → validates auth
2. `getUserDataById()` → gets users record; redirects to `/onboarding` if missing or not onboarded
3. `getOrganizationsByUserId()` → queries memberships → joins organizations; **redirects to `/onboarding` if no orgs found**
4. Takes `organizationsData[0]` (first org — assumes 1:1 mapping)
5. Returns `{ auth, user, organization, role, csrfToken, language, ui }`
   **Navigation config** (`src/navigation.config.tsx`): `NAVIGATION_CONFIG()` accepts `NavigationContext` with `userType`. Groups:

- **Dashboard:** Home — always
- **Manage:** Lines, Calls, Reminders — always
- **Care:** Insights, Alerts — only for `family_managed`
- **Account:** Usage, Privacy — always
  **OrganizationsSelector** (`src/app/dashboard/(app)/components/organizations/OrganizationsSelector.tsx`): Renders org dropdown using `useUserOrganizationsQuery()`. Currently **disabled** behind `NEXT_PUBLIC_ENABLE_TEAM_ACCOUNTS` flag. When enabled, shows all user's organizations with switching via `router.replace('/dashboard/{uuid}')`.
  **Key dashboard routes:**
  | Route | Viewer Access |
  |-------|:---:|
  | `/dashboard` (home) | Yes |
  | `/dashboard/lines`, `/dashboard/lines/[lineId]` | Yes (read-only) |
  | `/dashboard/lines/[lineId]/schedule` | Yes (read-only) |
  | `/dashboard/lines/[lineId]/reminders` | Yes (read-only) |
  | `/dashboard/lines/[lineId]/milestones` | Yes (read-only) |
  | `/dashboard/lines/[lineId]/contacts` | No (management) |
  | `/dashboard/lines/[lineId]/topics` | No (management) |
  | `/dashboard/lines/[lineId]/call-controls` | No (management) |
  | `/dashboard/lines/[lineId]/settings` | No (management) |
  | `/dashboard/lines/[lineId]/verify` | No (management) |
  | `/dashboard/calls` | Yes (read-only) |
  | `/dashboard/reminders` | Yes (read-only) |
  | `/dashboard/insights/*` | Yes |
  | `/dashboard/alerts` | Yes |
  | `/dashboard/usage` | No (billing) |
  | `/dashboard/privacy` | No (admin) |
  | `/dashboard/settings/*` | No (admin) |

### 2.4 Data Encryption & Decryption

**Architecture:** AES-256-GCM with envelope encryption. Data Encryption Keys (DEKs) are stored in `ultaura_account_crypto_keys` and `ultaura_line_crypto_keys`, wrapped by a master Key Encryption Key (KEK) from the `ULTAURA_ENCRYPTION_KEY` env var.
**RLS on crypto key tables:** RLS enabled with **zero policies** — only the service-role client can access them. This is by design.
**Data access pattern** (used by all insights/memory/reminder functions):

1. `getAuthorizedLine(lineId)` — **user-scoped** client, RLS on `ultaura_lines`
2. Switch to **admin client** (service role) for encrypted data reads
3. `getSharingGate()` — evaluates consent/tier/pause to determine visibility
4. Decrypt with admin-fetched DEK; apply tier-based filtering
   **Sharing gate** (`src/lib/ultaura/sharing-gate.ts`): Central visibility filter. Evaluates `user_type`, `sharing_consent`, `sharing_tier`, `insights_enabled`, `is_paused` to return boolean flags: `canAccessNonSafety`, `allowMood`, `allowTopics`, `allowConcerns`, `isFamilyOutputSuppressed`.
   **Implication for viewers:** Viewers go through the same `getAuthorizedLine()` → `getSharingGate()` pipeline. If they have an RLS-passing membership, `getAuthorizedLine()` returns the line, and the sharing gate applies the same tier-based filtering. No additional encryption/decryption changes are needed.

### 2.5 Email System

**Transport:** Nodemailer over SMTP (`src/core/email/send-email.ts`), likely configured to Resend's SMTP relay. Uses `EMAIL_SENDER` env var for the from address.
**Template pattern:** React Email components in `src/lib/emails/`, all returning `{ html: string; text: string }`, all using `EmailLayout` wrapper (`src/lib/emails/components/email-layout.tsx`).
**Existing invite template:** `src/lib/emails/notification-invite.tsx` — accepts `{ recipientName, accountName, lineName, inviterName, confirmLink }`.

### 2.6 Account Resolution

```
User → Session → memberships → organizations → ultaura_accounts (by organization_id)
```

**`getOrganizationsByUserId()`** (`src/lib/organizations/database/queries.ts:59-77`): Queries memberships for the user, joins to organizations and subscriptions. No explicit ORDER BY. Returns `{ role, userId, organization }[]`.
**`getUltauraAccount(organizationId)`** (`src/lib/ultaura/accounts.ts`): Uses server component client (RLS-scoped), queries by `organization_id`.
**`useUltauraAccount()` hook** (`src/lib/ultaura/hooks/use-ultaura-account.ts`): SWR-based client hook used in sidebar and mobile nav.

---

3. Requirements
   From Product Decisions
   | # | Requirement | Source |
   |---|------------|--------|
   | R1 | Only confirmed notification recipients can receive dashboard access (toggle only visible/functional when confirmed_at IS NOT NULL). | Decision 1, 12 |
   | R2 | Dashboard access is controlled via a per-recipient toggle by the account holder. | Decision 1, 15 |
   | R3 | Viewers have strictly read-only access — no interactive elements (buttons, forms, toggles) that modify data. | Decision 2 |
   | R4 | Visible sections: Line overview/home, call history & summaries, insights & wellness trends, memories, schedule (read-only), reminders (read-only), milestones (read-only), safety alerts. | Decision 3 |
   | R5 | Hidden sections: Billing, account settings, privacy/sharing settings, recipient management, usage, line settings, contacts management, topics management, phone verification. | Decision 4 |
   | R6 | All-or-nothing access: No per-section or per-line toggles. If granted, viewer sees all allowed sections for all lines. | Decision 5, 6 |
   | R7 | Login flow — new user: Recipient receives signup email, creates password, logs in. Standard signup page. | Decision 7 |
   | R8 | Login flow — existing user: If recipient already has a Supabase auth account, access auto-links immediately at grant time. Send notification email. | Decision 7, Interview |
   | R9 | No decline mechanism. If granted, it's granted. Recipient chooses whether to use it. | Decision 8 |
   | R10 | Revocation: Account holder can revoke at any time. Viewer's auth account is kept. Access removed immediately on next page load. Show "Access Removed" page. | Decision 9, Interview |
   | R11 | Unsubscribe independence: Unsubscribing from email notifications does NOT revoke dashboard access. | Decision 10 |
   | R12 | Recipient deletion cascade: Deleting a recipient removes dashboard access. | Decision 11 |
   | R13 | Multi-account viewers: See an account switcher dropdown showing account name + role badge. Default to own account on login. | Decision 13, Interview |
   | R14 | No sub-limit: All 5 recipients can have dashboard access. | Decision 14 |
   | R15 | Toggle location: In the Privacy/Sharing section, next to each confirmed recipient. | Decision 15 |
   | R16 | Plan gating: Available on ALL plans including trial. | Decision 16 |
   | R17 | Viewer mode banner: Always visible, not dismissible. Text: "You're viewing Senior's Name's dashboard — managed by Account Holder Name". Warm, friendly tone. | Decision 17, 19, Interview |
   | R18 | No in-dashboard notifications for viewers. They already receive email alerts as recipients. | Decision 18 |
   | R19 | Feature name: "Dashboard Sharing" throughout product and codebase. | Decision 20 |
   | R20 | Toggle confirmation dialog before granting access. Explains what will happen. | Interview |
   | R21 | Email to existing users when granting access: "You now have dashboard access to Senior's Name's account. Log in to view." | Interview |
   | R22 | Viewer banner always visible — not dismissible, shown on every dashboard page. | Interview |
   | R23 | Revocation → "Access Removed" page for viewer-only users. Multi-account viewers switch to their own account. | Interview |
   Derived Technical Requirements
   | # | Requirement |
   |---|------------|
   | R24 | Viewers must have a Supabase Auth identity and a public.users record to access the dashboard. |
   | R25 | Viewers access accounts via the memberships table with role = -1 (Viewer). This reuses the existing RLS infrastructure — can_access_ultaura_account() works automatically. |
   | R26 | Viewer memberships are created/deleted by the account holder's toggle action, NOT through the standard org invite UI. |
   | R27 | Write operations are blocked for viewers at the application layer (requireAccountOwner() checks created_by_user_id) and reinforced at the RLS layer via restrictive policies on critical tables. |
   | R28 | loadAppDataForUser() must handle multiple organizations and prioritize Owner/Member orgs over Viewer orgs for the default view. |
   | R29 | The sharing gate (getSharingGate()) applies identically to viewers — they see data according to the senior's consent tier, same as the account holder. |
   | R30 | Navigation config must accept a viewer role flag and hide restricted sections. |
   | R31 | All existing dashboard pages with action controls (edit buttons, forms, toggles, delete actions) must detect viewer mode and hide those controls. |
   | R32 | The display_name for new viewer users should be auto-set from the notification recipient's name field after signup. |

---

4. Affected Files
   4.1 Database (Migrations)
   | File | Change |
   |------|--------|
   | supabase/migrations/2026MMDD000001_dashboard_sharing.sql (NEW) | Add dashboard_access_granted_at column to ultaura_notification_recipients; create is_dashboard_viewer() SQL function; create get_auth_user_id_by_email() helper function; add restrictive write policies on critical tables for viewers |
   4.2 Shared Types & Schemas
   | File | Change |
   |------|--------|
   | src/lib/organizations/types/membership-role.ts | Add Viewer = -1 to MembershipRole enum |
   | src/lib/ultaura/types.ts | Add dashboardAccessGrantedAt field to NotificationRecipient interface |
   | packages/types/ | Add DashboardSharingToggleResult type if needed for shared contracts |
   4.3 Backend — Service Layer
   | File | Change |
   |------|--------|
   | src/lib/ultaura/notification-recipients.ts | Add grantDashboardAccess() and revokeDashboardAccess() server actions; update removeNotificationRecipient() to cascade-delete viewer membership; update mapRecipient() to include dashboardAccessGrantedAt |
   | src/lib/ultaura/dashboard-sharing.ts (NEW) | Core dashboard sharing service: createViewerMembership(), deleteViewerMembership(), lookupAuthUserByEmail(), getViewerAccountContext(), isViewerRole() |
   | src/lib/server/loaders/load-app-data.ts | Modify loadAppDataForUser() to handle multi-org (sort by role, prefer Owner), detect former-viewer redirect to access-removed page |
   | src/lib/ultaura/accounts.ts | Add getUltauraAccountsForViewer(userId) — fetch all accounts where user has viewer membership |
   4.4 Backend — Email
   | File | Change |
   |------|--------|
   | src/lib/emails/dashboard-access-invite.tsx (NEW) | Email template for new users: signup link + explanation of dashboard access |
   | src/lib/emails/dashboard-access-granted.tsx (NEW) | Email template for existing users: notification that they now have dashboard access + login link |
   | src/lib/emails/dashboard-access-revoked.tsx (NEW) | Email template for revocation notification (optional, informational) |
   4.5 Backend — Auth & Routing
   | File | Change |
   |------|--------|
   | src/app/auth/callback/route.ts | After acceptInviteToOrganization(), if the membership role is Viewer, set display_name on the users record from the recipient's name |
   | src/app/dashboard/access-removed/page.tsx (NEW) | "Access Removed" page with message and CTA |
   4.6 Frontend — Dashboard Layout & Navigation
   | File | Change |
   |------|--------|
   | src/app/dashboard/(app)/layout.tsx | Pass role to OrganizationScopeLayout; handle multi-org context |
   | src/app/dashboard/(app)/components/OrganizationScopeLayout.tsx | Accept role prop; provide viewer context to children; render ViewerModeBanner when role is Viewer |
   | src/app/dashboard/(app)/components/AppSidebarNavigation.tsx | Pass isViewer to navigation config; conditionally render account switcher |
   | src/navigation.config.tsx | Extend NavigationContext with role; hide Usage, Privacy nav items for viewers |
   | src/app/dashboard/(app)/components/AppSidebar.tsx | Render account switcher when user has multiple orgs |
   | src/components/TopNavBar.tsx | Hide "Quick Actions" button for viewers |
   | src/components/MobileAppNavigation.tsx | Hide restricted items and Quick Actions for viewers |
   | src/components/ProfileDropdown.tsx | Hide "Subscription" link for viewers (line ~149-159). "Settings → Profile" link remains visible since viewers can access their own profile. |
   4.7 Frontend — Viewer Mode Banner
   | File | Change |
   |------|--------|
   | src/components/ViewerModeBanner.tsx (NEW) | Persistent banner: "You're viewing Senior's Name's dashboard — managed by Account Holder Name" |
   4.8 Frontend — Account Switcher
   | File | Change |
   |------|--------|
   | src/app/dashboard/(app)/components/AccountSwitcher.tsx (NEW) | Dropdown showing all accounts with role badges; handles account switching via cookie/URL |
   | src/lib/contexts/viewer.ts (NEW) | ViewerContext providing isViewer, viewedAccountName, accountHolderName |
   4.9 Frontend — Privacy Center (Toggle UI)
   | File | Change |
   |------|--------|
   | src/app/dashboard/(app)/privacy/page.tsx | No change (already loads recipients) |
   | src/app/dashboard/(app)/privacy/components/InvitedFamilyList.tsx | Add "Dashboard Access" toggle column for confirmed recipients; add confirmation dialog |
   | src/app/dashboard/(app)/privacy/hooks/useDashboardSharingToggle.ts (NEW) | Hook managing toggle state, confirmation dialog, loading states, and server action calls |
   4.10 Frontend — Read-Only Enforcement
   These pages need viewer-mode checks to hide action controls:
   | File | Change |
   |------|--------|
   | src/app/dashboard/(app)/page.tsx | Hide "Add Line", "Schedule Call", "Set Reminder" quick actions for viewers |
   | src/app/dashboard/(app)/lines/components/LinesPageClient.tsx | Hide "Add Line" button for viewers |
   | src/app/dashboard/(app)/lines/[lineId]/LineDetailClient.tsx | Hide edit/action buttons for viewers |
   | src/app/dashboard/(app)/lines/[lineId]/components/LineHeaderActions.tsx | Hide all action buttons for viewers |
   | src/app/dashboard/(app)/lines/[lineId]/components/LineTabNav.tsx | Hide Settings, Call Controls, Topics, and Contacts tabs for viewers (only Overview and Milestones remain visible) |
   | src/app/dashboard/(app)/calls/CallsPageClient.tsx | Hide "Add Schedule" and edit buttons for viewers |
   | src/app/dashboard/(app)/calls/components/EditScheduleModal.tsx | Not rendered for viewers (no trigger) |
   | src/app/dashboard/(app)/reminders/RemindersPageClient.tsx | Hide "Add Reminder" and edit/delete buttons for viewers |
   | src/app/dashboard/(app)/alerts/AlertsPageClient.tsx | Hide settings/configuration controls for viewers |
   | (InsightsPageHeader.tsx intentionally excluded — verified it has no action buttons) | — |
   4.11 Frontend — Route Protection
   | File | Change |
   |------|--------|
   | src/app/dashboard/(app)/usage/page.tsx | Add viewer guard → redirect to /dashboard |
   | src/app/dashboard/(app)/privacy/page.tsx | Add viewer guard → redirect to /dashboard |
   | src/app/dashboard/(app)/settings/subscription/layout.tsx (or page.tsx) | Add viewer guard → redirect to /dashboard. NOTE: Do NOT guard settings/layout.tsx — that would block profile/password/MFA pages which viewers need. Only guard billing-related and org-management sub-routes. |
   | src/app/dashboard/(app)/settings/organization/layout.tsx (or page.tsx) | Add viewer guard → redirect to /dashboard |
   | src/app/dashboard/(app)/lines/[lineId]/contacts/page.tsx | Add viewer guard → redirect to line overview |
   | src/app/dashboard/(app)/lines/[lineId]/topics/page.tsx | Add viewer guard → redirect to line overview |
   | src/app/dashboard/(app)/lines/[lineId]/call-controls/page.tsx | Add viewer guard → redirect to line overview |
   | src/app/dashboard/(app)/lines/[lineId]/settings/page.tsx | Add viewer guard → redirect to line overview |
   | src/app/dashboard/(app)/lines/[lineId]/verify/page.tsx | Add viewer guard → redirect to line overview |

---

5. Database Changes
   5.1 Migration: 2026MMDD000001_dashboard_sharing.sql
   -- =============================================================
   -- Dashboard Sharing: schema changes, functions, and RLS policies
   -- =============================================================
   -- 1. Add dashboard_access_granted_at to notification recipients
   ALTER TABLE ultaura_notification_recipients
   ADD COLUMN IF NOT EXISTS dashboard_access_granted_at timestamptz;
   COMMENT ON COLUMN ultaura_notification_recipients.dashboard_access_granted_at IS
   'Timestamp when the account holder granted this recipient read-only dashboard access. NULL = not granted.';
   CREATE INDEX IF NOT EXISTS idx_notification_recipients_dashboard_access
   ON ultaura_notification_recipients(account_id)
   WHERE dashboard_access_granted_at IS NOT NULL;
   -- 2. Helper: check if current user is a dashboard viewer for a given account
   -- (has a membership with role = -1 in the account's organization)
   CREATE OR REPLACE FUNCTION is_dashboard_viewer(p_account_id uuid)
   RETURNS boolean
   LANGUAGE sql
   SECURITY DEFINER
   SET search_path = public
   STABLE
   AS $$
   SELECT EXISTS (
   SELECT 1
   FROM memberships m
   JOIN ultaura_accounts ua ON ua.organization_id = m.organization_id
   WHERE ua.id = p_account_id
   AND m.user_id = auth.uid()
   AND m.role = -1
   );
   $$
   ;
   -- 3. Helper: look up an auth user's ID by email
   --    Used by the dashboard sharing service to auto-link existing users
   CREATE OR REPLACE FUNCTION get_auth_user_id_by_email(lookup_email text)
   RETURNS uuid
   LANGUAGE sql
   SECURITY DEFINER
   SET search_path = auth, public
   STABLE
   AS
   $$
   SELECT id FROM auth.users WHERE email = lower(trim(lookup_email)) LIMIT 1;
   $$;

-- SECURITY: Restrict get_auth_user_id_by_email to service_role only.
-- Without this, any authenticated user could enumerate auth emails — an
-- unacceptable privacy risk for a product serving vulnerable seniors.
-- The dashboard-sharing service already uses the admin client (service_role)
-- to call this function, so this restriction doesn't break anything.
REVOKE EXECUTE ON FUNCTION get_auth_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_auth_user_id_by_email(text) TO service_role;

-- 4. Restrictive write policies — prevent viewers from modifying critical data
-- PostgreSQL RESTRICTIVE policies combine with AND against permissive policies,
-- so writes require BOTH the existing permissive policy AND this restrictive check.
-- 4a. ultaura_accounts — viewers cannot update accounts
CREATE POLICY "Dashboard viewers cannot modify accounts"
ON ultaura_accounts AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(id));
-- 4b. ultaura_lines — viewers cannot insert/update/delete lines
CREATE POLICY "Dashboard viewers cannot insert lines"
ON ultaura_lines AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(account_id));
CREATE POLICY "Dashboard viewers cannot update lines"
ON ultaura_lines AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(account_id));
CREATE POLICY "Dashboard viewers cannot delete lines"
ON ultaura_lines AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(account_id));
-- 4c. ultaura_schedules — viewers cannot modify schedules
CREATE POLICY "Dashboard viewers cannot insert schedules"
ON ultaura_schedules AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(account_id));
CREATE POLICY "Dashboard viewers cannot update schedules"
ON ultaura_schedules AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(account_id));
CREATE POLICY "Dashboard viewers cannot delete schedules"
ON ultaura_schedules AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(account_id));
-- 4d. ultaura_reminders — viewers cannot modify reminders
CREATE POLICY "Dashboard viewers cannot insert reminders"
ON ultaura_reminders AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(account_id));
CREATE POLICY "Dashboard viewers cannot update reminders"
ON ultaura_reminders AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(account_id));
CREATE POLICY "Dashboard viewers cannot delete reminders"
ON ultaura_reminders AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(account_id));
-- 4e. ultaura_notification_recipients — viewers cannot modify recipients
CREATE POLICY "Dashboard viewers cannot insert recipients"
ON ultaura_notification_recipients AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(account_id));
CREATE POLICY "Dashboard viewers cannot update recipients"
ON ultaura_notification_recipients AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(account_id));
CREATE POLICY "Dashboard viewers cannot delete recipients"
ON ultaura_notification_recipients AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(account_id));
-- 4f. ultaura_trusted_contacts — viewers cannot modify contacts
CREATE POLICY "Dashboard viewers cannot insert contacts"
ON ultaura_trusted_contacts AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(account_id));
CREATE POLICY "Dashboard viewers cannot update contacts"
ON ultaura_trusted_contacts AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(account_id));
CREATE POLICY "Dashboard viewers cannot delete contacts"
ON ultaura_trusted_contacts AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(account_id));
-- 4g. ultaura_milestones — viewers cannot modify milestones
CREATE POLICY "Dashboard viewers cannot insert milestones"
ON ultaura_milestones AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(account_id));
CREATE POLICY "Dashboard viewers cannot update milestones"
ON ultaura_milestones AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(account_id));
CREATE POLICY "Dashboard viewers cannot delete milestones"
ON ultaura_milestones AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(account_id));
-- 4h. ultaura_account_privacy_settings — viewers cannot modify privacy settings
CREATE POLICY "Dashboard viewers cannot update privacy settings"
ON ultaura_account_privacy_settings AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(account_id));
CREATE POLICY "Dashboard viewers cannot insert privacy settings"
ON ultaura_account_privacy_settings AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(account_id));
-- 4i. ultaura_consents — viewers cannot insert consents
CREATE POLICY "Dashboard viewers cannot insert consents"
ON ultaura_consents AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(account_id));
-- 4j. ultaura_notification_preferences — viewers cannot modify notification prefs
CREATE POLICY "Dashboard viewers cannot insert notification prefs"
ON ultaura_notification_preferences AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(account_id));
CREATE POLICY "Dashboard viewers cannot update notification prefs"
ON ultaura_notification_preferences AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(account_id));
CREATE POLICY "Dashboard viewers cannot delete notification prefs"
ON ultaura_notification_preferences AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(account_id));
-- 4k. ultaura_schedule_exceptions — viewers cannot modify schedule exceptions
-- (The original migration uses FOR ALL, which would let viewers modify call schedules)
CREATE POLICY "Dashboard viewers cannot insert schedule exceptions"
ON ultaura_schedule_exceptions AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(account_id));
CREATE POLICY "Dashboard viewers cannot update schedule exceptions"
ON ultaura_schedule_exceptions AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(account_id));
CREATE POLICY "Dashboard viewers cannot delete schedule exceptions"
ON ultaura_schedule_exceptions AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(account_id));
-- 4l. ultaura_insight_privacy — viewers cannot modify insight privacy
CREATE POLICY "Dashboard viewers cannot update insight privacy"
ON ultaura_insight_privacy AS RESTRICTIVE
FOR UPDATE
USING (
NOT is_dashboard_viewer(
(SELECT account_id FROM ultaura_lines WHERE id = ultaura_insight_privacy.line_id)
)
);
-- 4m. ultaura_data_export_requests — viewers cannot request exports
CREATE POLICY "Dashboard viewers cannot insert export requests"
ON ultaura_data_export_requests AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(account_id));
-- 4n. Personalization tables — viewers cannot modify any personalization data
-- Two FK patterns: tables with direct account_id, and tables with line_id (subquery)

-- Tables with direct account_id: ultaura_mood_snapshots, ultaura_relationships
CREATE POLICY "Dashboard viewers cannot insert mood snapshots"
ON ultaura_mood_snapshots AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(account_id));
CREATE POLICY "Dashboard viewers cannot update mood snapshots"
ON ultaura_mood_snapshots AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(account_id));
CREATE POLICY "Dashboard viewers cannot delete mood snapshots"
ON ultaura_mood_snapshots AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot insert relationships"
ON ultaura_relationships AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(account_id));
CREATE POLICY "Dashboard viewers cannot update relationships"
ON ultaura_relationships AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(account_id));
CREATE POLICY "Dashboard viewers cannot delete relationships"
ON ultaura_relationships AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(account_id));

-- Tables with line_id (require subquery to resolve account_id):
-- ultaura_emotional_patterns, ultaura_content_preferences, ultaura_accessibility_settings,
-- ultaura_cognitive_observations, ultaura_cognitive_flags, ultaura_persona_adaptations,
-- ultaura_grief_interactions, ultaura_daily_rhythms
CREATE POLICY "Dashboard viewers cannot insert emotional patterns"
ON ultaura_emotional_patterns AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(
(SELECT account_id FROM ultaura_lines WHERE id = ultaura_emotional_patterns.line_id)
));
CREATE POLICY "Dashboard viewers cannot update emotional patterns"
ON ultaura_emotional_patterns AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(
(SELECT account_id FROM ultaura_lines WHERE id = ultaura_emotional_patterns.line_id)
));
CREATE POLICY "Dashboard viewers cannot delete emotional patterns"
ON ultaura_emotional_patterns AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(
(SELECT account_id FROM ultaura_lines WHERE id = ultaura_emotional_patterns.line_id)
));

CREATE POLICY "Dashboard viewers cannot insert content preferences"
ON ultaura_content_preferences AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(
(SELECT account_id FROM ultaura_lines WHERE id = ultaura_content_preferences.line_id)
));
CREATE POLICY "Dashboard viewers cannot update content preferences"
ON ultaura_content_preferences AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(
(SELECT account_id FROM ultaura_lines WHERE id = ultaura_content_preferences.line_id)
));
CREATE POLICY "Dashboard viewers cannot delete content preferences"
ON ultaura_content_preferences AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(
(SELECT account_id FROM ultaura_lines WHERE id = ultaura_content_preferences.line_id)
));

CREATE POLICY "Dashboard viewers cannot insert accessibility settings"
ON ultaura_accessibility_settings AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(
(SELECT account_id FROM ultaura_lines WHERE id = ultaura_accessibility_settings.line_id)
));
CREATE POLICY "Dashboard viewers cannot update accessibility settings"
ON ultaura_accessibility_settings AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(
(SELECT account_id FROM ultaura_lines WHERE id = ultaura_accessibility_settings.line_id)
));
CREATE POLICY "Dashboard viewers cannot delete accessibility settings"
ON ultaura_accessibility_settings AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(
(SELECT account_id FROM ultaura_lines WHERE id = ultaura_accessibility_settings.line_id)
));

CREATE POLICY "Dashboard viewers cannot insert cognitive observations"
ON ultaura_cognitive_observations AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(
(SELECT account_id FROM ultaura_lines WHERE id = ultaura_cognitive_observations.line_id)
));
CREATE POLICY "Dashboard viewers cannot update cognitive observations"
ON ultaura_cognitive_observations AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(
(SELECT account_id FROM ultaura_lines WHERE id = ultaura_cognitive_observations.line_id)
));
CREATE POLICY "Dashboard viewers cannot delete cognitive observations"
ON ultaura_cognitive_observations AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(
(SELECT account_id FROM ultaura_lines WHERE id = ultaura_cognitive_observations.line_id)
));

CREATE POLICY "Dashboard viewers cannot insert cognitive flags"
ON ultaura_cognitive_flags AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(
(SELECT account_id FROM ultaura_lines WHERE id = ultaura_cognitive_flags.line_id)
));
CREATE POLICY "Dashboard viewers cannot update cognitive flags"
ON ultaura_cognitive_flags AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(
(SELECT account_id FROM ultaura_lines WHERE id = ultaura_cognitive_flags.line_id)
));
CREATE POLICY "Dashboard viewers cannot delete cognitive flags"
ON ultaura_cognitive_flags AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(
(SELECT account_id FROM ultaura_lines WHERE id = ultaura_cognitive_flags.line_id)
));

CREATE POLICY "Dashboard viewers cannot insert persona adaptations"
ON ultaura_persona_adaptations AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(
(SELECT account_id FROM ultaura_lines WHERE id = ultaura_persona_adaptations.line_id)
));
CREATE POLICY "Dashboard viewers cannot update persona adaptations"
ON ultaura_persona_adaptations AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(
(SELECT account_id FROM ultaura_lines WHERE id = ultaura_persona_adaptations.line_id)
));
CREATE POLICY "Dashboard viewers cannot delete persona adaptations"
ON ultaura_persona_adaptations AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(
(SELECT account_id FROM ultaura_lines WHERE id = ultaura_persona_adaptations.line_id)
));

CREATE POLICY "Dashboard viewers cannot insert grief interactions"
ON ultaura_grief_interactions AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(
(SELECT account_id FROM ultaura_lines WHERE id = ultaura_grief_interactions.line_id)
));
CREATE POLICY "Dashboard viewers cannot update grief interactions"
ON ultaura_grief_interactions AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(
(SELECT account_id FROM ultaura_lines WHERE id = ultaura_grief_interactions.line_id)
));
CREATE POLICY "Dashboard viewers cannot delete grief interactions"
ON ultaura_grief_interactions AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(
(SELECT account_id FROM ultaura_lines WHERE id = ultaura_grief_interactions.line_id)
));

CREATE POLICY "Dashboard viewers cannot insert daily rhythms"
ON ultaura_daily_rhythms AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(
(SELECT account_id FROM ultaura_lines WHERE id = ultaura_daily_rhythms.line_id)
));
CREATE POLICY "Dashboard viewers cannot update daily rhythms"
ON ultaura_daily_rhythms AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(
(SELECT account_id FROM ultaura_lines WHERE id = ultaura_daily_rhythms.line_id)
));
CREATE POLICY "Dashboard viewers cannot delete daily rhythms"
ON ultaura_daily_rhythms AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(
(SELECT account_id FROM ultaura_lines WHERE id = ultaura_daily_rhythms.line_id)
));

-- 4o. ultaura_life_chapters — viewers cannot modify life chapters
-- (Has account_id directly, full CRUD permissive policies. Contains encrypted narrative content.)
CREATE POLICY "Dashboard viewers cannot insert life chapters"
ON ultaura_life_chapters AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(account_id));
CREATE POLICY "Dashboard viewers cannot update life chapters"
ON ultaura_life_chapters AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(account_id));
CREATE POLICY "Dashboard viewers cannot delete life chapters"
ON ultaura_life_chapters AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(account_id));

-- 4p. ultaura_wellness_alerts — viewers cannot modify wellness alerts
-- (Has account_id directly, full CRUD permissive policies. SAFETY-CRITICAL: a viewer could
-- INSERT fake alerts (health_mention, mood_drop, cognitive_concern) or DELETE real ones,
-- directly undermining the safety alerting system.)
CREATE POLICY "Dashboard viewers cannot insert wellness alerts"
ON ultaura_wellness_alerts AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(account_id));
CREATE POLICY "Dashboard viewers cannot update wellness alerts"
ON ultaura_wellness_alerts AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(account_id));
CREATE POLICY "Dashboard viewers cannot delete wellness alerts"
ON ultaura_wellness_alerts AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(account_id));

Design rationale for restrictive policies:

- Existing permissive policies (105 across 41 tables) use can_access_ultaura_account() which checks memberships — viewers have memberships, so they pass permissive policies for ALL operations including writes.
- Rather than modifying all 105 existing policies, we add RESTRICTIVE policies comprehensively across all tables where viewers could theoretically write data. PostgreSQL evaluates restrictive policies with AND against permissive policies — so a write must pass BOTH the permissive check (user has membership) AND the restrictive check (user is NOT a viewer).
- Coverage: 25 tables with restrictive write policies (accounts, lines, schedules, schedule_exceptions, reminders, notification_recipients, trusted_contacts, milestones, privacy_settings, consents, notification_preferences, insight_privacy, data_export_requests, life_chapters, wellness_alerts, plus all 10 personalization tables). Combined with application-layer requireAccountOwner() checks and UI write-affordance removal, this provides defense-in-depth.

---

6. Implementation Tasks
   T1: Database Migration
   What: Create the SQL migration file with all schema changes, functions, and restrictive policies from Section 5.
   Files: supabase/migrations/2026MMDD000001_dashboard_sharing.sql
   Requirements: R2, R25, R27
   Dependencies: None
   Acceptance criteria:

- Migration applies cleanly against current schema
- ALTER TABLE adds dashboard_access_granted_at column
- is_dashboard_viewer() function returns true for role=-1 memberships and false otherwise
- get_auth_user_id_by_email() returns the user ID for existing emails and NULL for nonexistent ones
- All restrictive policies are created without errors
- Existing queries by account holders are unaffected (restrictive policies don't block non-viewers)
  T2: MembershipRole Enum Update
  What: Add Viewer = -1 to the MembershipRole TypeScript enum.
  Files: src/lib/organizations/types/membership-role.ts
  Requirements: R25
  Dependencies: None
  Acceptance criteria:
- MembershipRole.Viewer === -1
- All existing permission checks (canInviteUsers, canChangeBilling, canUpdateUser) return false for MembershipRole.Viewer
- TypeScript compiles without errors
  T3: NotificationRecipient Type Update
  What: Add dashboardAccessGrantedAt field to the NotificationRecipient interface and update the mapRecipient() function.
  Files: src/lib/ultaura/types.ts, src/lib/ultaura/notification-recipients.ts
  Requirements: R2
  Dependencies: T1
  Acceptance criteria:
- NotificationRecipient.dashboardAccessGrantedAt is string | null
- mapRecipient() maps dashboard_access_granted_at to the new field
- getNotificationRecipients() returns the new field
  T4: Dashboard Sharing Service
  What: Create the core service module with functions for granting, revoking, and checking dashboard access.
  Files: src/lib/ultaura/dashboard-sharing.ts (NEW)
  Requirements: R2, R7, R8, R10, R12, R24, R25, R26
  Dependencies: T1, T2, T3
  Acceptance criteria:
- grantDashboardAccess(accountId, recipientId):
  1. Validates caller is account owner (requireAccountOwner())
  2. Validates recipient exists, belongs to account, and is confirmed
  3. Sets dashboard_access_granted_at = now() on the recipient
  4. Calls get_auth_user_id_by_email RPC to check for existing auth user
  5. If existing user: creates membership {user_id, organization_id, role: -1} via admin client; sends notification email
  6. If new user: creates pending membership {invited_email, code, organization_id, role: -1} via admin client; sends signup email
  7. Returns ActionResult<{ isExistingUser: boolean }>
- revokeDashboardAccess(accountId, recipientId):
  1. Validates caller is account owner
  2. Sets dashboard_access_granted_at = null on the recipient
  3. Deletes the viewer membership (by matching organization_id + role = -1 + user_id or invited_email)
  4. Returns ActionResult<void>
- deleteViewerMembershipForRecipient(accountId, recipientEmail):
  1. Used by removeNotificationRecipient() cascade
  2. Finds and deletes any viewer membership matching the recipient's email for this account's org
- isViewerRole(role: MembershipRole): boolean — returns role === MembershipRole.Viewer
- getViewerContext(adminClient, accountId, userId):
  1. Returns { accountHolderName, seniorNames: string[] } for banner display
  2. Fetches account holder's display_name from users table via created_by_user_id
  3. Fetches line names from ultaura_lines
     T5: Update removeNotificationRecipient Cascade
     What: When a recipient is deleted, also remove any associated viewer membership.
     Files: src/lib/ultaura/notification-recipients.ts
     Requirements: R12
     Dependencies: T4
     Acceptance criteria:
- removeNotificationRecipient() now calls deleteViewerMembershipForRecipient() before deleting the recipient row
- If the recipient had dashboard_access_granted_at IS NOT NULL and a linked viewer membership, the membership is deleted
- If no viewer membership exists, deletion proceeds normally without error
  T6: Email Templates
  What: Create email templates for dashboard access invite (new users) and notification (existing users).
  Files: src/lib/emails/dashboard-access-invite.tsx (NEW), src/lib/emails/dashboard-access-granted.tsx (NEW)
  Requirements: R7, R8, R21
  Dependencies: None
  Acceptance criteria:
  dashboard-access-invite.tsx (for new users without auth accounts):
- Props: { recipientName, accountName, seniorName, inviterName, signupLink }
- Content: "Hi {recipientName}, {inviterName} has given you access to view {seniorName}'s care dashboard on Ultaura. Create your free account to get started."
- CTA button: "Create Account" → signupLink (which is /auth/sign-up?inviteCode=[code])
- Uses EmailLayout wrapper
- Returns { html, text }
  dashboard-access-granted.tsx (for existing users with auth accounts):
- Props: { recipientName, accountName, seniorName, inviterName, loginLink }
- Content: "Hi {recipientName}, {inviterName} has given you access to view {seniorName}'s care dashboard on Ultaura. Log in to start viewing."
- CTA button: "View Dashboard" → loginLink (which is /auth/sign-in?next=/dashboard)
- Uses EmailLayout wrapper
- Returns { html, text }
  T7: Auth Callback Enhancement
  What: After acceptInviteToOrganization(), if the new membership has role=-1 (Viewer), auto-set the display_name on the users record from the notification recipient's name.
  Files: src/app/auth/callback/route.ts
  Requirements: R32
  Dependencies: T1, T4
  Acceptance criteria:
- After acceptInviteToOrganization() succeeds, fetch the newly linked membership
- If membership.role === -1: query ultaura_notification_recipients by email to get the recipient's name, then UPDATE users SET display_name = name WHERE id = userId
- If the users record already has a display_name, do NOT overwrite it
- Non-viewer invite flow is unchanged
  T8: loadAppDataForUser Multi-Org Support
  What: Modify the dashboard data loader to handle users with multiple organizations (own + viewed) and detect former viewers.
  Files: src/lib/server/loaders/load-app-data.ts
  Requirements: R13, R23, R28
  Dependencies: T2
  Acceptance criteria:
- After getOrganizationsByUserId(), sort results: Owner (2) > Admin (1) > Member (0) > Viewer (-1)
- Take the first non-Viewer org as the default (for "own account first" behavior)
- If ALL orgs are Viewer, take the first Viewer org
- If NO orgs found AND user.onboarded === true: redirect to /dashboard/access-removed instead of /onboarding (former viewer whose access was revoked)
- If NO orgs found AND user.onboarded === false: redirect to /onboarding as before (new user)
- Return the full organizationsData array (not just the first) so the layout can detect multi-org
- Return role from the selected organization's membership
- New return field: allOrganizations: { organization, role }[]
  T9: Dashboard Layout — Viewer Context
  What: Pass viewer information through the layout to all dashboard pages.
  Files: src/app/dashboard/(app)/layout.tsx, src/app/dashboard/(app)/components/OrganizationScopeLayout.tsx, src/lib/contexts/viewer.ts (NEW)
  Requirements: R17, R22, R30
  Dependencies: T4, T8
  Acceptance criteria:
  ViewerContext (src/lib/contexts/viewer.ts):
  interface ViewerContextValue {
  isViewer: boolean;
  accountHolderName: string | null;
  seniorName: string | null; // first line's name, or null
  }
- Created as a React Context with a Provider
  layout.tsx changes:
- Reads role from loadAppDataForUser() return
- If role is Viewer: calls getViewerContext(adminClient, account.id, userId) to get account holder name and senior name
- Passes isViewer, accountHolderName, seniorName, allOrganizations to OrganizationScopeLayout
  OrganizationScopeLayout changes:
- Wraps children in ViewerContext.Provider
- Renders ViewerModeBanner when isViewer === true
- Passes allOrganizations to the sidebar for account switching
  T10: Viewer Mode Banner
  What: Create a persistent, non-dismissible banner that appears on all dashboard pages for viewers.
  Files: src/components/ViewerModeBanner.tsx (NEW)
  Requirements: R17, R22
  Dependencies: T9
  Acceptance criteria:
- Renders at the top of the dashboard content area (below TopNavBar, above page content)
- Text: "You're viewing Senior's Name's dashboard — managed by Account Holder Name"
- If there are multiple lines (no single "senior"), use the account name instead
- Styling: warm background (amber-50 or similar), friendly icon (eye or info), rounded, px-4 py-3, text-sm
- Not dismissible — no close button
- Responsive: stacks text on mobile
- Uses ViewerContext to get names
  T11: Account Switcher
  What: Create an account switcher dropdown for users with multiple organizations.
  Files: src/app/dashboard/(app)/components/AccountSwitcher.tsx (NEW), src/app/dashboard/(app)/components/AppSidebar.tsx
  Requirements: R13
  Dependencies: T8, T9
  Acceptance criteria:
- Only rendered when user has 2+ organizations
- Shows in the sidebar bottom area (replaces the static org name display for multi-org users)
- Each entry shows: account name (bold) + role badge (small, muted: "Owner" or "Viewing")
- Current account is visually highlighted
- Clicking an entry switches context:
  1. Sets the existing `${userId}-organizationId` cookie (matches the pattern already used in `OrganizationScopeLayout.tsx:62-65`)
  2. Calls router.refresh() to re-run the server layout with the new org
- Uses the same Select / dropdown pattern as the existing OrganizationsSelector
- Mobile: appears in the MobileAppNavigation component as well
  T12: Navigation Config for Viewers
  What: Update the sidebar navigation to hide restricted sections for viewers.
  Files: src/navigation.config.tsx, src/app/dashboard/(app)/components/AppSidebarNavigation.tsx
  Requirements: R4, R5, R30
  Dependencies: T2, T9
  Acceptance criteria:
  NavigationContext extended:
  interface NavigationContext {
  userType?: 'self' | 'family_managed';
  accountId?: string;
  role?: MembershipRole; // NEW
  }
  Navigation items for viewers (role === Viewer):
- Dashboard: Home — visible
- Manage: Lines — visible (label: "Lines" not "My Line"), Calls — visible, Reminders — visible
- Care: Insights — visible, Alerts — visible
- Account: Usage — hidden, Privacy — hidden
- ProfileDropdown.tsx: "Settings → Profile" link remains visible. "Subscription" link hidden for viewers (src/components/ProfileDropdown.tsx:149-159).
  AppSidebarNavigation reads role from the org data and passes to NAVIGATION_CONFIG().
  T13: Read-Only Enforcement — Dashboard Pages
  What: Add viewer-mode detection to all interactive dashboard pages and hide action controls.
  Files: See Section 4.10 for full list
  Requirements: R3, R31
  Dependencies: T9
  Acceptance criteria:
  Create a reusable hook: useIsViewer() that reads from ViewerContext:
  function useIsViewer(): boolean {
  const { isViewer } = useViewerContext();
  return isViewer;
  }
  For each affected page, wrap action controls in {!isViewer && (...)}:
- Home page: Hide quick action buttons (Add Line, Schedule Call, Set Reminder, Place Call)
- Lines list: Hide "Add Line" button
- Line detail: Hide action buttons in LineHeaderActions; in LineTabNav hide Settings, Call Controls, Topics, and Contacts tabs (only Overview and Milestones remain)
- Calls page: Hide "Add Schedule" button, hide edit/delete actions on schedule cards
- Reminders page: Hide "Add Reminder" button, hide edit/delete actions on reminder cards
- Alerts page: Hide settings/configuration toggles
- Insights pages: Hide any action buttons (notification preference toggles, pause mode)
  T14: Route-Level Viewer Guards
  What: Add server-side guards on restricted routes that redirect viewers back to allowed pages.
  Files: See Section 4.11 for full list
  Requirements: R5
  Dependencies: T8
  Acceptance criteria:
  Create a reusable helper that accepts the already-loaded role (avoids a duplicate `loadAppDataForUser()` call — the parent layout already calls it and Next.js deduplicates `fetch` but not arbitrary async calls):
  async function redirectViewerAway(role: MembershipRole, redirectTo: string = '/dashboard'): Promise<void> {
  if (role === MembershipRole.Viewer) {
  redirect(redirectTo);
  }
  }
  Each restricted route's server component should receive the `role` from its layout's loaded data (via `searchParams`, a shared cache, or by passing through the layout). If that's not feasible, use Next.js `cache()` wrapper around `loadAppDataForUser()` to ensure deduplication within a single request.
  Apply to each restricted route's server component:
- /dashboard/usage → redirect to /dashboard
- /dashboard/privacy → redirect to /dashboard
- /dashboard/settings/subscription → redirect to /dashboard (guard at subscription sub-layout, NOT settings/layout.tsx — profile pages must remain accessible to viewers)
- /dashboard/settings/organization → redirect to /dashboard
- /dashboard/lines/[lineId]/contacts → redirect to line overview
- /dashboard/lines/[lineId]/topics → redirect to line overview
- /dashboard/lines/[lineId]/call-controls → redirect to line overview
- /dashboard/lines/[lineId]/settings → redirect to line overview
- /dashboard/lines/[lineId]/verify → redirect to line overview
  T15: Privacy Center — Dashboard Access Toggle
  What: Add the "Dashboard Access" toggle to the recipient list in the Privacy Center.
  Files: src/app/dashboard/(app)/privacy/components/InvitedFamilyList.tsx, src/app/dashboard/(app)/privacy/hooks/useDashboardSharingToggle.ts (NEW)
  Requirements: R1, R2, R14, R15, R20
  Dependencies: T3, T4
  Acceptance criteria:
  InvitedFamilyList.tsx changes:
- Add "Dashboard Access" column after "Status" column
- For each recipient:
  - If confirmedAt === null: show nothing (toggle disabled, hidden, or tooltip: "Confirm email first")
  - If confirmedAt !== null && unsubscribedAt !== null: show toggle (unsubscribe doesn't affect dashboard access per R11)
  - If confirmedAt !== null: show toggle switch - ON if dashboardAccessGrantedAt !== null - OFF if dashboardAccessGrantedAt === null
    useDashboardSharingToggle.ts (NEW hook):
- toggleDashboardAccess(recipientId, currentState):
  - If turning ON: show confirmation dialog first
  - Dialog text: "Grant dashboard access? This will give Recipient Name read-only access to your dashboard, including call history, insights, and wellness data for all your lines. If new user: They'll receive an email to create their account. If existing user: They'll receive a notification email."
  - On confirm: call grantDashboardAccess() server action
  - If turning OFF: call revokeDashboardAccess() server action (no confirmation needed for revocation)
  - Loading state during server action
  - Toast on success: "Dashboard access granted to Name" / "Dashboard access removed for Name"
  - Error handling with toast
    T16: "Access Removed" Page
    What: Create a dedicated page for viewers whose access has been revoked.
    Files: src/app/dashboard/access-removed/page.tsx (NEW)
    Requirements: R10, R23
    Dependencies: T8
    Acceptance criteria:
- Server component — no auth required (the user may or may not have a session)
- Content: centered card with:
  - Icon: shield or lock
  - Heading: "Dashboard access removed"
  - Body: "Your access to this dashboard has been removed by the account holder. If you believe this is an error, please contact them directly."
  - CTA button: "Go to Home" → / or "Log In" → /auth/sign-in if no session
- Clean, minimal styling matching the auth pages
- No sidebar or dashboard chrome — standalone page
  T17: Signup Link Processing
  What: Ensure the standard signup page correctly handles the inviteCode query parameter so new viewers can complete signup and have their membership linked.
  Files: src/app/auth/sign-up/page.tsx (verify existing behavior), src/app/auth/callback/route.ts (verify invite processing)
  Requirements: R7
  Dependencies: T4, T6
  Acceptance criteria:
- The signup email links to: {SITE_URL}/auth/sign-up?inviteCode={code}
- The signup page passes inviteCode through to the emailRedirectTo URL
- After email verification, the callback receives inviteCode as a query param
- The callback calls acceptInviteToOrganization() which links the pending membership
- The next parameter defaults to /dashboard for viewer invites
- Existing org invite flow continues to work unchanged
- Verify: the existing auth flow already handles inviteCode for org member invites — confirm it works identically for viewer memberships (role=-1)
  T18: Auto-Link Fallback on Dashboard Load
  What: When a user loads the dashboard, check for any unlinked viewer memberships (pending memberships where invited_email matches the user's email) and auto-link them.
  Files: src/lib/server/loaders/load-app-data.ts
  Requirements: R8
  Dependencies: T1, T8
  Acceptance criteria:
- After getOrganizationsByUserId(), also check: SELECT \* FROM memberships WHERE invited_email = current_user_email AND code IS NOT NULL AND role = -1
- For each match: update user_id = auth.uid(), clear code and invited_email
- This handles the edge case where an existing user didn't use the invite link but logged in directly
- Uses admin client for the update (bypasses RLS)
- Only runs for viewer memberships (role=-1) to avoid interfering with org invites
- Wrap the auto-link UPDATE in a try/catch to handle the race condition where `accept_invite_to_organization()` already linked the membership (the UNIQUE constraint on `(user_id, organization_id)` would throw). On conflict, silently succeed — the membership is already linked.

---

7. Type & API Contracts
   7.1 MembershipRole (modified)
   // src/lib/organizations/types/membership-role.ts
   enum MembershipRole {
   Viewer = -1, // NEW — read-only dashboard access
   Member = 0,
   Admin = 1,
   Owner = 2,
   }
   7.2 NotificationRecipient (modified)
   // src/lib/ultaura/types.ts
   interface NotificationRecipient {
   id: string;
   accountId: string;
   name: string;
   email: string;
   phoneE164: string | null;
   relationship?: string | null;
   isTrustedContact: boolean;
   trustedContactId: string | null;
   confirmedAt: string | null;
   unsubscribedAt: string | null;
   dashboardAccessGrantedAt: string | null; // NEW
   createdAt: string;
   updatedAt: string;
   }
   7.3 ViewerContextValue (new)
   // src/lib/contexts/viewer.ts
   interface ViewerContextValue {
   isViewer: boolean;
   accountHolderName: string | null;
   seniorName: string | null;
   }
   const ViewerContext = createContext<ViewerContextValue>({
   isViewer: false,
   accountHolderName: null,
   seniorName: null,
   });
   function useViewerContext(): ViewerContextValue;
   function useIsViewer(): boolean;
   7.4 loadAppDataForUser Return Type (modified)
   // Existing return type extended with:
   interface AppData {
   // ... existing fields ...
   role: MembershipRole; // role for the selected organization
   allOrganizations: Array<{ // NEW — all user's org memberships
   organization: Organization;
   role: MembershipRole;
   }>;
   }
   7.5 NavigationContext (modified)
   // src/navigation.config.tsx
   interface NavigationContext {
   userType?: 'self' | 'family_managed';
   accountId?: string;
   role?: MembershipRole; // NEW
   }
   7.6 Dashboard Sharing Server Actions
   // src/lib/ultaura/dashboard-sharing.ts
   // Grant dashboard access to a confirmed notification recipient
   async function grantDashboardAccess(
   accountId: string,
   recipientId: string
   ): Promise<ActionResult<{ isExistingUser: boolean }>>;
   // Revoke dashboard access from a notification recipient
   async function revokeDashboardAccess(
   accountId: string,
   recipientId: string
   ): Promise<ActionResult<void>>;
   // Internal: delete viewer membership when recipient is removed
   async function deleteViewerMembershipForRecipient(
   accountId: string,
   recipientEmail: string
   ): Promise<void>;
   // Internal: get context for the viewer mode banner
   async function getViewerContext(
   adminClient: SupabaseClient<Database>,
   accountId: string,
   userId: string
   ): Promise<{ accountHolderName: string; seniorName: string | null }>;
   // Utility: check if a role is the Viewer role
   function isViewerRole(role: MembershipRole): boolean;
   7.7 Email Template Props
   // src/lib/emails/dashboard-access-invite.tsx
   interface DashboardAccessInviteProps {
   recipientName: string;
   accountName: string;
   seniorName: string;
   inviterName: string;
   signupLink: string; // {SITE_URL}/auth/sign-up?inviteCode={code}
   }
   // src/lib/emails/dashboard-access-granted.tsx
   interface DashboardAccessGrantedProps {
   recipientName: string;
   accountName: string;
   seniorName: string;
   inviterName: string;
   loginLink: string; // {SITE_URL}/auth/sign-in?next=/dashboard
   }
   7.8 useDashboardSharingToggle Hook
   // src/app/dashboard/(app)/privacy/hooks/useDashboardSharingToggle.ts
   interface UseDashboardSharingToggle {
   isConfirmDialogOpen: boolean;
   pendingRecipient: NotificationRecipient | null;
   isLoading: boolean;
   requestGrant(recipient: NotificationRecipient): void; // opens confirm dialog
   confirmGrant(): Promise<void>; // executes grant
   cancelGrant(): void; // closes dialog
   revoke(recipientId: string): Promise<void>; // immediate revoke
   }

---

8. Edge Cases & Error Handling
   8.1 Granting Access
   | Edge Case | Handling |
   |-----------|----------|
   | Recipient not confirmed | Toggle is not rendered (R1). If server action receives an unconfirmed recipient, return error: "Recipient must confirm their email before receiving dashboard access." |
   | Recipient already has dashboard access | Toggle is already ON. No action needed. Server action is idempotent — re-granting returns success without creating a duplicate membership. Check UNIQUE constraint on (user_id, organization_id). |
   | Recipient's email matches an existing org member | The existing membership has role ≥ 0 (Member/Admin/Owner). They already have full access. The toggle should show as "Already has access" (disabled, with tooltip). Check: SELECT role FROM memberships WHERE organization_id = X AND user_id = (SELECT get_auth_user_id_by_email(email)). If role >= 0, skip membership creation. |
   | Email send failure | If the signup/notification email fails to send, rollback: delete the viewer membership and clear dashboard_access_granted_at. Return error to UI. Follow the same rollback pattern as inviteNotificationRecipient(). |
   | 5 recipients, all with dashboard access | Allowed per R14. No sub-limit. |
   | Concurrent grant by two sessions | The UNIQUE constraint on (user_id, organization_id) prevents duplicate memberships. The second attempt gets a constraint violation, which the server action catches and treats as success (idempotent). |
   8.2 Revoking Access
   | Edge Case | Handling |
   |-----------|----------|
   | Viewer is currently browsing the dashboard | On their next page load, loadAppDataForUser() will not find the membership. If they have their own account, they'll see their own dashboard (the viewed account disappears from the switcher). If they only had viewer access, they're redirected to the "Access Removed" page. Per R10, this takes effect immediately — no grace period. |
   | Revoke then re-grant quickly | Each grant creates a fresh membership. If the viewer already has an auth account (from the first grant), the re-grant auto-links immediately. |
   | Revoke a pending (not yet accepted) viewer invite | Delete the pending membership (where user_id IS NULL, code IS NOT NULL). The invite code is invalidated. If the recipient later clicks the signup link, acceptInviteToOrganization() finds no matching membership and fails gracefully. |
   8.3 Recipient Deletion
   | Edge Case | Handling |
   |-----------|----------|
   | Delete recipient who has dashboard access | removeNotificationRecipient() calls deleteViewerMembershipForRecipient() first, then deletes the recipient row. The membership deletion happens even if the recipient's email doesn't match a current auth user (pending memberships are deleted too). |
   | Delete recipient whose viewer already has other accounts | Only the viewer membership for THIS account's org is deleted. Other memberships (own account, other viewed accounts) are unaffected. |
   8.4 Unsubscribe Independence
   | Edge Case | Handling |
   |-----------|----------|
   | Recipient unsubscribes from emails but has dashboard access | Per R11, dashboard access is unaffected. The toggle remains ON. The unsubscribedAt field on the recipient does not influence the membership. |
   | Recipient re-invites after unsubscribing | The re-invite clears unsubscribedAt and confirmedAt but does NOT clear dashboard_access_granted_at (since the fields are independent). However, the toggle should be disabled while the recipient re-confirms (R1 requires confirmation). Implementation: the toggle is hidden/disabled when confirmedAt === null, regardless of dashboardAccessGrantedAt. When re-confirmed, the toggle reappears in its previous state. |
   8.5 Multi-Account Viewers
   | Edge Case | Handling |
   |-----------|----------|
   | Viewer has own account + 2 viewed accounts | Account switcher shows 3 entries. Default: own account. Switcher shows role badge per R13. |
   | Viewer's own account is deleted | They lose the Owner membership but keep Viewer memberships. On next login, loadAppDataForUser() finds only Viewer orgs. Dashboard loads with the first Viewer org. No "Access Removed" redirect (they still have viewer access). |
   | All viewer access revoked for a multi-account viewer | If they still have their own account, they see that. If all memberships are gone, they see the "Access Removed" page. |
   | Viewer switches accounts to a revoked one | The `${userId}-organizationId` cookie points to an org they no longer have access to. loadAppDataForUser() filters org list to only those the user has memberships for. If the selected org is not in the list, fall back to the first org. |
   8.6 Auth & Signup
   | Edge Case | Handling |
   |-----------|----------|
   | Viewer signs up with a different email than the invitation | acceptInviteToOrganization() matches by code, not email. The membership is linked to whatever auth.uid() accepts the invite. This is acceptable — the account holder controls access via the toggle, and the membership can be revoked regardless of the viewer's signup email. |
   | Invite code is expired or already used | acceptInviteToOrganization() fails. The viewer sees a generic error. They can contact the account holder to re-grant access (which generates a new invite code). |
   | Viewer deletes their Supabase auth account | The users table FK cascades: users.id → auth.users ON DELETE CASCADE. The membership user_id FK to users is set to null or cascades. The viewer can no longer log in. No action needed. |
   | Race condition: grant and delete recipient simultaneously | The ultaura_notification_recipients.account_id FK cascades to the ultaura_accounts table, but not to memberships. The deleteViewerMembershipForRecipient() call in removeNotificationRecipient() handles cleanup. If the recipient is deleted while the grant is in progress, the grant's INSERT into memberships might succeed first — the subsequent DELETE from removeNotificationRecipient will also delete the membership. |
   8.7 Permission Boundaries
   | Edge Case | Handling |
   |-----------|----------|
   | Viewer tries to call a server action that modifies data | All mutation server actions use requireAccountOwner() or requireAccountOwnerContext(), which check created_by_user_id !== viewer_user_id. The action returns an error. |
   | Viewer crafts a direct Supabase query from the browser | Restrictive RLS policies on 25 tables (core + personalization + safety) block INSERT/UPDATE/DELETE for viewers at the database level. This provides comprehensive coverage — any remaining tables without explicit restrictive policies are either read-only by nature (SELECT-only policies), service-role-only, or protected by application-layer requireAccountOwner() checks. |
   | Viewer accesses a restricted route directly via URL | Server-side viewer guards (T14) redirect to /dashboard or the line overview. |

---

9. Testing & Verification
   9.1 TypeScript Compilation

- Run pnpm tsc --noEmit from the project root. Must pass with zero errors.
- Verify the MembershipRole.Viewer value is recognized everywhere MembershipRole is used.
  9.2 Database Migration
- Apply migration to a fresh Supabase instance: supabase db reset or supabase migration up
- Verify: SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ultaura_notification_recipients' AND column_name = 'dashboard_access_granted_at' returns 1 row
- Verify: SELECT proname FROM pg_proc WHERE proname = 'is_dashboard_viewer' returns 1 row
- Verify: SELECT proname FROM pg_proc WHERE proname = 'get_auth_user_id_by_email' returns 1 row
- Verify restrictive policies: SELECT polname, polcmd FROM pg_policy WHERE polname LIKE 'Dashboard viewers%' returns all expected policies
  9.3 RLS Verification
  Test with two Supabase clients: one for the account owner, one for a viewer.
  Setup:

1. Create an account owner with an account, org, and membership (role=2)
2. Create a viewer auth user
3. Insert a viewer membership: { user_id: viewer_id, organization_id: account_org_id, role: -1 }
   Verify SELECT works for viewer:

- viewer_client.from('ultaura_accounts').select('\*').eq('id', account_id) → returns 1 row
- viewer_client.from('ultaura_lines').select('\*').eq('account_id', account_id) → returns lines
  Verify WRITE blocked for viewer (restrictive policies):
- viewer_client.from('ultaura_accounts').update({ name: 'hacked' }).eq('id', account_id) → error (restrictive policy blocks)
- viewer_client.from('ultaura_lines').insert({ ... }) → error
- viewer_client.from('ultaura_schedules').delete().eq('id', schedule_id) → error
  Verify WRITE works for owner:
- owner_client.from('ultaura_accounts').update({ name: 'new name' }).eq('id', account_id) → success
- Confirm restrictive policies don't block non-viewers
  9.4 Grant/Revoke Flow
  New user grant:

1. Toggle ON for a confirmed recipient → confirm dialog → confirm
2. Verify: dashboard_access_granted_at is set on the recipient
3. Verify: pending membership created in memberships (with invited_email, code, role=-1)
4. Verify: signup email sent to recipient
5. Recipient signs up → verify membership is linked → verify user record created → verify redirect to /dashboard
   Existing user grant:
6. Toggle ON for a recipient whose email matches an existing auth user
7. Verify: membership created with user_id set immediately (no invite code)
8. Verify: notification email sent
9. Existing user logs in → verify they see the account in the switcher
   Revoke:
10. Toggle OFF → verify dashboard_access_granted_at set to null → verify membership deleted
11. Viewer refreshes → verify redirect to "Access Removed" page (if viewer-only) or account switch (if multi-account)
    9.5 UI States to Verify
    | State | Expected UI |
    |-------|-------------|
    | Recipient not yet confirmed | No toggle visible in "Dashboard Access" column; tooltip or dash indicating "Confirm email first" |
    | Confirmed recipient, access not granted | Toggle OFF |
    | Confirmed recipient, access granted (pending signup) | Toggle ON, with "Pending" indicator |
    | Confirmed recipient, access granted (active) | Toggle ON, with "Active" indicator |
    | Unsubscribed recipient with dashboard access | Toggle ON, visible and functional (R11) |
    | Viewer mode banner | Visible on every page, not dismissible, correct names |
    | Account switcher (multi-org) | Shows all accounts with role badges, switching works |
    | Restricted routes for viewer | Redirect to allowed pages |
    | Action buttons hidden for viewer | No edit/delete/add buttons visible on any page |
    9.6 Edge Case Verification

- Grant access → immediately revoke → grant again → verify clean state
- Delete a recipient with dashboard access → verify membership cleaned up
- Viewer with own account + viewer access → revoke viewer → verify own account still works
- Former viewer (no accounts left) → verify "Access Removed" page
- Viewer navigating directly to /dashboard/settings → verify redirect
- Viewer navigating directly to /dashboard/privacy → verify redirect

---

10. Out of Scope
    | Item | Reason |
    |------|--------|
    | Per-section access toggles | Decision 5 explicitly rejects per-section granularity. All-or-nothing. |
    | Per-line access control | Decision 6 explicitly rejects per-line control. Viewer sees all lines. |
    | Write access for viewers | Decision 2 explicitly locks to read-only. No "editor" role planned. |
    | Viewer → Account holder upgrade | Not in requirements. A viewer cannot "become" an account holder through dashboard sharing. |
    | Audit logging of viewer activity | Not required by any decision. Could be added later. |
    | Real-time revocation (WebSocket push) | R10 says "next page load or API call." No need for instant push-based revocation. |
    | Custom branding per viewer | Not required. All viewers see the same dashboard theme. |
    | Viewer-specific notification preferences | R18 says no additional in-dashboard notifications. They receive emails as recipients. |
    | Mobile app viewer mode | Only the web dashboard is in scope. |
    | Viewer session timeout policy | Uses the same Supabase Auth session management as all users. |
    | Analytics/tracking of viewer engagement | Not required. |
    | Revocation notification email | Not explicitly required. Could be a nice-to-have but is out of scope for V1. |
    | "Remember last account" for account switcher | Interview answer says "Their own account first." Cookie-based preference memory is a future enhancement. |
    | Modifying the telephony backend | Dashboard Sharing is purely a dashboard/auth feature. No changes to call handling, voice tools, or telephony services. |
    | Changes to the existing notification recipient invite flow | The invite/confirm/unsubscribe email flow is untouched. Dashboard sharing is an orthogonal feature layer. |

---
