# Health Profile — Launch Checklist

> **Feature**: Health Profile
> **Spec**: `specs/health-profile.md`
> **PRD**: `health-feature.md`
> **Status**: Implementation complete. This checklist must be fully passed before the `health_profile` feature flag is set to `true` in production.

---

## Phase 0: Pre-QA Environment Setup

### 0.1 Local Supabase

- [ ] Local Supabase is running (`pnpm supabase:start`)
- [ ] Database has been freshly reset with all migrations applied (`pnpm supabase:db:reset`)
- [ ] Database types regenerated (`pnpm typegen`)
- [ ] Shared packages built (`pnpm build:packages`)
- [ ] TypeScript compiles clean (`pnpm typecheck`)
- [ ] Dev server running (`pnpm dev`)

### 0.2 Verify Seed Data

Log in as `payer@ultaura-seed.test` / `testingpassword` and confirm:

- [ ] Account is on the `family` plan with `active` status
- [ ] Account `user_type` is `family_managed`
- [ ] 4 lines exist: Margaret Johnson, Robert Chen, Eleanor Martinez, James Wilson
- [ ] Each line has a `short_id` visible in the URL when viewing line details

### 0.3 Create Test Scenarios

You need 3 additional test states. Run these SQL commands in the Supabase SQL editor (Studio → SQL Editor):

**Scenario A: Viewer / Non-Owner Member**

```sql
-- Create auth user with all required token columns as empty strings (GoTrue requires non-NULL)
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, instance_id, aud, role,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, phone_change_token, reauthentication_token,
  email_change, phone_change
)
VALUES (
  'aaaaaaaa-0000-4000-a000-000000000002',
  'viewer@ultaura-seed.test',
  crypt('testingpassword', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"Viewer User"}',
  now(), now(),
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  '', '', '', '', '', '', '', ''
);

-- GoTrue requires an identity row to authenticate
INSERT INTO auth.identities (id, user_id, provider, identity_data, provider_id, created_at, updated_at, last_sign_in_at)
VALUES (
  'aaaaaaaa-0000-4000-a000-000000000002',
  'aaaaaaaa-0000-4000-a000-000000000002',
  'email',
  '{"sub":"aaaaaaaa-0000-4000-a000-000000000002","email":"viewer@ultaura-seed.test"}',
  'viewer@ultaura-seed.test',
  now(), now(), now()
);

-- Create matching public user row (column is "onboarded", not "onboarding_complete")
INSERT INTO public.users (id, photo_url, display_name, onboarded)
VALUES ('aaaaaaaa-0000-4000-a000-000000000002', NULL, 'Viewer User', true);

-- Add as viewer (role = -1) to the Johnson Family org
INSERT INTO memberships (organization_id, user_id, role)
SELECT id, 'aaaaaaaa-0000-4000-a000-000000000002', -1
FROM organizations WHERE name = 'Johnson Family';
```

- [ ] Viewer account created: `viewer@ultaura-seed.test` / `testingpassword`
- [ ] Viewer has role `-1` (viewer) in the Johnson Family organization

**Scenario B: Trial Account on Comfort Plan**

```sql
-- Create auth user
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, instance_id, aud, role,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, phone_change_token, reauthentication_token,
  email_change, phone_change
)
VALUES (
  'aaaaaaaa-0000-4000-a000-000000000003',
  'trial@ultaura-seed.test',
  crypt('testingpassword', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"Trial User"}',
  now(), now(),
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  '', '', '', '', '', '', '', ''
);

INSERT INTO auth.identities (id, user_id, provider, identity_data, provider_id, created_at, updated_at, last_sign_in_at)
VALUES (
  'aaaaaaaa-0000-4000-a000-000000000003',
  'aaaaaaaa-0000-4000-a000-000000000003',
  'email',
  '{"sub":"aaaaaaaa-0000-4000-a000-000000000003","email":"trial@ultaura-seed.test"}',
  'trial@ultaura-seed.test',
  now(), now(), now()
);

INSERT INTO public.users (id, photo_url, display_name, onboarded)
VALUES ('aaaaaaaa-0000-4000-a000-000000000003', NULL, 'Trial User', true);

-- Create org
INSERT INTO organizations (name) VALUES ('Trial Family');

-- Add as owner
INSERT INTO memberships (organization_id, user_id, role)
SELECT id, 'aaaaaaaa-0000-4000-a000-000000000003', 2
FROM organizations WHERE name = 'Trial Family';

-- Create Ultaura account on comfort plan but trial status
INSERT INTO ultaura_accounts (id, organization_id, name, plan_id, status, user_type, created_by_user_id, billing_email)
SELECT
  'bbbbbbbb-0000-4000-a000-000000000002',
  id,
  'Trial Family',
  'comfort',
  'trial',
  'family_managed',
  'aaaaaaaa-0000-4000-a000-000000000003',
  'trial@ultaura-seed.test'
FROM organizations WHERE name = 'Trial Family';

-- Create subscription (dashboard requires a subscription row to load)
INSERT INTO ultaura_subscriptions (account_id, plan_id, status, billing_interval)
VALUES ('bbbbbbbb-0000-4000-a000-000000000002', 'comfort', 'trialing', 'month');

-- Create one line (column is "phone_e164", and "short_id" is required)
INSERT INTO ultaura_lines (id, account_id, display_name, phone_e164, status, timezone, short_id)
VALUES (
  'cccccccc-0000-4000-a000-000000000005',
  'bbbbbbbb-0000-4000-a000-000000000002',
  'Trial Senior',
  '+15551000005',
  'active',
  'America/New_York',
  'trial001'
);
```

- [ ] Trial account created: `trial@ultaura-seed.test` / `testingpassword`
- [ ] Account is on `comfort` plan with `trial` status

**Scenario C: Care Plan Account**

```sql
-- Create auth user
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, instance_id, aud, role,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, phone_change_token, reauthentication_token,
  email_change, phone_change
)
VALUES (
  'aaaaaaaa-0000-4000-a000-000000000004',
  'care@ultaura-seed.test',
  crypt('testingpassword', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"Care User"}',
  now(), now(),
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  '', '', '', '', '', '', '', ''
);

INSERT INTO auth.identities (id, user_id, provider, identity_data, provider_id, created_at, updated_at, last_sign_in_at)
VALUES (
  'aaaaaaaa-0000-4000-a000-000000000004',
  'aaaaaaaa-0000-4000-a000-000000000004',
  'email',
  '{"sub":"aaaaaaaa-0000-4000-a000-000000000004","email":"care@ultaura-seed.test"}',
  'care@ultaura-seed.test',
  now(), now(), now()
);

INSERT INTO public.users (id, photo_url, display_name, onboarded)
VALUES ('aaaaaaaa-0000-4000-a000-000000000004', NULL, 'Care User', true);

INSERT INTO organizations (name) VALUES ('Care Family');

INSERT INTO memberships (organization_id, user_id, role)
SELECT id, 'aaaaaaaa-0000-4000-a000-000000000004', 2
FROM organizations WHERE name = 'Care Family';

INSERT INTO ultaura_accounts (id, organization_id, name, plan_id, status, user_type, created_by_user_id, billing_email)
SELECT
  'bbbbbbbb-0000-4000-a000-000000000003',
  id,
  'Care Family',
  'care',
  'active',
  'family_managed',
  'aaaaaaaa-0000-4000-a000-000000000004',
  'care@ultaura-seed.test'
FROM organizations WHERE name = 'Care Family';

-- Create subscription (dashboard requires a subscription row to load)
INSERT INTO ultaura_subscriptions (account_id, plan_id, status, billing_interval)
VALUES ('bbbbbbbb-0000-4000-a000-000000000003', 'care', 'active', 'month');

INSERT INTO ultaura_lines (id, account_id, display_name, phone_e164, status, timezone, short_id)
VALUES (
  'cccccccc-0000-4000-a000-000000000006',
  'bbbbbbbb-0000-4000-a000-000000000003',
  'Care Senior',
  '+15551000006',
  'active',
  'America/New_York',
  'care0001'
);
```

- [ ] Care account created: `care@ultaura-seed.test` / `testingpassword`
- [ ] Account is on `care` plan with `active` status

### 0.4 Enable Feature Flag for Testing

```sql
UPDATE ultaura_runtime_feature_flags
SET enabled = true, updated_at = now()
WHERE flag_key = 'health_profile';
```

- [ ] Feature flag set to `true` in local database

---

## Phase 1: Ownership Backfill Verification (Spec Section 15.7)

> This MUST pass before any Health QA is valid. Health fails closed when `created_by_user_id` is null or conflicted.

### 1.1 Verify Canonical Owner State

Run this query to check all accounts:

```sql
SELECT
  a.id AS account_id,
  a.name,
  a.plan_id,
  a.status,
  a.created_by_user_id,
  u.email AS owner_email,
  (SELECT count(*) FROM memberships m
   JOIN organizations o ON o.id = m.organization_id
   WHERE o.id = a.organization_id AND m.role = 2) AS owner_count
FROM ultaura_accounts a
LEFT JOIN public.users u ON u.id = a.created_by_user_id;
```

- [ ] Every account has a non-null `created_by_user_id`
- [ ] Every account's `created_by_user_id` matches the single active owner membership
- [ ] No account has zero or multiple owner memberships (owner_count = 1 for all)
- [ ] If any conflicts exist, note them here: _____________

### 1.2 Verify Health Consent Rows Backfilled

```sql
SELECT l.id, l.display_name, hc.health_consent
FROM ultaura_lines l
LEFT JOIN ultaura_health_line_consent hc ON hc.line_id = l.id
ORDER BY l.display_name;
```

- [ ] Every line has a corresponding `ultaura_health_line_consent` row
- [ ] All consent values are `not_requested` (fresh state)

---

## Phase 2: Feature Flag Kill Switch (Spec Section 15.2)

### 2.1 Flag OFF — Everything Hidden

Set the flag to `false`:

```sql
UPDATE ultaura_runtime_feature_flags SET enabled = false, updated_at = now() WHERE flag_key = 'health_profile';
```

Log in as `payer@ultaura-seed.test`:

- [ ] Health nav item is NOT visible in the sidebar
- [ ] Health nav item is NOT visible in mobile navigation
- [ ] Navigating directly to `/dashboard/health` redirects away (does not show Health page)
- [ ] Health does not appear in search results (Cmd+K)

Re-enable the flag:

```sql
UPDATE ultaura_runtime_feature_flags SET is_enabled = true WHERE flag_key = 'health_profile';
```

- [ ] Health nav item now appears in the sidebar
- [ ] Health page is accessible

### 2.2 Flag OFF — No Code Deploy Required

- [ ] Confirm: toggling the flag requires only a database UPDATE, not a code deployment
- [ ] Confirm: the app reads the flag at runtime (not build time)

---

## Phase 3: Access Control & Navigation

### 3.1 Eligible Owner — Family Plan (payer@ultaura-seed.test)

- [ ] Health nav item is visible in the sidebar
- [ ] Health nav item shows the Health icon (Heart or similar)
- [ ] Clicking Health navigates to `/dashboard/health`
- [ ] No badge/count shown on nav item when no pending suggestions exist

### 3.2 Viewer Account (viewer@ultaura-seed.test)

Log in as the viewer:

- [ ] Health nav item is NOT visible in the sidebar at all (fully hidden, not just disabled)
- [ ] Health nav item is NOT visible in mobile navigation
- [ ] Navigating directly to `/dashboard/health` is denied (redirect, not empty page)
- [ ] Health does not appear in Cmd+K search results

### 3.3 Trial Account on Comfort (trial@ultaura-seed.test)

Log in as the trial user:

- [ ] Health nav item IS visible in the sidebar
- [ ] Health nav item appears locked (lock icon, not clickable as a normal link)
- [ ] No suggestion badges or counts shown on the locked nav item
- [ ] Clicking the locked nav item either does nothing or navigates to a locked landing page
- [ ] The locked landing shows generic preservation language only (no Health details)
- [ ] No Health data, counts, or metadata visible anywhere

### 3.4 Care Plan Account (care@ultaura-seed.test)

Log in as the care user:

- [ ] Health nav item IS visible in the sidebar
- [ ] Health nav item appears locked (same behavior as trial)
- [ ] Locked landing page shown (same as trial)

### 3.5 Non-Owner Member Access (viewer@ultaura-seed.test viewing Johnson Family data)

- [ ] Viewer can access other dashboard pages (e.g., /dashboard) — confirms they're a valid org member
- [ ] Health is completely absent from their experience — no nav, no route, no search

---

## Phase 4: First-Visit Flow & Disclaimer

Log in as `payer@ultaura-seed.test`, navigate to Health:

### 4.1 Disclaimer Dialog

- [ ] On first visit to Health, a disclaimer dialog appears
- [ ] Dialog text matches the exact PRD v1 copy: *"Important: Ultaura is not a doctor or medical professional. Health information stored here is for personal reference and, with your permission, to help Ultaura provide more informed companionship. Ultaura may make mistakes. Always consult qualified healthcare providers for medical advice, diagnosis, or treatment."*
- [ ] Dialog requires acknowledgement (button click) before proceeding
- [ ] After acknowledging, the disclaimer does not re-appear on subsequent visits

### 4.2 Post-Disclaimer State

- [ ] An "About Health Profile" link/button is visible after acknowledgement
- [ ] Clicking "About Health Profile" shows the disclaimer content again (informational, no re-ack needed)

### 4.3 Line Selection (Multi-Line Account)

- [ ] On first visit, the page requires explicit line selection (does not auto-pick)
- [ ] All 4 lines are shown (Margaret, Robert, Eleanor, James)
- [ ] Selecting a line updates the URL to include `?line=<short_id>`
- [ ] The `?line=` parameter uses the line's `short_id`, not the full UUID
- [ ] On subsequent visits, the last-used line is remembered
- [ ] Manually changing `?line=` in the URL overrides the remembered line

### 4.4 Empty State

After selecting a line (first time, no Health data):

- [ ] An empty state message is shown
- [ ] The empty state explains the setup order: Conditions → Medications → Documents → Observations
- [ ] Each setup step is clearly labeled

### 4.5 Default Tab

- [ ] With no pending suggestions, the Conditions tab is the default
- [ ] Tab navigation works: Suggestions, Conditions, Medications, Documents, Observations

---

## Phase 5: Conditions CRUD

Log in as `payer@ultaura-seed.test`, select Margaret Johnson's line:

### 5.1 Create Condition

- [ ] Click "Add Condition" (or equivalent button)
- [ ] A form/dialog appears
- [ ] Type a condition name — autocomplete suggestions appear from ICD-10-CM
- [ ] Select an autocomplete suggestion — name and standardizedId are populated
- [ ] Clear the autocomplete and type a custom name — plain-text entry works
- [ ] Set status to "Active"
- [ ] Enter an approximate date as year-only (e.g., "2020") — verify the input supports year precision
- [ ] Enter stage/severity, treating clinician, and notes (all optional)
- [ ] Save the condition
- [ ] Condition appears in the Active list

### 5.2 Approximate Date Precision

- [ ] Create a condition with year-only date "2022"
- [ ] Edit it — verify the date still shows as "2022" (not "2022-01-01")
- [ ] Create another condition with month precision "2023-06"
- [ ] Edit it — verify it shows as "2023-06" (not "2023-06-01")
- [ ] Create another with full date "2024-03-15"
- [ ] Edit it — verify it stays as "2024-03-15"

### 5.3 Status Changes

- [ ] Change a condition from Active to Monitoring — it stays in the Active list with a "Monitoring" badge
- [ ] Change a condition from Active to Resolved — it moves to the Resolved view
- [ ] Switch between Active and Resolved views

### 5.4 Edit & History

- [ ] Edit a condition's name and notes
- [ ] Open the condition's history — verify it shows the edit with before/after field changes
- [ ] Verify the create event also appears in history

### 5.5 Delete

- [ ] Delete a condition
- [ ] Condition disappears from the Active/Resolved views immediately
- [ ] History still shows the create/edit/delete events

### 5.6 Duplicate Warning

- [ ] Create a condition called "Type 2 Diabetes"
- [ ] Try to create another called "Type 2 Diabetes" or "Diabetes Type 2"
- [ ] A warning appears suggesting you update the existing one instead

---

## Phase 6: Medications CRUD

### 6.1 Create Medication

- [ ] Click "Add Medication"
- [ ] Autocomplete works (RxTerms/RxNorm)
- [ ] Plain-text fallback works
- [ ] Set status to "Current"
- [ ] Enter dosage, frequency (all optional)
- [ ] Enter times of day: add multiple HH:MM times (e.g., 08:00, 20:00)
- [ ] Verify times are auto-sorted and displayed in 24-hour format
- [ ] Try adding more than 8 times — verify the limit is enforced
- [ ] Link to an existing condition (optional)
- [ ] Enter a free-text reason (optional)
- [ ] Save — medication appears in the Current list

### 6.2 Status Views

- [ ] Current, As-needed, and Discontinued views all work
- [ ] Change a medication from Current to Discontinued — it moves to Discontinued view

### 6.3 Linked Condition

- [ ] Create a medication linked to a condition
- [ ] The linked condition name is visible on the medication card
- [ ] Delete the linked condition — the medication still exists, link shows as removed/null

### 6.4 Edit & History

- [ ] Edit a medication's dosage and times
- [ ] History shows field-level before/after changes

### 6.5 Duplicate Warning

- [ ] Similar to conditions — create two medications with similar names, verify warning

---

## Phase 7: Health Consent

### 7.1 Consent State Display

- [ ] The consent card shows the current consent state (should be "Not requested" for all lines)
- [ ] The consent card clearly indicates that Health is NOT being used during calls

### 7.2 Self-Managed Line (if applicable)

If you have a self-managed account to test with:

- [ ] Self-managed user can opt in directly from the dashboard (no spoken consent needed)
- [ ] After opt-in, consent state shows "Granted"
- [ ] Self-managed user can revoke from the dashboard
- [ ] Self-managed lines NEVER show "Denied" state

### 7.3 Family-Managed Re-Prompt Request

For the Johnson Family account (family-managed):

- [ ] A "Request Consent" button (or similar) is available
- [ ] Clicking it sets `health_consent_requested_at` but does NOT change consent state
- [ ] After requesting, the UI shows that a request is pending
- [ ] Trying to request again within 30 days shows a cooldown message
- [ ] The consent history preview shows the request event (newest first)

### 7.4 Consent History

- [ ] Consent history is visible only inside Health (not on the broader Privacy page)
- [ ] History entries are sorted newest first
- [ ] Navigate to `/dashboard/privacy` — verify no Health consent information appears there

---

## Phase 8: Documents

### 8.1 Upload

- [ ] Click "Upload Document" (or equivalent)
- [ ] Select a PDF file — upload succeeds
- [ ] Select a JPEG image — upload succeeds
- [ ] Select a PNG image — upload succeeds
- [ ] Try uploading a .txt file — rejected with clear error
- [ ] Try uploading a file > 25 MB — rejected with clear error
- [ ] Upload progress is shown during the process
- [ ] After upload, the document appears in the Documents tab

### 8.2 Document Metadata

- [ ] Document shows title, category, date, and notes fields
- [ ] Edit the metadata — changes persist
- [ ] Category filtering works (if implemented)
- [ ] Sort by upload date works

### 8.3 Preview & Download

- [ ] Click "Preview" on a PDF — PDF renders inline (or downloads if preview unavailable)
- [ ] Click "Download" — file downloads with correct filename
- [ ] Preview/download for JPEG and PNG works

### 8.4 Delete

- [ ] Delete a document
- [ ] Document disappears immediately from the list
- [ ] Verify the blob is actually removed from storage:

```sql
-- Check that no storage object remains for the deleted document
SELECT storage_object_key FROM ultaura_health_documents
WHERE line_id = '<line-id>' AND storage_object_key IS NOT NULL;
```

### 8.5 Rate Limiting

- [ ] Upload 10 documents rapidly to one line — the 11th should be rate-limited (within 1 hour)

---

## Phase 9: Observations

### 9.1 Create Observation

- [ ] Click "Add Observation"
- [ ] Enter text (required, up to 2000 chars)
- [ ] Select a category (Memory, Mood/Emotional, Physical/Mobility, etc.)
- [ ] Set concern level (Note, Mild Concern, Significant Concern)
- [ ] Set observed date (optional — should default to today in line timezone)
- [ ] Save — observation appears in the list

### 9.2 Views

- [ ] Recent view shows observations sorted by creation date (newest first)
- [ ] Category filter works — selecting "Memory" shows only memory observations
- [ ] "Significant Concern" badge is display-only — does NOT create any alert

### 9.3 Edit & Delete

- [ ] Edit an observation's text and category
- [ ] Delete an observation — removed from list, preserved in history

### 9.4 Pre-Consent State

- [ ] Before consent is granted, observations show a clear label indicating they are private/dashboard-only
- [ ] No observation data flows to AI or calls (verify: Health consent is still `not_requested`)

---

## Phase 10: Medication-Linked Reminders

### 10.1 Create Linked Reminder

- [ ] Open a medication's detail/edit view
- [ ] A reminder panel is visible
- [ ] Click "Add Reminder" — time picker appears
- [ ] Select a time (e.g., 08:00) — reminder is created
- [ ] The reminder shows as "Call-only" — no SMS option exists
- [ ] Reminder shows a clear "Paused" state with explanation (consent not granted)

### 10.2 Pause Source Explanation

- [ ] The reminder panel explains WHY the reminder is paused (e.g., "Health consent not yet granted")
- [ ] If multiple pause sources exist, all are listed

### 10.3 Reminder Isolation — No Leakage

Navigate to each of these surfaces and verify Health-linked reminders are NOT visible:

- [ ] `/dashboard/reminders` (generic Reminders page) — no Health reminders shown
- [ ] Dashboard home page — upcoming reminders widget does NOT include Health reminders
- [ ] Line detail page (any line) — reminder count does NOT include Health reminders
- [ ] Cmd+K search — searching for the reminder time/label returns no Health reminder results
- [ ] Admin timeline (if accessible) — no Health reminder entries

### 10.4 Medication Discontinue Cascades

- [ ] Discontinue a medication that has linked reminders
- [ ] Linked reminders are automatically canceled (not just paused)

---

## Phase 11: Suggestions Queue

> Note: Suggestions are submitted by telephony during calls. To test the dashboard UI, you may need to insert a test suggestion directly:

```sql
-- First, get a line DEK to encrypt the payload (you'll need to do this through the app)
-- Alternative: create a suggestion via the telephony API or a direct service call
-- For basic UI testing, verify the empty state first:
```

### 11.1 Empty State

- [ ] Suggestions tab shows an appropriate empty state message
- [ ] No badge count on nav item or Suggestions tab

### 11.2 Suggestion Badge (if test data available)

- [ ] With pending suggestions, the Suggestions tab becomes the default tab
- [ ] Badge count appears on the Health nav item
- [ ] Badge count appears on the Suggestions tab
- [ ] When Health is locked, badges do NOT appear

### 11.3 Filter

- [ ] Conditions/Medications filter works on the Suggestions tab

---

## Phase 12: Export Verification

### 12.1 Standard Export (No Health Data)

Log in as `payer@ultaura-seed.test`. Before creating any Health data:

- [ ] Navigate to Privacy → Export
- [ ] Request an export
- [ ] Export produces a standard file (not ZIP)
- [ ] Non-owner members (viewer) can see standard exports

### 12.2 Health-Bearing Export

After creating Health data (conditions, medications, etc.):

- [ ] Request a new export
- [ ] Export is classified as Health-bearing (check UI label)
- [ ] Export downloads as a ZIP file
- [ ] ZIP contains `health/manifest.json`
- [ ] ZIP contains `health/documents/` directory (if documents were uploaded)
- [ ] Manifest includes conditions, medications, observations, and history
- [ ] Manifest does NOT include suggestions or Health-linked reminders
- [ ] Download uses the authenticated app route (not a raw signed URL)

### 12.3 Owner-Only Export Visibility

Log in as `viewer@ultaura-seed.test`:

- [ ] Health-bearing exports are NOT visible to the viewer
- [ ] The viewer receives a generic "unavailable" message (not "this contains Health data")

### 12.4 Locked Plan Export

If testing with a locked plan account:

- [ ] Owner can still request an export even when Health is locked
- [ ] Export includes preserved Health data

---

## Phase 13: Deletion Verification

### 13.1 Line Deletion

> Use a non-critical test line for this. Consider creating a temporary line or using the Trial account.

- [ ] Create Health data (condition, medication, observation, document) on a test line
- [ ] Delete the line through the dashboard
- [ ] Verify all Health data for that line is removed:

```sql
SELECT count(*) FROM ultaura_health_conditions WHERE line_id = '<deleted-line-id>';
SELECT count(*) FROM ultaura_health_medications WHERE line_id = '<deleted-line-id>';
SELECT count(*) FROM ultaura_health_observations WHERE line_id = '<deleted-line-id>';
SELECT count(*) FROM ultaura_health_documents WHERE line_id = '<deleted-line-id>';
SELECT count(*) FROM ultaura_health_item_history WHERE line_id = '<deleted-line-id>';
SELECT count(*) FROM ultaura_health_line_consent WHERE line_id = '<deleted-line-id>';
```

- [ ] All queries return 0
- [ ] Document storage blobs are also removed (no orphaned objects in `ultaura-health-documents` bucket)

### 13.2 Account Deletion (Privacy Center)

> Use the Trial or Care test account for this.

- [ ] Navigate to Privacy → Delete Account
- [ ] Process the deletion
- [ ] Verify all Health data removed (same queries as above but by account_id)
- [ ] Verify Health-bearing export rows are invalidated

### 13.3 Export Invalidation on Deletion

- [ ] Create Health data → request export → start deletion before export completes
- [ ] Verify the export is invalidated (not downloadable)

---

## Phase 14: Responsive / Mobile Verification

Open the app at 375px viewport width (use browser DevTools):

### 14.1 Navigation

- [ ] Health nav item is visible (or accessible via mobile menu)
- [ ] Locked state renders correctly on mobile

### 14.2 Tab Navigation

- [ ] Tab selection collapses into a dropdown at 375px (not full-width tabs)
- [ ] Dropdown works: can switch between all 5 tabs
- [ ] All tab content is usable at 375px

### 14.3 Forms

- [ ] Condition form is usable at 375px — all fields visible, scrollable
- [ ] Medication form is usable at 375px
- [ ] Observation form is usable at 375px
- [ ] Document upload form is usable at 375px
- [ ] All tap targets are at least 44px

### 14.4 Disclaimer Dialog

- [ ] Disclaimer dialog renders correctly at 375px
- [ ] Acknowledgement button is easily tappable

---

## Phase 15: Public Copy Verification (Spec R134, Section 15.1)

### 15.1 FAQ Page

Navigate to the public FAQ page (`/faq`):

- [ ] A "What is Health Profile?" entry exists (or equivalent)
- [ ] It states Health Profile is available on Comfort, Family, and Usage Based plans
- [ ] It does NOT imply Health is available on Care or Free Trial
- [ ] It does NOT position Health Profile as a "care hub" or "clinical platform"
- [ ] Language is consistent with: "personal reference + optional AI context layer"

### 15.2 Pricing / Plan Comparison

Navigate to the public pricing page:

- [ ] Health Profile is listed as a feature for Comfort, Family, and Usage Based plans
- [ ] Health Profile is NOT listed for Care or Free Trial plans
- [ ] No clinical/medical language is used

### 15.3 Plan Features (Dashboard)

Log in and check any plan comparison UI in the dashboard:

- [ ] Health Profile appears for eligible plans only
- [ ] Locked-plan messaging is generic (e.g., "Upgrade to access Health Profile")

---

## Phase 16: Legal / Privacy Review

> This section outlines what needs legal/privacy review. Share these items with your legal/privacy advisor.

### 16.1 Disclaimer Copy

Share the exact disclaimer text with legal:

> "Important: Ultaura is not a doctor or medical professional. Health information stored here is for personal reference and, with your permission, to help Ultaura provide more informed companionship. Ultaura may make mistakes. Always consult qualified healthcare providers for medical advice, diagnosis, or treatment."

- [ ] Legal has reviewed and approved the disclaimer copy
- [ ] Reviewer name: _________________ Date: _________

### 16.2 Health Data Storage

Legal/privacy should review:

- [ ] Ultaura stores structured health data (conditions, medications, observations) entered by the account owner
- [ ] All health data is encrypted at rest with AES-256-GCM per-line encryption keys
- [ ] Health data is accessible only to the canonical account owner (not shared with other org members or viewers)
- [ ] Documents (PDFs, images) are encrypted before storage and never parsed by AI
- [ ] Health data is permanently deleted when the account or line is deleted
- [ ] Health data can be exported by the owner at any time

### 16.3 AI Use of Health Data

Legal/privacy should review:

- [ ] Health data is ONLY used in AI calls when the senior has explicitly consented (spoken consent for family-managed, dashboard opt-in for self-managed)
- [ ] Only a narrow subset is shared with AI: condition name + status, medication name + status + times, 3 most recent sanitized observation summaries
- [ ] Raw caregiver-authored text, doctor names, dosage details, and document contents are NOT sent to AI
- [ ] AI is explicitly instructed not to provide diagnosis, medication advice, or clinical framing
- [ ] The senior can say "keep this private" to suppress any health-related disclosure from reaching the family

### 16.4 Consent Model

Legal/privacy should review:

- [ ] Family-managed: consent captured verbally during a call; dashboard owner can only REQUEST a re-prompt (not grant/deny on behalf of senior)
- [ ] Self-managed: owner opts in from the dashboard directly
- [ ] Consent can be revoked at any time with immediate effect
- [ ] 30-day cooldown on re-requesting consent after denial/revocation
- [ ] Consent history is maintained and visible only to the account owner

### 16.5 Privacy Policy / Terms Updates

- [ ] Determine if the existing privacy policy needs updates for Health Profile
- [ ] Determine if terms of service need updates
- [ ] If updates needed, draft and review before launch
- [ ] Reviewer name: _________________ Date: _________

---

## Phase 17: Security Review (Spec Section 15.6)

> This can be done by you or a security-focused reviewer reading the code.

### 17.1 Owner-Only Route Guarding

- [ ] Every Health API route checks canonical ownership via `created_by_user_id`
- [ ] No Health route uses membership role as the sole access check

### 17.2 RLS on Health Tables

- [ ] Every Health table has `ROW LEVEL SECURITY` enabled
- [ ] Every Health table has an owner-only SELECT policy
- [ ] No Health table has browser INSERT/UPDATE/DELETE policies

### 17.3 Health-Bearing Export Visibility

- [ ] Health-bearing exports are classified owner-only at creation time (immutable)
- [ ] Non-owners cannot see, list, or download Health-bearing exports
- [ ] Health-bearing exports never expose a raw `download_url`

### 17.4 Privacy Suppression

- [ ] `mark_health_disclosure_private` suppresses same-call health mentions and suggestions
- [ ] Generic `mark_private` / `mark_topic_private` also trigger Health suppression for health-adjacent content
- [ ] Suppressed content is excluded from: wellness alerts, call insights, weekly summaries

### 17.5 Document Security

- [ ] Document access tokens: SHA-256 hashed, 5-minute TTL, single-use
- [ ] Document preview/download uses POST with token in body (not query params)
- [ ] Response headers include: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`
- [ ] Magic-byte verification rejects mismatched file types
- [ ] Document metadata is encrypted; access logs contain only minimal fields

### 17.6 Encryption Consistency

- [ ] All Health data uses line-scoped DEKs (never account DEKs)
- [ ] No plaintext health content is stored outside encrypted payload columns

---

## Phase 18: Support Documentation (Spec Section 15.4)

> Outline of what support documentation needs to be written. Can go on the `/docs` page or an internal wiki.

### 18.1 User-Facing Documentation (for /docs page)

Write documentation covering:

- [ ] **What is Health Profile** — overview, what it does, what it doesn't do (not a clinical tool)
- [ ] **How to set up Health Profile** — step-by-step: disclaimer → select line → add conditions → add medications → (optional) upload documents → (optional) add observations
- [ ] **Health consent explained** — what consent means, how it works for family-managed vs self-managed, what happens when consent is granted/denied/revoked
- [ ] **Health-linked reminders** — how they work, call-only delivery, pause/resume behavior
- [ ] **Health and privacy** — what data is shared with AI (and what isn't), how to use "keep this private", how to revoke consent
- [ ] **Exporting Health data** — how to export, what's included, ZIP format
- [ ] **Deleting Health data** — what happens on item delete, line delete, account delete

### 18.2 Internal Support Notes

Write internal documentation covering:

- [ ] **Owner-only access rule** — Health is visible only to the canonical account owner (`created_by_user_id`). Viewers, members, and admins cannot see it. Support cannot access it.
- [ ] **No break-glass in v1** — Support cannot view a user's Health data. If support needs to investigate a Health issue, the owner must provide screenshots or a screen-share session.
- [ ] **Escalation path** — How to handle Health-related support tickets when you can't see the data
- [ ] **Call-only reminders** — Health-linked reminders are call-only. They never use SMS. If a user asks why their medication reminder isn't coming by text, this is why.
- [ ] **Locked-plan behavior** — When a user downgrades to Care or Free Trial, their Health data is preserved but inaccessible. They can still export. Reminders are paused.
- [ ] **Export rules** — Health-bearing exports download as ZIP through an authenticated route. They expire after 24 hours. Non-owner members cannot access them.

---

## Phase 19: Final Launch Gate

### 19.1 All Prior Phases Complete

- [ ] Phase 0: Environment setup complete
- [ ] Phase 1: Ownership backfill verified
- [ ] Phase 2: Feature flag kill switch verified
- [ ] Phase 3: Access control verified (owner, viewer, trial, care)
- [ ] Phase 4: First-visit flow verified
- [ ] Phase 5: Conditions CRUD verified
- [ ] Phase 6: Medications CRUD verified
- [ ] Phase 7: Consent flow verified
- [ ] Phase 8: Documents verified
- [ ] Phase 9: Observations verified
- [ ] Phase 10: Reminder isolation verified
- [ ] Phase 11: Suggestions queue verified
- [ ] Phase 12: Export verified
- [ ] Phase 13: Deletion verified
- [ ] Phase 14: Mobile/responsive verified
- [ ] Phase 15: Public copy verified
- [ ] Phase 16: Legal/privacy review complete
- [ ] Phase 17: Security review complete
- [ ] Phase 18: Support documentation written

### 19.2 Accepted v1 Tradeoffs Acknowledged

Review and acknowledge these known v1 limitations:

- [ ] 10-medication cap in call context
- [ ] 3-second Health context fetch timeout (fail-closed)
- [ ] 5-minute document access token TTL
- [ ] 24-hour Health export artifact TTL
- [ ] Whole-call suppression (not per-disclosure granularity)
- [ ] UTC fallback when line timezone is missing
- [ ] No break-glass support access to Health data
- [ ] Health-linked reminders excluded from v1 export
- [ ] No outside-Health reminder fallback
- [ ] Session-local shutdown is authoritative; prompt refresh is best-effort

### 19.3 Known Residual Risks Acknowledged

- [ ] Kill-switch misconfiguration risk (DB source + env fallback both wrong = Health hidden)
- [ ] Ownership backfill timing risk (must complete before rollout)
- [ ] Suppression/read-model coupling (non-Health readers must stay aligned with suppression)

### 19.4 Go / No-Go

- [ ] All checkboxes above are checked
- [ ] Decision: **GO** / **NO-GO**
- [ ] Decision maker: _________________ Date: _________
- [ ] Feature flag set to `true` in production: _______ (date/time)
