# Health Profile — Product Requirements Document

> **Updated:** 2026-03-12
> **Feature Name:** Health Profile
> **Canonical Product Name:** Health Profile
> **Nav Label:** Health
> **Scope:** Dashboard, Telephony consent + prompt context, Database, Notifications, Privacy, Billing Gates

---

## 1. Overview

### What We're Building

A line-scoped **Health Profile** in the Ultaura dashboard that gives the account owner a private place to manage a senior's:

- Medical conditions
- Medications
- Health-related documents
- Caregiver observations

With explicit Health consent, Ultaura may use a limited subset of that profile to make calls more context-aware and supportive. Without that consent, the Health Profile remains a private dashboard record only.

### What Health Profile Is Not

Health Profile is **not**:

- A clinical record system
- A doctor portal
- A diagnosis engine
- A medication safety checker
- A shared multi-caregiver workspace in v1
- A place for structured symptoms or vitals in v1

Ultaura remains a companion and coordination tool, not a medical authority.

### Why It Matters

Ultaura already detects wellness and health-related signals from calls, but that is not the same as having a structured baseline. Health Profile gives families and self-managed users a safer, more intentional way to store known facts and decide whether Ultaura may use them during calls.

### Core Product Positioning

Health Profile is a **private health reference + optional AI context layer**.

It is not a "care hub."

---

## 2. Availability & Packaging

### Eligible Plans

Health Profile is available on:

- **Comfort**
- **Family**
- **Usage Based**

Health Profile is **not** available on:

- **Free Trial**
- **Care**

Trial-status accounts are ineligible for Health Profile regardless of their underlying plan assignment.

### Ineligible Plan Behavior

For ineligible plans:

- The **Health** nav item is visible but locked
- The locked landing explains eligibility and upgrade options
- Detailed Health data is not exposed while the plan is ineligible
- The locked landing should use generic preservation language such as "your Health Profile data is preserved"
- Health must not show suggestion badges, counts, or any other health-derived metadata while locked
- Owner-initiated data export remains allowed as a data-rights exception even while Health is locked

### Downgrade Behavior

If an account downgrades from an eligible plan to an ineligible plan:

- Existing Health Profile data is preserved
- Health becomes locked
- Ultaura immediately stops using Health data during calls
- New call-derived Health suggestions stop
- Existing Health-linked reminders are automatically paused
- Full access resumes if the account upgrades back to an eligible plan

### Gating Applies to Everyone

The same plan gating applies to:

- Family-managed users
- Self-managed users

---

## 3. Goals & Non-Goals

### Goals

- Give the account owner a structured private Health Profile for each line
- Improve call relevance **only** when explicit Health consent exists
- Keep health-related AI behavior narrow, explainable, and privacy-first
- Let families review AI-detected condition/medication disclosures before they become structured records
- Provide a secure filing cabinet for health-related documents
- Keep the UX senior-friendly and low-cognitive-load on desktop and mobile

### Non-Goals for v1

- Structured symptoms as a first-class Health entity
- Vitals tracking
- Observation-driven pattern detection
- Observation-driven reminder offers
- AI parsing of uploaded documents
- Word document support
- Legal document storage inside Health
- Multi-user Health access beyond the owner
- Health advice, diagnosis, interpretation, or treatment recommendations

---

## 4. Users, Access & Permissions

### Access Model

| Line Type | Dashboard Health Access | In-Call Health Use | Notes |
|-----------|-------------------------|--------------------|-------|
| **Family-managed** | Primary account holder only | Requires explicit senior Health consent | Non-primary viewers do not get Health access |
| **Self-managed** | Account owner only | Requires explicit self opt-in in Health Profile | Same plan gating as family-managed |

### Viewer Behavior

For family-managed accounts:

- Dashboard viewers and non-primary users do **not** see the Health nav item
- Health is fully hidden from them, not visible as read-only

### Canonical Owner Primitive

Until the broader platform ownership model changes, the canonical Health owner is the account's current `created_by_user_id`-based owner primitive.

This owner primitive governs:

- Health dashboard access
- Health export access
- Health document download access
- Any other owner-only Health action

### Ownership Changes

If account ownership or account model changes administratively in the future:

- The Health Profile stays with the line
- Health access follows the new authorized owner for that line only if the underlying canonical owner primitive is updated accordingly

### Scope of the Health Profile

Health Profile is **line-specific**, not account-wide.

Every Health permission and Health consent decision is line-specific.

---

## 5. Health Consent Model

### Why Health Needs Its Own Consent Model

Health Profile does **not** reuse the existing family sharing tiers as its primary control surface.

Reason:

- Existing sharing tiers were designed for summaries, wellness trends, and family sharing controls
- Health Profile introduces structured health records and in-call health context
- This requires a separate, explicit, line-specific Health consent model

### Health Consent States

Every line has a Health consent state:

- **not_requested**
- **granted**
- **denied**
- **revoked**

State meaning:

- **not_requested** = no explicit Health decision has been recorded yet
- **granted** = Health use in calls is currently allowed
- **denied** = Health use was explicitly declined before ever being granted
- **revoked** = Health use was granted previously and later turned off

For self-managed lines, `denied` is not used. Self-managed users can move only between `not_requested`, `granted`, and `revoked`.

### Health Consent Request Event

Health consent request timing is tracked separately from the consent state itself.

The system must persist:

- `health_consent_requested_at`

Rules:

- A consent request event does not change the consent state by itself
- `health_consent_requested_at` represents the owner-requested Health re-prompt event, not merely the moment Ultaura speaks the prompt
- An unanswered prompt leaves the line in `not_requested`
- The 30-day re-prompt cooldown is measured from the most recent `health_consent_requested_at`
- Metrics that reference the first consent request are measured from the first persisted consent request event
- Implementations may separately track when Ultaura actually asked during a call so requested-vs-prompted timing is not conflated

### What Health Consent Controls

Health consent is an **additional gate**, not a replacement for existing privacy and call-side consent gates.

If another stricter platform privacy/consent control blocks a call-side behavior, Health consent does not override it.

If Health consent is **granted**, Ultaura may:

- Inject approved Health Profile context into calls
- Create call-derived Health suggestions for structured conditions/medications
- Use Health-linked reminders during calls
- Use the approved recent-observation subset in calls

If Health consent is **not granted**, Ultaura may **not**:

- Use Health Profile data in-call
- Create structured call-derived Health suggestions
- Use caregiver observations in AI systems
- Deliver Health-linked reminders during calls

### Family-Managed Flow

For family-managed lines:

- The primary account holder may build and manage the Health Profile before consent exists
- Health remains a private dashboard record until consent is granted
- Consent is requested verbally during a call with the senior only after the owner explicitly requests that prompt from the dashboard
- The dashboard may request a re-prompt, but may not bypass the senior
- A requested but unanswered prompt does **not** create a separate product state; the line remains `not_requested` until the senior explicitly grants or denies
- Health consent re-prompts follow the existing privacy request-change pattern:
  - Manual request only
  - **30-day cooldown**
- Denied or revoked family-managed lines may be re-requested after that same cooldown
- If the senior grants Health during a call, that grant applies starting on the **next call**, not mid-call
- If the senior denies or revokes Health during a call, Health use shuts off immediately for the rest of that call

### Self-Managed Flow

For self-managed lines:

- The Health Profile is available in the dashboard
- In-call Health use is **not** enabled by default
- The self-managed user must explicitly opt in from within Health Profile
- They may revoke that opt-in at any time while keeping the dashboard record
- No separate in-call consent prompt is required unless they choose to enable Health in the dashboard and want a spoken explanation later
- If a self-managed account later converts to family-managed, each line's Health consent resets to `not_requested` and requires fresh spoken senior consent before any future call-side Health use resumes
- Self-managed owners may use Observations in v1 under the same owner-only storage and call-side consent rules as family-managed owners

### Consent Change Effects

If Health consent is **denied** or **revoked**:

- Dashboard Health remains usable
- Call-side Health use stops immediately
- New structured Health suggestions stop immediately
- Caregiver observations stop flowing to AI systems
- Existing Health-linked reminders are automatically paused
- The dashboard clearly shows that Health is "not used by Ultaura during calls"

### Senior Notices

#### Consent Change Notices

Consent change notices:

- Are delivered as a **next-call verbal notice only**
- Use strictly **non-specific** phrasing
- Are about privacy/control, not health content

Example intent:

> "If you want, I can use health information your family added to make calls more helpful. You're in control of that."

#### Major Profile Change Notices

Major profile change notices:

- Are delivered as a **next-call verbal notice only**
- Happen **only after Health consent has already been granted**
- Are phrased minimally and non-alarmingly
- Do **not** happen before Health consent exists

Major profile changes are limited to:

- Condition added
- Condition status changed
- Medication added
- Medication status changed
- Medication schedule/time changed

### Privacy Override During Calls

If the senior says some version of:

- "Don't tell my family"
- "Keep this private"
- "I don't want them to know"

Then Ultaura must:

- Not create a family-visible Health suggestion
- Not expose the disclosure through Health Profile workflows
- Not allow the disclosure to flow through the existing health-mention or wellness-alert path
- Not allow the disclosure to flow through call-insights concerns, follow-up reasons, or weekly summaries
- Only break that privacy boundary if the event crosses Ultaura's canonical **Urgent Safety & Verification** boundary

Routine symptoms, medication changes, or ordinary health disclosures do **not** override this privacy rule.

V1 implementation note for aggregated readers:

- Because current call-insights and weekly-summary storage is aggregated, private-disclosure handling in v1 may use whole-call health-adjacent suppression for family-facing insights/weekly-summary readers rather than per-concern provenance.

---

## 6. Information Architecture & UX

### Top-Level Navigation

Health appears as a top-level dashboard nav item:

- For family-managed primary account holders on eligible plans
- For self-managed users on eligible plans

It is:

- Hidden from viewers and non-primary users
- Visible but locked on ineligible plans

### First-Time Multi-Line Behavior

If an account has:

- **One line:** Health opens directly to that line
- **More than one line:** Health requires an explicit first-time line selection

After the first explicit selection:

- Health remembers the last-used line
- The selected line is URL-synced with `?line=`

### Default Landing Tab

Health defaults to:

- **Suggestions** when there are pending suggestions
- **Conditions** when there are no pending suggestions

### Health Tabs

Health uses top-level tabs:

- **Suggestions**
- **Conditions**
- **Medications**
- **Documents**
- **Observations**

### Suggestions Placement

Suggestions is a **shared Health-level queue**, not a subsection under Conditions or Medications.

This reduces cognitive load and gives one place to review all pending AI-detected Health changes.

### Mobile Pattern

Health should follow the same general responsive pattern used by Alerts/Privacy:

- Top tabs at the page level
- Mobile dropdown for subsection navigation when needed
- URL-driven tab/section state
- URL-driven line selection

### First-Visit Disclaimer

On first access to Health Profile, show a prominent disclaimer:

> **Important:** Ultaura is not a doctor or medical professional. Health information stored here is for personal reference and, with your permission, to help Ultaura provide more informed companionship. Ultaura may make mistakes. Always consult qualified healthcare providers for medical advice, diagnosis, or treatment.

This disclaimer:

- Is acknowledged once
- Reappears when Health policy/behavior changes materially
- Remains available through a persistent "About Health Profile" link

### First-Time Empty State Framing

The first-time empty state should explain:

- What Health Profile is
- What Ultaura does and does not do
- What requires senior Health consent
- Suggested setup order:
  - Conditions
  - Medications
  - Documents
  - Observations

### Standard States Required in v1

Every tab must define:

- Loading state
- Empty state
- Error state

Additional rules:

- Uploads show progress and retry
- Autocomplete failure degrades to plain text
- Failed Health consent re-prompts show the reason
- Failed linked-reminder updates show partial-success messaging when needed

---

## 7. Shared Suggestions Queue

### Scope

The shared Suggestions queue is for **structured** AI-detected disclosures only:

- Conditions
- Medications

Symptoms are **not** structured Health suggestions in v1.

### Preconditions

Call-derived Health suggestions are created only when:

- Health consent is **granted**
- The disclosure is not blocked by a privacy request
- The disclosure is not already represented by the same structured fact

### Suggestion Statuses

Suggestions use exactly three statuses:

- **pending**
- **approved**
- **dismissed**

There is no separate `stale` user-facing status.

### Suggestion Review Card Content

A suggestion review card shows:

- Suggested type
- Normalized name
- Confidence label (`High` or `Medium`)
- Short paraphrased explanation
- Call date
- Proposed field details such as dosage/frequency when available
- Clear warning if a similar structured item already exists

It does **not** show:

- Raw transcript excerpts
- Verbatim quotes
- Open-ended freeform transcript blobs

### Default Review Action

If a similar existing item is found, the primary action should be:

- **Review as update**

Not:

- Add as a brand-new item by default

The review UI must allow:

- Approve as new
- Approve as update/merge against an existing item
- Dismiss

### Queue Ordering

The active queue is ordered:

- **Newest first**

### Reappearance After Dismissal

A dismissed suggestion may reappear only if there is **materially different evidence**.

Materially different evidence means a new disclosure adds a new structured fact, such as:

- A different condition or medication name
- A changed dosage
- A changed frequency
- A changed status
- A later disclosure that clearly suggests the prior dismissal is no longer correct

### Stale Suggestion Handling

If the owner manually creates or edits the underlying structured item before reviewing a pending suggestion:

- The suggestion is removed from the active queue
- The suggestion is retained in history/audit as a system-stale, system-dismissed record
- The suggestion does not continue to compete with the manual source of truth

### Badge Behavior

Pending suggestion count is shown as a **count-only** badge:

- On the top-level Health nav item
- On the Suggestions tab

Badge text must never expose sensitive details.

When Health is locked or plan-ineligible:

- No Health badge or count is shown anywhere in navigation or tab chrome

---

## 8. Conditions

### Purpose

Store diagnosed medical conditions as structured reference data for the line owner and, with consent, for Ultaura's call context.

### v1 Fields

| Field | Required | Notes |
|-------|----------|-------|
| Condition name | Yes | Plain text with autocomplete suggestions |
| Standardized code / ID | No | Stored when available from autocomplete; never required |
| Status | Yes | Active / Monitoring / Resolved |
| Diagnosed / onset date | No | Supports approximate date values |
| Stage / Severity | No | Plain text |
| Treating clinician | No | Plain text |
| Notes | No | Plain multiline text |

### Date Model

Condition dates are **approximate dates**, not plain required full dates.

Supported precision includes:

- Year only
- Month + year
- Full date

### Status Rules

Condition statuses:

- **Active**
- **Monitoring**
- **Resolved**

Monitoring:

- Appears inside the active condition list
- Uses a clear badge/filter
- Does not become its own third primary list

### Conditions Views

Conditions should support:

- Active view
- Resolved view
- Monitoring filter within the active view

### Core Actions

- Add condition
- Edit condition
- Change status
- Delete condition
- View history

### Duplicate / Conflict Handling

If the owner tries to add a condition that appears similar to an existing item:

- Warn before saving
- Recommend update/merge instead of silent duplication

---

## 9. Medications

### Purpose

Store current and past medications as structured reference data and optionally link them to Health-consented reminder behavior.

### v1 Fields

| Field | Required | Notes |
|-------|----------|-------|
| Medication name | Yes | Plain text with autocomplete suggestions |
| Standardized code / ID | No | Stored when available; never required |
| Status | Yes | Current / As-needed / Discontinued |
| Dosage | No | Plain text |
| Frequency | No | Plain text |
| Time(s) of day | No | One or more times |
| Prescribed by | No | Plain text |
| Start date | No | Supports approximate date values where applicable |
| End date | No | Supports approximate date values where applicable |
| Linked condition / reason | No | Optional link to an existing condition plus optional plain-text reason |
| Notes | No | Plain multiline text |

### Medication Statuses

Medication statuses:

- **Current**
- **As-needed**
- **Discontinued**

### Medication Views

Medications should support:

- Current view
- As-needed view
- Discontinued view

### Health-Linked Reminder Rules

Medication-linked reminders are part of Health behavior and therefore require Health consent.

Rules:

- Generic reminders created outside Health remain separate and do not depend on Health consent
- Health-linked reminders may be created before Health consent exists, but they are not delivered until Health consent is granted
- Health-linked reminders are **call-only** in v1
- Health-linked reminders must not use SMS delivery in v1
- A medication may have multiple linked reminders if needed
- The UI should still present one obvious "medication reminder set" relationship
- Health-linked reminders use the shared reminder engine but are managed and viewed inside Health
- Health-linked reminders count toward normal reminder limits only while active
- Health may only create/manage reminders that are born as Health-linked in v1; existing general reminders are not reclassified into Health
- Health-linked reminders must not be shown with sensitive detail in generic Reminders surfaces, line summary counts, viewer-accessible areas, locked-plan UI, or any other non-Health surface
- The default rule is that Health-linked reminders are not surfaced outside Health at all
- Outside-Health reminder fallback is **not allowed** in v1. Health-linked reminders must not appear outside Health as full text, redacted placeholders, or counts.
- Reminder leak-closure scope is explicit in v1: home surfaces, line detail surfaces, global search, activity/history feeds, exports, and voice reminder tools must not reveal Health-linked reminders outside Health.

### Reminder Lifecycle Rules

If a medication with linked reminders is edited:

- **Dosage / notes change:** do not auto-change reminder copy unless explicitly edited
- **Schedule / times change:** prompt the owner to update linked reminders
- **Discontinue / delete:** automatically cancel linked reminders
- **Health consent revoked / plan becomes ineligible:** automatically pause linked reminders and explain why

If Health-linked reminders were paused because Health consent was revoked/denied or the plan became ineligible:

- They also remain paused after the first `not_requested -> granted` transition
- They remain paused after consent is granted again or the plan becomes eligible again
- The owner must manually resume them

### Core Actions

- Add medication
- Edit medication
- Change status
- Delete medication
- Create/manage linked reminders
- View history

### Duplicate / Conflict Handling

If a similar medication already exists:

- Warn before saving
- Recommend update/merge instead of silent duplication

---

## 10. Documents

### Purpose

Provide a secure filing cabinet for health-related documents.

### v1 Scope

Documents are:

- Securely stored
- Viewable by the authorized dashboard owner
- Exportable in original-file form through account data export

Documents are **not**:

- Parsed by AI
- Sent to Grok
- Used as a source for automatic structured extraction in v1

### Supported File Types

- PDF
- JPG
- JPEG
- PNG
- HEIC

### File Size

- Maximum file size: **25 MB** per document

### v1 Metadata Fields

| Field | Required | Notes |
|-------|----------|-------|
| File | Yes | Original uploaded file |
| Title | Yes | Editable title |
| Category | No | Optional category |
| Document date | No | Optional date |
| Notes | No | Plain multiline text |

### Document Categories

- Lab Results
- Discharge Summary
- Prescription
- Insurance
- Imaging / Scans
- Doctor's Notes
- Other

Legal documents are out of scope for Health v1.

### Document Behavior

- PDFs and images preview inline
- Download remains available as fallback
- Preview/download uses short-lived on-demand signed access
- Document preview/download actions are **not** included in user-facing Health history in v1
- Backend security access logging is required for document preview/download events

### Document Metadata Privacy

Health document metadata that may reveal health information must use the same privacy posture as other sensitive Health data.

This includes:

- title
- notes
- category
- document date
- original filename

These fields must be protected so that metadata does not become a side channel that is less protected than the file itself.

### Core Actions

- Upload document
- Edit metadata
- Delete document
- Preview
- Download

---

## 11. Observations

### Purpose

Observations are a **private caregiver log first**. They help the owner record things noticed in real life, without turning those notes into alerts or automation by default.

### v1 Fields

| Field | Required | Notes |
|-------|----------|-------|
| Observation text | Yes | Plain multiline text |
| Category | No | Optional category |
| Observed date | No | Defaults to today |
| Concern level | No | Note / Mild Concern / Significant Concern |

### Categories

- Memory
- Mood / Emotional
- Physical / Mobility
- Nutrition / Eating
- Sleep
- Social / Engagement
- Medication Compliance
- General / Other

### Concern Levels

- **Note**
- **Mild Concern**
- **Significant Concern**

### Observation Views

Observations should support:

- Recent view
- By Category view

### AI Use Rules

Before Health consent is granted:

- Observations are stored privately in the dashboard
- They do **not** feed Grok
- They do **not** feed pattern detection
- They do **not** feed wellness alerts
- They do **not** feed insights

After Health consent is granted:

- A small recent subset may be used for call context
- Ultaura may reference them supportively
- Ultaura may never use them as medical advice

### Prompt Scope

When Health consent is granted, Ultaura may see:

- The **3 most recent observations**

For v1, "3 most recent observations" means:

- Only non-deleted observations for the selected line
- Ordered by observed date descending when provided; otherwise by created time descending
- Created-time descending as the tie-breaker when observed dates are equal

### Explicit v1 Exclusions

Observations do **not**:

- Trigger reminder offers
- Trigger alerts
- Feed the Insights page
- Feed pattern detection in v1

### Core Actions

- Add observation
- Edit observation
- Delete observation
- Filter by category
- View history

---

## 12. AI Behavior & Prompt Use

### Approved Call-Side Health Context

When Health consent is granted, Ultaura may receive a compact Health context block containing:

- Active and monitoring conditions as name + status only
- Current and as-needed medications as name + status + times of day only, where appropriate for context
- The 3 most recent observations as normalized owner-safe summaries, not raw caregiver-authored free text

Additional rules:

- Raw caregiver-authored observation text should not be sent directly to Grok
- Raw free-text medication `linked reason` values should not be sent directly to Grok in v1
- Other structured Health fields stay in the dashboard record and are not part of call context in v1
- In v1, medication context may be capped at 10 items per call (current first, then as-needed with explicit times) as an engineering safety limit.
- When more medications qualify than the v1 context cap, ordering is deterministic: current medications first (time-of-day set first, then others), then as-needed with explicit times. Within each subgroup, order by earliest time-of-day when present, then alphabetical medication name.

Documents are never sent to Grok in v1.

### Structured Suggestions Are Narrow

Only these call-derived structured suggestions are allowed in v1:

- New condition
- New medication
- Change to an existing condition
- Change to an existing medication

### Conflict Rule Between Live Call Data and Stored Health Profile

If live call information conflicts with the stored Health Profile:

- Ultaura should converse respectfully using the live statement in the moment
- Ultaura must not overwrite the stored profile directly
- If Health consent allows, Ultaura should create an update suggestion for owner review
- The approved structured Health Profile remains the source of truth until reviewed
- If multiple similar existing items could be the update target, Ultaura must not auto-merge. The owner must explicitly choose the target item during review.

### Symptoms Stay Out of Structured Health v1

Symptoms:

- Are not a structured Health Profile entity in v1
- Do not create Health suggestions
- Stay in Ultaura's existing wellness / health-mention flow
- Only break privacy through Ultaura's canonical **Urgent Safety & Verification** boundary used for emergency escalation and verification decisions

### Health Guardrails

Ultaura must:

- Never diagnose
- Never interpret symptoms medically
- Never recommend medication changes
- Never act like a clinician
- Use Health context only to be more context-aware and supportive
- Defer medical questions to healthcare professionals

---

## 13. Notifications

### To the Primary Account Holder

Health-related owner notifications may go to the **primary account holder only**.

Allowed channels:

- Dashboard: may show normalized structured detail for review, but never quotes or transcript fragments
- Email: generic only, for example "A Health Profile update is ready for review for [line name]"
- SMS: generic only at the same specificity level as email

Pending suggestion notifications are dashboard-only in v1.

Health never routes to trusted contacts through Health workflows in v1.

### Reminder Copy Requirement

The Health pages must clearly state that Health-linked reminders are:

- Call-only in v1
- Not delivered by SMS through Health workflows

### To the Senior

For family-managed lines:

- Consent changes: next-call verbal notice only, non-specific, in the live call language when supported with English fallback otherwise
- Major profile changes: next-call verbal notice only, only after Health consent has been granted, in the live call language when supported with English fallback otherwise

Supported spoken-language source of truth for these notices is the line's active call-language capability state in Ultaura's telephony language support matrix. If that state does not confirm support, the notice must fall back to English.

No health-specific SMS or email notices to the senior are required by this PRD.

---

## 14. Audit, Export, Deletion & Lifecycle

### Health Item History

Health item history tracks:

- Create
- Edit
- Delete
- Suggestion approve
- Suggestion dismiss

It does **not** track:

- Document preview
- Document download

### User-Facing Delete Semantics

Deleting a Health item from the dashboard:

- Removes it from normal views immediately
- Preserves Health item history

If the deleted item is a document:

- The stored document blob must be deleted immediately
- The document record itself must also be deleted immediately
- Only the allowed Health item history remains
- Backend security access logs for document preview/download are not user-facing Health item history and may remain until line deletion or full deletion

### Full Account Deletion

On full account deletion, all Health data must be permanently deleted, including:

- Structured Health records
- Health suggestions
- Health item history
- Uploaded Health documents

This requirement applies to both:

- privacy-center account data deletion flows
- full user / organization deletion flows

### Platform Compliance Audit Logs

Health item history is distinct from broader platform compliance audit logs.

The PRD requires:

- Health item history to be deleted on full account deletion
- Existing platform compliance logs to follow the platform's separate compliance retention rules
- Health-specific content to avoid being retained in compliance logs beyond what is strictly required by existing platform rules

### Line Deletion

If a line is deleted:

- Its Health Profile is deleted with the line

### Data Export

Health must be included in the existing export capability.

In v1, Health export inclusion is automatic whenever exportable Health data exists for the account. There is no owner-facing include/exclude Health toggle.

Owner-initiated export remains available even when Health is locked due to plan ineligibility.

Any export that contains Health data must be:

- requestable only by the canonical Health owner
- visible only to the canonical Health owner
- downloadable only by the canonical Health owner
- denied by default if ownership, authentication, authorization, or artifact-state checks are missing, stale, or inconclusive (fail closed)

Export includes:

- Structured Health data
- Health item history
- Document metadata
- Original document files

Health-linked reminders and reminder-link records are excluded from Health export in v1.

Health-bearing export artifact availability in v1:

- Health-bearing export artifacts expire after 24 hours.
- Health-bearing export artifacts in `pending` or `ready` state must be invalidated immediately if related Health data is deleted (item delete, line delete, or full account deletion).

### Plan Downgrade Lifecycle

If an account becomes ineligible for Health:

- Health data is preserved
- The Health area becomes locked
- Detailed Health data is hidden behind the locked landing
- In-call Health use stops
- Health-linked reminders pause automatically
- Health-linked reminders remain paused until the owner manually resumes them after eligibility returns

---

## 15. Security & Privacy Requirements

### Core Rules

- Health data is line-scoped
- Health access is owner-only per the rules in this PRD
- Health data must be encrypted at rest consistent with Ultaura's line-scoped privacy model
- Health documents must use app-layer per-line encryption before durable storage
- Health document metadata that may reveal health information must be protected with the same privacy posture as the associated document content
- Documents use short-lived signed access, refreshed on demand
- Document preview/download access-token TTL is 5 minutes in v1
- Raw transcript excerpts are not shown in Health suggestion workflows
- Documents are never processed by AI in v1

### Document Access Logging Rules

Backend security access logs for Health document preview/download events must be minimal.

Allowed fields:

- actor id
- line id
- document id
- action (`preview` / `download`)
- timestamp
- success / failure

These logs must not store:

- title
- filename
- notes
- signed URLs
- decrypted metadata values

### Consent-Safe Health Use

Health-related call behavior must always respect:

- Health consent state
- Privacy-request language from the senior
- Ultaura's canonical Urgent Safety & Verification boundary

### No Cross-Feature Leakage

Before Health consent is granted:

- No prompt injection from Health Profile into calls
- No observation use in alerts/insights/pattern detection
- No structured Health suggestions from calls
- No Health-linked reminder delivery

---

## 16. UI Sections Summary

### Suggestions

- All Pending
- Filters for Conditions / Medications
- Badge count

### Conditions

- Active
- Resolved
- Monitoring filter inside Active

### Medications

- Current
- As-needed
- Discontinued

### Documents

- All Documents
- Filter by category
- Sort by upload date / document date

### Observations

- Recent
- By Category

---

## 17. Rollout Phases

Rollout sequencing note:

- The phase order in this section is the default launch sequence and is authoritative unless formally changed.
- Any reordered implementation requires explicit sign-off from both Product and Legal **before** development starts on out-of-order work and again **before** release.
- Sign-off must be written, linked to the release decision record, and must name: changed phase order, reason, user/privacy impact, and rollback/containment expectations.
- Without that written dual sign-off, teams must follow the phase order as written.

### Phase 1: Foundation & Entitlements

- Plan gating, trial ineligibility handling, and locked landing
- Owner-only access model and Health-specific permission boundaries
- Health nav entry with hidden/locked rules
- Line selector with `?line=` and first-time line selection flow
- Health consent model, request timing, and re-prompt handling
- Core Health tables, owner-only RLS, and history foundations
- First-visit disclaimer and material-change re-ack handling
- Standard loading, empty, and error states

### Phase 2: Core Profile: Conditions, Medications & Suggestions

- Conditions CRUD
- Medications CRUD
- Shared Suggestions queue
- Duplicate/update review flow
- Structured condition/medication suggestion flow
- Suggestion badges, stale handling, and review history
- Owner-only Health notifications for pending review

### Phase 3: Reminder Integration & Isolation

- Medication-linked reminders
- Consent-gated Health reminder delivery
- Pause, cancel, and manual-resume rules
- Health reminder isolation from generic reminder surfaces
- Health reminder leak closure across home, line detail, search, activity/history, export, and voice reminder tool surfaces
- No outside-Health placeholders, redacted labels, or count leaks
- Reminder limit behavior for paused Health reminders

### Phase 4: AI / Telephony Integration

- In-call verbal Health consent capture for family-managed lines
- Health-consented call-context injection
- Structured condition/medication suggestion creation from calls
- Live-call conflict handling against stored Health data
- Privacy-override suppression for Health suggestions and wellness-alert plumbing
- Next-call verbal notice support for consent and major profile changes

### Phase 5: Documents

- Secure encrypted upload
- Metadata editing
- Inline preview / download with short-lived signed access
- Minimal backend access logging
- Export inclusion

### Phase 6: Observations

- Observation CRUD
- Health-consented limited prompt injection
- No pattern detection / no alerts / no reminder offers

### Phase 7: Export, Deletion & Audit Hardening

- Health-bearing export inclusion and owner-only export visibility
- Privacy-center deletion and full user / org deletion coverage
- Line deletion coverage
- Health item history vs compliance-log boundary enforcement
- Document storage cleanup and lifecycle hardening

### Phase 8: Launch Cleanup & QA

- Public pricing / FAQ / plan-entitlement alignment
- Success-metric instrumentation
- Accessibility, mobile, and privacy regression QA
- Security review of reminder, export, alert, and document access seams

---

## 18. Success Metrics

Replace the original metric set with a safer v1 mix focused on activation, consent, trust, and precision.

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Eligible-plan activation | **25%+** of eligible accounts add at least one condition or medication within 30 days of first Health visit | Measures whether people actually start using Health Profile |
| Health consent conversion | **50%+** of eligible family-managed lines with Health data move to `granted` within 30 days of first recorded Health consent request event | Measures whether dashboard Health becomes useful in calls |
| Suggestion precision | **75%+** of reviewed suggestions are approved as new or approved as update/merge | Measures trustworthiness of Health suggestions |
| Privacy / complaint rate | **<1%** of Health-enabled accounts generate a Health-related privacy complaint or support incident in the first 90 days | Health must not create trust damage |
| Return usage | **40%+** of Health-enabled eligible accounts revisit Health Profile at least 2 times within 30 days | Confirms Health Profile is useful beyond day one |

The upgraded PRD should not use "reminder upsell" as a success metric.

---

## 19. Future Considerations (Post-v1)

- Structured symptoms
- Vitals
- Multi-user Health access with granular permissions
- Observation-triggered reminders
- Observation-fed pattern detection
- AI document extraction
- Additional document types
- Legal document storage
- Doctor-shareable summary exports

---

## 20. Marketing, Docs & Packaging Notes

### Naming

Use **Health Profile** as the canonical product name in product/marketing/docs.

Use **Health** only as shorthand or nav label.

### Positioning

Position it as:

- A private health reference
- An optional AI context layer with consent

Do **not** position it as:

- A care hub
- A clinical platform

### Plan Messaging

Health Profile should be presented as available on:

- Comfort
- Family
- Usage Based

Plan-limit messaging around reminders should remain factual, not salesy.

All public pricing, FAQ, and plan-entitlement copy must be updated to match this availability before launch.

---

## Appendix A: Technical Notes

### Autocomplete

The main PRD should describe autocomplete generically as using **medical terminology APIs** with:

- Optional standardized identifier storage
- Plain-text fallback when autocomplete is unavailable or unhelpful

Likely source candidates can be documented in implementation notes rather than hard-coded in the main PRD.

The implementation spec should use official NLM-backed sources in v1:

- ICD-10-CM / Clinical Tables for conditions
- RxTerms / RxNorm-backed medication search for medications

### Short-Lived Signed Access

The exact signed URL expiry for document preview/download can be set in technical implementation notes based on security best practice and existing platform behavior.

### Health-Alert Suppression Requirement

The privacy override rule in this PRD requires an explicit suppression path for the existing health-mention / wellness-alert pipeline.

Implementations must not assume the current wellness-alert plumbing already satisfies the "don't tell my family / keep this private" behavior without additional suppression logic.

### Authoritative Urgent Safety Boundary Reference

References in this PRD to urgent safety escalation, emergency override, or verification boundary all point to the same product authority: Ultaura's canonical **Urgent Safety & Verification** policy. If policy language changes, that policy remains authoritative for Health behavior.

### Codebase Alignment Captured During PRD Upgrade

This upgraded PRD intentionally aligns with existing platform patterns already present in the codebase:

- Alerts/Privacy-style URL-driven tab/section navigation
- URL-synced line selection
- 30-day re-prompt cooldown pattern
- Existing owner/viewer role distinctions
- Existing export/deletion/audit infrastructure where appropriate, while explicitly adding Health-specific item-history and document-security requirements

It should not be read as implying that current wellness-alert, export, or reminder plumbing already satisfies Health Profile requirements without explicit new Health-specific guards, ownership restrictions, and leak-closure controls.
