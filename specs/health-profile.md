# Health Profile — Implementation Spec

> Paired PRD: [/Users/josephsilvagnoli/Ultaura/health-feature.md](/Users/josephsilvagnoli/Ultaura/health-feature.md)
>
> Updated: 2026-03-14
>
> Rule of use:
>
> - The PRD defines what must be true for the product.
> - This spec defines how we will build it safely and completely.
> - If this spec conflicts with the PRD, the PRD wins and this spec must be updated before implementation proceeds.

---

## 1. Goal

Build a line-scoped, owner-only Health Profile that lets the canonical account owner manage structured health information for a line inside the dashboard, while keeping all call-side use narrow, explicitly consented, privacy-safe, and operationally consistent with Ultaura's existing owner checks, encryption model, reminder engine, alerting stack, export flows, and deletion flows.

This spec exists because the PRD's rollout section is intentionally high-level. Health Profile touches too many systems to implement from rollout bullets alone without creating privacy drift, missed requirements, or unsafe reuse of broader platform plumbing.

### 1.1 Terminology Used Throughout This Spec

- `canonical owner`: the current user referenced by `ultaura_accounts.created_by_user_id`
- `owner`: shorthand for canonical owner only
- `non-owner user`: any authenticated user who is not the canonical owner, including viewers, member-role users, admin-role users, and any other non-primary organization member
- `viewer`: the existing read-only membership/view mode already used elsewhere in the dashboard
- `family primary account holder`: product-language alias for the canonical owner in a family-managed account
- `locked plan`: a canonical owner on an ineligible Health plan; Health nav may still be visible in locked state, but Health detail access remains denied

Unless a section explicitly says otherwise, `owner-only` means the canonical owner only.
Membership owner/admin roles never override `ultaura_accounts.created_by_user_id` for Health authorization in v1.
If `created_by_user_id` is null or unresolved for an account, Health must fail closed for that account until the backfill/remediation flow resolves it.

---

## 2. Current State

### 2.1 Ownership, Access, and Existing Permission Primitives

Current sensitive owner-only dashboard actions are grounded in the account's `created_by_user_id` primitive, not general organization membership role alone.

Relevant files:

- [/Users/josephsilvagnoli/Ultaura/src/lib/ultaura/privacy.ts](/Users/josephsilvagnoli/Ultaura/src/lib/ultaura/privacy.ts)
- [/Users/josephsilvagnoli/Ultaura/src/lib/ultaura/accounts.ts](/Users/josephsilvagnoli/Ultaura/src/lib/ultaura/accounts.ts)
- [/Users/josephsilvagnoli/Ultaura/src/lib/organizations/actions.ts](/Users/josephsilvagnoli/Ultaura/src/lib/organizations/actions.ts)
- [/Users/josephsilvagnoli/Ultaura/src/lib/memberships/mutations.ts](/Users/josephsilvagnoli/Ultaura/src/lib/memberships/mutations.ts)
- [/Users/josephsilvagnoli/Ultaura/supabase/migrations/20260329000003_dashboard_sharing.sql](/Users/josephsilvagnoli/Ultaura/supabase/migrations/20260329000003_dashboard_sharing.sql)

Important implications:

- General RLS access is broader than Health should be. `can_access_ultaura_account(account_id)` allows all organization members with account membership.
- Dashboard viewers already exist and can read many surfaces in disabled/read-only mode.
- Health must not rely on the generic account-access RLS helper alone.
- Health needs its own owner-only RLS helpers and owner-only service checks.
- Any ownership-transfer path that intends to transfer Health must update `ultaura_accounts.created_by_user_id`, not just membership roles.
- Current ownership-role mutation paths are not a safe Health-owner signal by themselves; Health must fail closed whenever membership-role changes and canonical owner mutation are out of sync.
- `upgradeSelfToFamilyMode()` currently changes `user_type` without any Health-specific consent reset, so Health launch must explicitly add that reset behavior before release.

### 2.2 Plan and Trial Gating

Current plan primitives:

- Plan IDs live in `ultaura_plans` and app types include `free_trial | care | comfort | family | payg`.
- Trial accounts are commonly created with `plan_id = 'comfort'` and `status = 'trial'`.
- Reminder and plan messaging are driven by a combination of plan data, trial metadata, and helper logic.

Relevant files:

- [/Users/josephsilvagnoli/Ultaura/src/lib/ultaura/accounts.ts](/Users/josephsilvagnoli/Ultaura/src/lib/ultaura/accounts.ts)
- [/Users/josephsilvagnoli/Ultaura/src/lib/ultaura/plan-features.ts](/Users/josephsilvagnoli/Ultaura/src/lib/ultaura/plan-features.ts)
- [/Users/josephsilvagnoli/Ultaura/packages/types/src/tools.ts](/Users/josephsilvagnoli/Ultaura/packages/types/src/tools.ts)

Important implications:

- Health entitlement logic must check both eligible plan and account status.
- A naive plan-only gate will incorrectly admit trial accounts.
- Locked-plan Health cannot be implemented as a nav-only concern; the page, server loaders, reminder surfaces, exports, and telephony gates all need the same entitlement rule.

### 2.3 Dashboard Navigation, URL State, and Responsive Patterns

Current dashboard navigation is driven by `src/navigation.config.tsx` and rendered through `AppSidebarNavigation`. Privacy and Alerts already use URL-driven tab/section navigation and responsive patterns that Health should reuse.

Relevant files:

- [/Users/josephsilvagnoli/Ultaura/src/navigation.config.tsx](/Users/josephsilvagnoli/Ultaura/src/navigation.config.tsx)
- [/Users/josephsilvagnoli/Ultaura/src/app/dashboard/(app)/privacy/lib/privacy-navigation.ts](/Users/josephsilvagnoli/Ultaura/src/app/dashboard/(app)/privacy/lib/privacy-navigation.ts)
- [/Users/josephsilvagnoli/Ultaura/src/app/dashboard/(app)/alerts/lib/alert-navigation.ts](/Users/josephsilvagnoli/Ultaura/src/app/dashboard/(app)/alerts/lib/alert-navigation.ts)

Important implications:

- Health should be implemented as one top-level route with URL-driven `line` and `tab` state, not nested subroutes per tab.
- `?line=` should use `lines.short_id` to match existing Calls/Reminders patterns.
- URL state should remain authoritative, with last-used line remembered in browser local storage keyed by account id only as a convenience fallback.
- The sidebar does not currently support locked-nav items or count badges. Health needs an explicit navigation extension.
- Mobile behavior must be deliberate. Health cannot rely on generic horizontal tabs alone.

### 2.4 Consent, Re-Prompt, and Audit Patterns

Ultaura already uses `ultaura_line_voice_consent` and `ultaura_consent_audit_log` for broader line-scoped consent behavior. Those patterns are useful references, but they are not safe storage targets for owner-only Health consent state.

Relevant files:

- [/Users/josephsilvagnoli/Ultaura/packages/types/src/privacy.ts](/Users/josephsilvagnoli/Ultaura/packages/types/src/privacy.ts)
- [/Users/josephsilvagnoli/Ultaura/src/lib/ultaura/privacy.ts](/Users/josephsilvagnoli/Ultaura/src/lib/ultaura/privacy.ts)
- [/Users/josephsilvagnoli/Ultaura/telephony/src/services/privacy.ts](/Users/josephsilvagnoli/Ultaura/telephony/src/services/privacy.ts)
- [/Users/josephsilvagnoli/Ultaura/telephony/src/routes/tools/voice-consent.ts](/Users/josephsilvagnoli/Ultaura/telephony/src/routes/tools/voice-consent.ts)
- [/Users/josephsilvagnoli/Ultaura/telephony/src/routes/tools/store-memory.ts](/Users/josephsilvagnoli/Ultaura/telephony/src/routes/tools/store-memory.ts)
- [/Users/josephsilvagnoli/Ultaura/telephony/src/routes/tools/update-memory.ts](/Users/josephsilvagnoli/Ultaura/telephony/src/routes/tools/update-memory.ts)
- [/Users/josephsilvagnoli/Ultaura/telephony/src/websocket/media-stream.ts](/Users/josephsilvagnoli/Ultaura/telephony/src/websocket/media-stream.ts)
- [/Users/josephsilvagnoli/Ultaura/telephony/src/websocket/grok-bridge.ts](/Users/josephsilvagnoli/Ultaura/telephony/src/websocket/grok-bridge.ts)
- [/Users/josephsilvagnoli/Ultaura/supabase/migrations/20260309000001_disclaimer_consent_system.sql](/Users/josephsilvagnoli/Ultaura/supabase/migrations/20260309000001_disclaimer_consent_system.sql)

Important implications:

- Health consent belongs in the same product domain as other consent flows, but it must not reuse the broader member-readable consent tables directly.
- Health needs a separate owner-only current-state table and a separate owner-only Health consent history table.
- Family-managed Health consent still needs a spoken in-call capture path analogous to existing voice consent tooling.
- If broader retained compliance logging is ever required for Health consent, it must be generic and non-Health-specific rather than a detailed Health audit row in existing broad tables.
- Existing preview/test consent tooling can skip current-state writes while still appending generic audit rows; Health must not inherit that behavior implicitly and instead needs an explicit preview/test no-persist rule for all Health state/history/suppression paths.
- Existing telephony tool routes are inconsistent about validating `lineId` against the live call session before side effects; Health routes must treat explicit `lineId` / `callSessionId` binding as a first-class safety requirement rather than assuming current tool patterns are already safe.

### 2.5 Reminder System and Reminder Leak Surfaces

Ultaura already has a shared reminder engine, reminder events, reminder encryption, line-based quota logic, and both call and SMS delivery support.

Relevant files:

- [/Users/josephsilvagnoli/Ultaura/src/lib/ultaura/reminders.ts](/Users/josephsilvagnoli/Ultaura/src/lib/ultaura/reminders.ts)
- [/Users/josephsilvagnoli/Ultaura/src/lib/ultaura/reminder-events.ts](/Users/josephsilvagnoli/Ultaura/src/lib/ultaura/reminder-events.ts)
- [/Users/josephsilvagnoli/Ultaura/src/app/dashboard/(app)/reminders/page.tsx](/Users/josephsilvagnoli/Ultaura/src/app/dashboard/(app)/reminders/page.tsx)
- [/Users/josephsilvagnoli/Ultaura/src/app/dashboard/(app)/reminders/RemindersPageClient.tsx](/Users/josephsilvagnoli/Ultaura/src/app/dashboard/(app)/reminders/RemindersPageClient.tsx)
- [/Users/josephsilvagnoli/Ultaura/src/app/dashboard/(app)/page.tsx](/Users/josephsilvagnoli/Ultaura/src/app/dashboard/(app)/page.tsx)
- [/Users/josephsilvagnoli/Ultaura/src/app/dashboard/(app)/lines/[lineId]/page.tsx](/Users/josephsilvagnoli/Ultaura/src/app/dashboard/(app)/lines/[lineId]/page.tsx)

Important implications:

- Reusing reminders "as is" would leak medication details through generic reminder lists, dashboard home cards, line detail counts, reminder exports, and viewer-readable surfaces.
- Additional verified leak surfaces already exist in generic reminder reads, dashboard search, reminder activity history, insights reminder-call summaries, telephony voice reminder tools, scheduler claim/delivery paths, export composition, admin timeline feeds, in-progress call banners, and call history labels.
- Health-linked reminders need explicit classification, isolation, and redaction behavior.
- Health-linked reminder quota logic cannot reuse current "scheduled reminders count toward limits" semantics unchanged.

### 2.6 Existing Wellness / Health-Mention Pipeline

Ultaura already has a `log_health_mention` tool, encrypted `ultaura_health_mentions`, a wellness-alert processor, and alert delivery preferences. That pipeline is broader than Health Profile and must not be treated as compliant by default.

Relevant files:

- [/Users/josephsilvagnoli/Ultaura/packages/prompts/src/golden/sections/health-wellness.ts](/Users/josephsilvagnoli/Ultaura/packages/prompts/src/golden/sections/health-wellness.ts)
- [/Users/josephsilvagnoli/Ultaura/packages/prompts/src/golden/sections/privacy-policy.ts](/Users/josephsilvagnoli/Ultaura/packages/prompts/src/golden/sections/privacy-policy.ts)
- [/Users/josephsilvagnoli/Ultaura/packages/prompts/src/golden/sections/insights.ts](/Users/josephsilvagnoli/Ultaura/packages/prompts/src/golden/sections/insights.ts)
- [/Users/josephsilvagnoli/Ultaura/packages/prompts/src/golden/sections/tool-policy.ts](/Users/josephsilvagnoli/Ultaura/packages/prompts/src/golden/sections/tool-policy.ts)
- [/Users/josephsilvagnoli/Ultaura/packages/prompts/src/tools/definitions.ts](/Users/josephsilvagnoli/Ultaura/packages/prompts/src/tools/definitions.ts)
- [/Users/josephsilvagnoli/Ultaura/telephony/src/routes/tools/log-health-mention.ts](/Users/josephsilvagnoli/Ultaura/telephony/src/routes/tools/log-health-mention.ts)
- [/Users/josephsilvagnoli/Ultaura/telephony/src/routes/tools/log-call-insights.ts](/Users/josephsilvagnoli/Ultaura/telephony/src/routes/tools/log-call-insights.ts)
- [/Users/josephsilvagnoli/Ultaura/telephony/src/services/insights.ts](/Users/josephsilvagnoli/Ultaura/telephony/src/services/insights.ts)
- [/Users/josephsilvagnoli/Ultaura/telephony/src/services/wellness-alerts.ts](/Users/josephsilvagnoli/Ultaura/telephony/src/services/wellness-alerts.ts)
- [/Users/josephsilvagnoli/Ultaura/telephony/src/services/weekly-summary.ts](/Users/josephsilvagnoli/Ultaura/telephony/src/services/weekly-summary.ts)
- [/Users/josephsilvagnoli/Ultaura/telephony/src/utils/event-sanitizer.ts](/Users/josephsilvagnoli/Ultaura/telephony/src/utils/event-sanitizer.ts)
- [/Users/josephsilvagnoli/Ultaura/src/app/api/telephony/wellness-alerts/route.ts](/Users/josephsilvagnoli/Ultaura/src/app/api/telephony/wellness-alerts/route.ts)

Important implications:

- Symptoms remain in this existing system in v1.
- Health Profile must add a new suppression path for "don't tell my family / keep this private".
- That suppression path must work with current prompt/privacy phrasing, tool policy, call-event sanitization, call-insights concern/follow-up generation, weekly summary generation, and same-call retroactive suppression semantics.
- No implementation should assume current health-mention alerting already satisfies Health Profile privacy rules.

### 2.7 Export, Deletion, and Audit Today

Ultaura already has export requests, export processing, privacy-center deletion, line deletion, and full user/org deletion flows. These do not yet include Health Profile data.

Relevant files:

- [/Users/josephsilvagnoli/Ultaura/src/lib/ultaura/privacy.ts](/Users/josephsilvagnoli/Ultaura/src/lib/ultaura/privacy.ts)
- [/Users/josephsilvagnoli/Ultaura/telephony/src/services/exports.ts](/Users/josephsilvagnoli/Ultaura/telephony/src/services/exports.ts)
- [/Users/josephsilvagnoli/Ultaura/src/lib/server/user/delete-user.ts](/Users/josephsilvagnoli/Ultaura/src/lib/server/user/delete-user.ts)
- [/Users/josephsilvagnoli/Ultaura/src/lib/server/organizations/delete-organization.ts](/Users/josephsilvagnoli/Ultaura/src/lib/server/organizations/delete-organization.ts)

Important implications:

- Health export is additive work, not a simple flag flip.
- Export rows are currently broader than Health wants; health-containing exports need stricter owner-only visibility and download behavior.
- Current export rows can persist raw `download_url` links, which is incompatible with Health-bearing owner-only export handling.
- Current export artifact lifecycle is 48 hours in existing cleanup behavior; Health-bearing artifacts need the stricter v1 24-hour lifecycle defined later in this spec.
- Health-bearing export visibility must be classified at request creation time, not by a later update that leaves a race window.
- Deletion today is split across privacy-center (`requestAccountDataDeletion`) and full destructive flows (`delete-user` / `delete-organization`) with partially separate cleanup paths; Health cleanup/invalidation must be centralized so these paths cannot drift.
- Document/export storage cleanup cannot rely on database cascades alone; Health documents and Health-bearing export artifacts can orphan without explicit pre-delete invalidation + storage deletion.

### 2.8 Encryption and Storage Precedent

Ultaura already uses AES-256-GCM envelope encryption for sensitive data, but health-adjacent data does not currently use one perfectly uniform primitive. Reminders are line-DEK-based, while existing health-mention encryption is account-DEK-based. Health Profile should standardize on line-scoped encryption for its own data model.

Relevant files:

- [/Users/josephsilvagnoli/Ultaura/telephony/src/services/line-encryption.ts](/Users/josephsilvagnoli/Ultaura/telephony/src/services/line-encryption.ts)
- [/Users/josephsilvagnoli/Ultaura/telephony/src/utils/health-mention-crypto.ts](/Users/josephsilvagnoli/Ultaura/telephony/src/utils/health-mention-crypto.ts)
- [/Users/josephsilvagnoli/Ultaura/telephony/src/utils/reminder-crypto.ts](/Users/josephsilvagnoli/Ultaura/telephony/src/utils/reminder-crypto.ts)

Important implications:

- Health should reuse and standardize on the existing line-DEK model for Health Profile data.
- Sensitive Health payloads should be encrypted as opaque payloads and decrypted server-side.
- Because owner-facing Health lists are line-scoped and expected to be small, decrypt-and-filter in application code is preferred over storing more plaintext columns than necessary.

### 2.9 What Does Not Exist Yet

There is no current Health Profile domain model, no owner-only Health RLS, no Health-specific consent status machine, no Health document storage flow, no Health suggestion queue, no Health-linked reminder classification, and no Health export dataset.

This spec therefore defines net-new implementation shape rather than "extend the existing health alert system."

---

## 3. Canonical Product Decisions Imported From the PRD

These are already decided. Implementation agents must not reopen them during build work.

Important:

- The numbering in this section is a decision checklist only.
- It is separate from the `R#` requirement IDs in Section 4.

1. Canonical product name is **Health Profile**. Nav label is **Health**.
2. Health Profile is a private health reference plus optional AI context layer, not a care hub.
3. Health is line-scoped, not account-wide.
4. Access is owner-only:
   - family-managed: canonical owner only
   - self-managed: account owner only
   - viewers/non-primary users: fully hidden
5. Canonical Health owner in v1 is the account's `created_by_user_id` owner primitive.
6. Eligible plans are Comfort, Family, and Usage Based.
7. Care and Free Trial are ineligible.
8. Trial-status accounts are ineligible even if underlying plan assignment is eligible.
9. Locked plans show a visible-but-locked Health nav item and generic preservation language only.
10. Locked plans show no Health counts, badges, or metadata.
11. Owner-initiated export remains allowed even while Health is locked.
12. Health consent is separate from sharing tiers and line-specific.
13. Health consent states are `not_requested`, `granted`, `denied`, `revoked`.
14. Unanswered Health consent requests do not change the consent state.
15. `health_consent_requested_at` represents the owner-requested Health re-prompt event, not merely the spoken ask.
16. Family-managed Health consent is captured verbally during a call; the dashboard may request a re-prompt but may not bypass the senior.
17. The implementation must track requested-vs-prompted timing separately so re-prompt cooldown and spoken consent handling are not conflated.
18. Family-managed owners may build Health before consent.
19. Self-managed users must explicitly opt in from inside Health.
20. Self-managed lines never use the `denied` state; they may move only between `not_requested`, `granted`, and `revoked`.
21. If a self-managed account upgrades to family-managed, each line's Health consent resets to `not_requested` and future call-side Health use requires fresh spoken senior consent.
22. Health consent is an additional gate on top of stricter existing privacy/call gates.
23. No structured symptoms in v1.
24. No vitals in v1.
25. Suggestions cover only structured conditions and medications.
26. Suggestion statuses are `pending`, `approved`, `dismissed`.
27. Suggestions use a shared top-level queue.
28. Suggestions never show transcript excerpts or quotes.
29. Conditions statuses are `Active`, `Monitoring`, `Resolved`.
30. Medications statuses are `Current`, `As-needed`, `Discontinued`.
31. Medication-linked reminders:
   - require Health consent
   - may be created before consent but do not deliver until consent is granted
   - are call-only in v1
   - never use SMS in v1
   - stay paused after re-grant or re-eligibility until manually resumed
32. Health-linked reminders are excluded from v1 Health export.
33. Documents are a secure filing cabinet only.
34. Documents are never parsed by AI or sent to Grok in v1.
35. Observations are a private caregiver log first.
36. Observations do not feed alerts, insights, pattern detection, or reminder offers in v1.
37. With consent, only the 3 most recent observations may be used in call context.
38. Health call context must use normalized owner-safe summaries only; raw caregiver-authored observation text and raw free-text medication reasons are not sent directly to Grok in v1.
39. Live statements during calls can produce update suggestions, but they never directly overwrite stored Health data.
40. Senior privacy override language suppresses both Health suggestions and the existing health-mention/wellness-alert path unless urgent safety applies.
41. That same privacy override also suppresses call-insights concerns, follow-up reasons, and weekly summaries arising from the disclosure unless urgent safety applies.
42. The privacy-suppression bypass is only Ultaura's existing urgent safety / verification boundary; ordinary health-mention severity alone is not enough.
43. Notification detail rules are:
   - dashboard: normalized structured detail only
   - email/SMS: generic only
   - trusted contacts: excluded from Health workflows
44. Pending suggestion notifications are dashboard-only in v1.
45. Health item history is distinct from broader compliance logs.
46. Full account deletion permanently deletes all Health data, Health history, and Health documents.
47. This requirement applies to both privacy-center deletion and full user/org deletion.
48. Health export includes structured data, Health history, document metadata, and original files.
49. Any export containing Health data must be requestable, visible, and downloadable only by the canonical Health owner.
50. Health-bearing exports use an owner-authenticated ZIP download flow with no persisted raw `download_url`.
51. Medical autocomplete uses official NLM-backed sources in v1:
   - ICD-10-CM / Clinical Tables for conditions
   - RxTerms / RxNorm-backed medication search
   - plain-text fallback when autocomplete is unavailable or unhelpful
52. Family-managed denied or revoked Health consent may be manually re-requested by the owner after the same 30-day cooldown.
53. A family-managed spoken Health grant takes effect on the next call, not mid-call; in-call deny/revoke still shuts Health off immediately.
54. Browser-local last-used line memory is keyed by account id; `?line=` URL state always wins when present.
55. Ownership-transfer flows that intend to change the canonical Health owner must update `ultaura_accounts.created_by_user_id` before Health launch.
56. If the canonical owner primitive changes in the future, Health disclaimer state, pending call notices, and Health-bearing export ownership must be treated as belonging to the new canonical owner only after the primitive is actually updated.
57. Health-specific document access logs are deleted with the rest of Health data on line deletion and full deletion.
58. Owner-deleted Health documents hard-delete both the blob and the document row immediately; only allowed Health item history remains.
59. Health reminder pause behavior must support stacked pause sources rather than a single flat reason.

---

## 4. Requirements

### 4.1 Packaging, Entitlements, and Access

| ID | Requirement | PRD Source |
|---|---|---|
| R1 | Health must be available only on Comfort, Family, and Usage Based. | Section 2 |
| R2 | Care and Free Trial must be ineligible for Health. | Section 2 |
| R3 | Trial-status accounts must be ineligible even if `plan_id` is otherwise eligible. | Section 2 |
| R4 | Locked Health must keep the nav visible but locked, with generic preservation copy only. | Section 2 |
| R5 | Locked Health must never show counts, badges, or health-derived metadata. | Sections 2, 7 |
| R6 | Owner-initiated export remains available even when Health is locked. | Sections 2, 14 |
| R7 | The same gating rules apply to family-managed and self-managed accounts. | Section 2 |
| R8 | Health access is owner-only and line-scoped. | Section 4 |
| R9 | Health must be fully hidden from viewers and non-primary users. | Section 4 |
| R10 | The canonical owner primitive in v1 is `created_by_user_id`. | Section 4 |
| R11 | Ownership transfer language must only apply if the underlying canonical owner primitive is updated. | Section 4 |

### 4.2 Health Consent

| ID | Requirement | PRD Source |
|---|---|---|
| R12 | Health consent must be modeled separately from sharing tiers and remain line-specific. | Section 5 |
| R13 | Health consent states are exactly `not_requested`, `granted`, `denied`, `revoked`. | Section 5 |
| R14 | `health_consent_requested_at` must be persisted separately from the state itself and must represent the owner-requested re-prompt event. | Section 5 |
| R15 | A consent request event does not change consent state by itself. | Section 5 |
| R16 | An unanswered prompt leaves the line in `not_requested`. | Section 5 |
| R17 | The 30-day re-prompt cooldown must be measured from the most recent owner-requested `health_consent_requested_at`. | Section 5 |
| R18 | Metrics using first consent request must measure from the first persisted owner-requested consent event, not from the first spoken prompt. | Sections 5, 18 |
| R19 | Health consent is an additional gate and cannot override stricter privacy/call-side controls. | Section 5 |
| R20 | If consent is granted, Health context, structured suggestions, Health-linked reminders, and approved observation context may be used in calls. | Sections 5, 12 |
| R21 | If consent is not granted, Health data may not be used in calls, no structured suggestions may be created, observations may not flow into AI, and Health-linked reminders may not be delivered. | Sections 5, 11, 15 |
| R22 | Family-managed owners may build and manage Health before consent exists. | Section 5 |
| R23 | Dashboard re-prompts must remain manual-only and follow the existing 30-day request-change pattern. | Section 5 |
| R24 | Self-managed users must opt in explicitly from inside Health; no separate in-call consent prompt is required by default, but they may request an optional non-state-changing spoken explanation on a later call through dedicated self-managed prompt state (not the family-managed notice queue). | Section 5 |
| R25 | Denied or revoked Health consent must leave dashboard Health usable while stopping call-side Health use immediately. | Section 5 |
| R26 | Denied or revoked consent must pause existing Health-linked reminders automatically. | Sections 5, 9 |
| R27 | Dashboard UI must clearly show that Health is not being used during calls whenever consent is not granted. | Section 5 |

### 4.3 Notices and Privacy Override

| ID | Requirement | PRD Source |
|---|---|---|
| R28 | Consent change notices are next-call verbal notices only and must use non-specific phrasing. | Section 5 |
| R29 | Major profile change notices are next-call verbal notices only, only after Health consent has already been granted. | Section 5 |
| R30 | Major profile change notices are limited to the exact condition/medication changes defined in the PRD. | Section 5 |
| R31 | Senior privacy override language must suppress family-visible Health suggestions and Health workflow exposure. | Section 5 |
| R32 | The same privacy override must suppress the existing health-mention / wellness-alert path unless urgent safety applies. | Sections 5, Appendix A |
| R33 | Routine symptoms and ordinary medication changes do not cross this boundary. | Section 5 |

### 4.4 Dashboard UX and Navigation

| ID | Requirement | PRD Source |
|---|---|---|
| R34 | Health must be a top-level dashboard nav item for eligible owners only. | Section 6 |
| R35 | Health must be hidden from viewers/non-primary users and visible-but-locked on ineligible plans. | Sections 4, 6 |
| R36 | Multi-line first entry must require explicit line selection, then remember the last-used line with `?line=` URL sync. | Section 6 |
| R37 | Default tab must be Suggestions when pending suggestions exist, otherwise Conditions. | Section 6 |
| R38 | Health tabs are Suggestions, Conditions, Medications, Documents, and Observations. | Section 6 |
| R39 | Suggestions must be a shared Health-level queue, not nested under Conditions or Medications. | Section 6 |
| R40 | Health must follow the Alerts/Privacy responsive pattern and remain usable at 375px. | Sections 3, 6 |
| R41 | First access must show the Health Profile disclaimer using the exact PRD v1 copy, require acknowledgement once, and re-show on material policy/behavior changes. | Section 6 |
| R42 | Health must expose an About Health Profile link after acknowledgement. | Section 6 |
| R43 | First-time empty state must explain setup order, scope, and consent boundaries. | Section 6 |
| R44 | Every tab must define loading, empty, and error states. | Section 6 |
| R45 | Upload flows must show progress and retry. | Section 6 |
| R46 | Autocomplete failures must degrade to plain text. | Sections 6, Appendix A |
| R47 | Failed consent re-prompts and partial linked-reminder update failures must surface clear error messaging. | Section 6 |

### 4.5 Suggestions Queue

| ID | Requirement | PRD Source |
|---|---|---|
| R48 | The Suggestions queue is only for structured conditions and medications. | Section 7 |
| R49 | Suggestions may only be created when Health consent is granted, the disclosure is not privacy-blocked, and the fact is not already represented. | Section 7 |
| R50 | User-facing suggestion statuses are exactly `pending`, `approved`, `dismissed`. | Section 7 |
| R51 | Suggestion cards must show the exact fields allowed by the PRD and must exclude raw transcript excerpts and quotes. | Section 7 |
| R52 | When a similar item exists, the primary review action must be Review as update. | Section 7 |
| R53 | Owners must be able to approve as new, approve as update/merge, or dismiss. | Section 7 |
| R54 | Active queue ordering is newest first. | Section 7 |
| R55 | Dismissed suggestions may reappear only on materially different evidence as defined in the PRD. | Section 7 |
| R56 | Manual creation/edit of the underlying item must stale and remove competing pending suggestions from the active queue while preserving history. | Section 7 |
| R57 | Count-only badges must appear on Health nav and Suggestions tab only when Health is unlocked. | Section 7 |
| R161 | The Suggestions tab must support explicit Conditions / Medications filtering in v1. | Sections 7, 16 |

### 4.6 Conditions

| ID | Requirement | PRD Source |
|---|---|---|
| R58 | Conditions must store the exact v1 fields defined in the PRD. | Section 8 |
| R59 | Condition dates must support approximate precision: year, month-year, full date. | Section 8 |
| R60 | Condition statuses are `active`, `monitoring`, and `resolved`. | Section 8 |
| R61 | Monitoring must live inside the active list with a clear badge/filter. | Section 8 |
| R62 | Conditions must support active view, resolved view, and monitoring filter. | Section 8 |
| R63 | Conditions must support add, edit, status change, delete, and view history. | Section 8 |
| R64 | Similar-condition saves must warn and recommend update/merge rather than silently duplicate. | Section 8 |

### 4.7 Medications and Linked Reminders

| ID | Requirement | PRD Source |
|---|---|---|
| R65 | Medications must store the exact v1 fields defined in the PRD. | Section 9 |
| R66 | Medication dates must support approximate precision where applicable. | Section 9 |
| R67 | Medication statuses are `current`, `as_needed`, and `discontinued`. | Section 9 |
| R68 | Medication views must support Current, As-needed, and Discontinued. | Section 9 |
| R69 | Health-linked reminders are part of Health behavior and require Health consent. | Section 9 |
| R70 | Generic reminders created outside Health remain separate and do not depend on Health consent. | Section 9 |
| R71 | Health-linked reminders may be created before consent exists but cannot deliver until consent is granted. | Sections 5, 9 |
| R72 | Health-linked reminders are call-only in v1 and must never use SMS. | Sections 9, 13 |
| R73 | A medication may have multiple linked reminders, but the UI must present one obvious medication-reminder relationship. | Section 9 |
| R74 | Health-linked reminders must use the shared reminder engine but be managed and viewed inside Health. | Section 9 |
| R75 | Health-linked reminders count toward limits only while active. | Section 9 |
| R76 | Health-linked reminders must never show sensitive detail in generic reminder surfaces, line summary counts, viewer surfaces, locked-plan UI, or any other non-Health surface. | Sections 9, 14 |
| R77 | Default rule: Health-linked reminders are not surfaced outside Health at all. | Section 9 |
| R78 | Outside-Health fallback rendering of Health-linked reminders is not part of v1; if a future platform constraint requires it, that behavior needs a separate approved spec revision. | Section 9 + user clarification |
| R79 | Dosage/notes edits do not auto-change reminder copy unless explicitly edited. | Section 9 |
| R80 | Time/schedule changes must prompt the owner to update linked reminders. | Section 9 |
| R81 | Medication discontinue/delete must cancel linked reminders automatically. | Section 9 |
| R82 | Consent revoke/deny or plan ineligibility must pause linked reminders automatically and explain why. | Sections 5, 9, 14 |
| R83 | After re-grant or re-eligibility, Health-linked reminders remain paused until manually resumed. | Sections 9, 14 |
| R84 | Medications must support add, edit, status change, delete, manage linked reminders, and view history. | Section 9 |
| R85 | Similar-medication saves must warn and recommend update/merge. | Section 9 |

### 4.8 Documents

| ID | Requirement | PRD Source |
|---|---|---|
| R86 | Documents are a secure filing cabinet only and are never parsed by AI in v1. | Sections 10, 15 |
| R87 | Supported file types are PDF, JPG, JPEG, PNG, and HEIC only. | Section 10 |
| R88 | Maximum file size is 25 MB. | Section 10 |
| R89 | Documents must store the exact metadata fields defined in the PRD. | Section 10 |
| R90 | Legal documents are out of scope for Health v1. | Section 10 |
| R91 | PDFs and images preview inline; download remains available as fallback. | Section 10 |
| R92 | Preview/download must use short-lived on-demand signed access. | Sections 10, Appendix A |
| R93 | Preview/download actions are excluded from user-facing Health history, and document access logging is backend-only security logging in v1; it may remain until line/full Health deletion. | Sections 10, 14, 15 |
| R94 | Sensitive document metadata must be protected with the same privacy posture as the file content. | Sections 10, 15 |
| R95 | Document access logs must contain only the allowed minimal fields and must never store titles, filenames, notes, signed URLs, or decrypted metadata. | Section 15 |
| R162 | Documents must support category filtering and sort by upload date or document date in v1. | Sections 10, 16 |

### 4.9 Observations

| ID | Requirement | PRD Source |
|---|---|---|
| R96 | Observations are a private caregiver log first. | Section 11 |
| R97 | Observations must store the exact fields defined in the PRD. | Section 11 |
| R98 | Observation categories are fixed to the PRD list in v1. | Section 11 |
| R99 | Concern levels are `note`, `mild_concern`, and `significant_concern`. | Section 11 |
| R100 | Observations must support Recent view and By Category view. | Section 11 |
| R101 | Before Health consent is granted, observations remain dashboard-only and do not feed Grok, alerts, insights, or pattern detection. | Sections 11, 15 |
| R102 | After Health consent is granted, only a small recent subset may be used for call context and never for medical advice. | Sections 11, 12 |
| R103 | The prompt-visible subset is exactly the 3 most recent observations, ordered deterministically by `coalesce(observedDate, createdAt::date)` desc, then `createdAt` desc, then `id` desc. | Sections 11, 12 |
| R104 | Observations do not trigger reminder offers, alerts, Insights, or pattern detection in v1. | Section 11 |
| R105 | Observations must support add, edit, delete, category filter, and view history. | Section 11 |

### 4.10 AI / Prompt Use / Telephony

| ID | Requirement | PRD Source |
|---|---|---|
| R106 | When consent is granted, the Health call context may include active/monitoring conditions, current/as-needed medications where appropriate for context, and the 3 most recent observations; medication inclusion must be deterministic when more than the cap qualifies. | Section 12 |
| R107 | Documents are never sent to Grok in v1. | Sections 10, 12, 15 |
| R108 | Structured call-derived suggestions are limited to new/update condition or medication changes. | Section 12 |
| R109 | Live-call conflicts must be handled conversationally with the live statement, while the approved profile remains source of truth until owner review. | Section 12 |
| R110 | Symptoms remain in the existing wellness / health-mention system and do not become structured Health entities in v1. | Section 12 |
| R111 | Health guardrails must explicitly prohibit diagnosis, symptom interpretation, medication advice, and clinician framing. | Section 12 |
| R112 | Pending suggestions must not be fed back into Health prompt context. | Derived from Section 7 + final review outcomes |

### 4.11 Notifications

| ID | Requirement | PRD Source |
|---|---|---|
| R113 | Pending Health suggestion notifications are dashboard-only in v1 and go to the primary account holder only. | Section 13 |
| R114 | Dashboard may show normalized structured suggestion detail only. | Section 13 |
| R115 | Email and SMS, when used for allowed Health notifications, must stay generic and must not contain specific health detail. | Section 13 |
| R116 | Health workflows do not notify trusted contacts in v1. | Section 13 |
| R117 | Health pages must clearly state that Health-linked reminders are call-only and not delivered by SMS. | Section 13 |
| R118 | Senior notices remain verbal next-call only for family-managed lines; no health-specific SMS/email notices to the senior are required, and the optional self-managed spoken explanation path remains verbal-only. | Section 13 |

### 4.12 Audit, Export, Deletion, and Security

| ID | Requirement | PRD Source |
|---|---|---|
| R119 | Health item history must track create, edit, delete, suggestion approve, suggestion dismiss, and internal system stale-dismiss handling. | Section 14 |
| R120 | User-facing delete removes items from normal views immediately while preserving Health item history. | Section 14 |
| R121 | Full account deletion must permanently delete structured Health data, suggestions, Health item history, and Health documents. | Section 14 |
| R122 | This deletion requirement must apply to both privacy-center account deletion and full user/org deletion flows. | Section 14 |
| R123 | Health item history is distinct from broader platform compliance logs. | Section 14 |
| R124 | Health-specific content must not be retained in compliance logs beyond what existing platform rules strictly require. | Section 14 |
| R125 | Line deletion deletes the line's Health Profile. | Section 14 |
| R126 | Export must include structured Health data, Health item history, document metadata, and original document files. | Section 14 |
| R127 | Any export containing Health data must be requestable, visible, and downloadable only by the canonical Health owner. | Section 14 |
| R128 | Health plan downgrade must preserve data, lock detail views, stop call-side use, and pause Health-linked reminders. | Sections 2, 14 |
| R129 | Health-linked reminders remain paused after re-eligibility until manual resume. | Sections 9, 14 |
| R130 | Health data must use line-scoped encryption at rest consistent with Ultaura's privacy model. | Section 15 |
| R131 | Documents must use app-layer per-line encryption before durable storage. | Section 15 |
| R132 | Health use must always respect Health consent, privacy-request language, and urgent safety boundaries. | Section 15 |
| R133 | Before Health consent is granted there must be no cross-feature leakage of Health Profile data or caregiver observations into prompt context, structured suggestions, Health-derived alerts/insights/pattern detection, or Health-linked reminder delivery. The only allowed pre-consent carveout is fetch of safe prompt/notices state defined in R176; this does not disable the separate symptom / wellness pipeline. | Section 15 |

### 4.13 Launch and Instrumentation

| ID | Requirement | PRD Source |
|---|---|---|
| R134 | Public pricing, FAQ, plan-entitlement, and positioning copy must be updated before launch to match Health availability and must not frame Health Profile as a care hub or clinical platform. | Section 20 |
| R135 | Health implementation must emit enough analytics/instrumentation to measure the success metrics in Section 18 of the PRD. | Section 18 |

### 4.14 Additional Implementation-Safety Requirements

These are implementation-safety rules derived from PRD intent, privacy review, and codebase reality. They are binding for engineering execution. Product/legal/privacy launch approvals for non-PRD-native constraints remain tracked in Sections 15 and 17 as external operational dependencies and do not, by themselves, block implementation freeze.

| ID | Requirement | Source |
|---|---|---|
| R136 | Family-managed Health consent must be captured through an explicit spoken in-call consent path; the dashboard may request a re-prompt but may not grant or deny on the senior's behalf. | PRD Section 5 + existing voice-consent platform pattern |
| R137 | Requested-vs-prompted Health consent timing must be stored separately: owner-request event vs actual spoken prompt event. | User clarification + PRD Section 5 |
| R138 | Health call context must stay narrow in v1: conditions send only `name` + `status`, medications send only `name` + `status` + `timesOfDay`, and observations send only normalized owner-safe summaries plus category/concern/date. Raw caregiver-authored observation text and raw free-text medication reasons must not be sent to Grok. | User clarification + PRD Sections 11-12 |
| R139 | Health-linked reminders and Health reminder-link records are excluded from v1 Health export. | User clarification + PRD Section 14 export scope |
| R140 | If the canonical owner primitive changes, disclaimer acknowledgement, pending call notices, and Health-bearing export ownership must be treated as fresh owner state and must not silently inherit prior-owner state. | Review finding + owner-only lifecycle rule |
| R141 | Health document access logs are deleted with Health data on line deletion and full deletion. | User clarification |
| R142 | Health reminder pause behavior must support stacked pause sources rather than a single flat reason. | Engineering design decision for deterministic pause semantics |
| R143 | A disclosure may bypass privacy suppression only through the existing urgent safety / verification boundary; ordinary health-mention severity is insufficient. | User clarification + PRD Section 5 |
| R144 | Health-bearing export visibility must be classified owner-only at request creation time, not by a later update that creates a race window. | Review finding + owner-only export rule |
| R145 | Same-call privacy suppression must be retroactive within the call: already-buffered or already-persisted same-call Health suggestion candidates, plus alertable health mentions from that call, must be suppressed before post-call processing completes. | Review finding + PRD privacy override rule |
| R146 | Health reminder hardening applies to search, generic reminder exports, insights reminder-call surfaces, scheduler claim/delivery, and voice reminder tools, not just dashboard reminder pages. | Review finding + PRD reminder privacy rule |
| R147 | Owner-only Health visibility extends to internal/admin/support surfaces by default unless a separate explicit break-glass rule is later designed and approved. | Review finding + owner-only Health model |
| R148 | Health consent current state and detailed Health consent history must live in owner-only Health-specific tables/services, not in broader member-readable generic consent/audit tables. | User clarification + codebase review |
| R149 | The Health private-disclosure rule also suppresses call-insights concerns, follow-up reasons, and weekly summaries arising from that disclosure unless the urgent safety / verification boundary is crossed. | User clarification |
| R150 | Medical autocomplete must use server-side NLM-backed sources in v1: ICD-10-CM / Clinical Tables for conditions and RxTerms / RxNorm-backed search for medications, with plain-text fallback. | User clarification |
| R151 | Health-bearing exports must use an owner-authenticated ZIP download flow with a JSON manifest and original document files; persisted raw `download_url` links are not allowed. | User clarification |
| R152 | Owner-deleted Health documents must hard-delete both the blob and the document row immediately while allowed Health history remains. | User clarification |
| R153 | Health line selection must use `?line=<line.short_id>` with URL precedence and local-storage last-used line memory keyed by account id. | Codebase alignment + user clarification |
| R154 | Family-managed denied or revoked Health consent may be manually re-requested by the owner after the same 30-day cooldown. | User clarification |
| R155 | A family-managed spoken Health grant takes effect on the next call, not mid-call; in-call deny/revoke still shuts Health off immediately. | User clarification |
| R156 | Ownership-transfer flows that intend to change the canonical Health owner must update `ultaura_accounts.created_by_user_id` before Health launch. | User clarification + codebase review |
| R157 | `summaryParaphrase` and `ownerSafeSummary` must be minimized, quote-free, attribution-free, and safe for their intended audience. | Review finding + privacy requirement |
| R158 | Same-call retroactive suppression must cover already-persisted same-call health-mention rows and downstream artifacts, not only in-memory buffered candidates. | Review finding + codebase reality |
| R159 | Health-bearing export visibility must be based on an immutable request-time visibility class and requested-scope snapshot, not on a mutable post-processing boolean alone; immutability must be enforced at the DB layer, not app logic alone. | Review finding |
| R160 | Health must force/create a line DEK before any Health data is stored for a line; account-DEK fallback is not allowed for Health Profile data. | User clarification + codebase review |
| R163 | Health export inclusion is automatic in v1 whenever request-time scope detects any Health data for the account; there is no owner-facing include/exclude Health toggle. | User clarification + PRD export rule |
| R164 | Pre-created Health-linked reminders must remain paused until manual resume after the first `not_requested -> granted` transition. | User clarification |
| R165 | V1 private-disclosure suppression for aggregated insights and weekly summaries uses whole-call health-adjacent exclusion for that call rather than per-concern provenance. | User clarification + current storage reality |
| R166 | `major_profile_change` notices must use an explicit change-type enum limited to the PRD-approved trigger list only. | Review finding + PRD Section 5 |
| R167 | Owner-only Health access means the canonical owner only; all other organization members are denied even if they are not viewer-role users. | Review finding + PRD Sections 4 and 6 |
| R168 | If a self-managed account upgrades to family-managed, each line's Health consent must reset to `not_requested`, Health-linked reminders must pause, and future call-side Health use must wait for fresh spoken senior consent. | User clarification + privacy requirement |
| R169 | Mid-call deny/revoke must shut off Health for the remainder of that live session through session-local gating of Health prompt use, context use, tool paths, and outbound response references to previously injected Health context. Session-local gating is the authoritative shutdown control; telephony must also attempt a realtime `session.update` (or equivalent prompt refresh) to strip previously injected Health context when it was present. | Review finding + realtime implementation constraint |
| R170 | Shared schemas must validate every `timesOfDay` entry as canonical `HH:MM` 24-hour time. | Review finding + PRD medication schedule requirement |
| R171 | Success-metric instrumentation must emit explicit, named events and persisted timestamps sufficient to measure activation, consent conversion, precision, privacy incidents, and return usage before launch. | Review finding + PRD Section 18 |
| R172 | Health launch must have a server-side feature flag / kill switch with a DB-backed runtime source of truth and env-var fallback so the Health nav, Health routes, and telephony Health context/suggestion/reminder paths can fail closed without code redeploy. | User clarification + launch safety requirement |
| R173 | Health may only create and manage reminders that are born as Health-linked in v1; existing general reminders must not be reclassified into Health, and Health reminder writes must fail closed rather than falling back to plaintext reminder storage. | User clarification + privacy classification rule |
| R174 | Self-managed canonical owners may use Observations in v1 under the same owner-only storage and call-side consent rules as family-managed owners. | User clarification |
| R175 | Spoken Health prompts and spoken Health notices must use the live call language when supported, with English fallback otherwise. | User clarification |
| R176 | Telephony may fetch family-managed pre-consent prompt/notices state and self-managed optional spoken-explanation prompt state before consent is granted, but structured Health profile arrays must remain empty until consent and eligibility allow call-side Health use. | Review finding + user clarification |
| R177 | For `suggestionMode = 'update'`, update-target resolution is deterministic: choose the closest active same-kind item by normalized-name exact match first, then alias match, then similarity score; ties break by most-recently-updated then lexical `id`; if no candidate crosses threshold, reject with a deterministic `no_update_target` result and do not persist. | Review finding + implementation safety |
| R178 | Health consent history preview is owner-only and available only inside Health surfaces; broad privacy/consent pages must not render detailed Health consent history rows in v1. | Review finding + owner-only consent model |
| R179 | Health reminder leak closure is required across all verified surfaces: generic reminder reads, dashboard home cards, line detail counts, dashboard search, reminder activity/history, export composition, voice reminder tools, admin timeline, in-progress call banner, and call history labels. | Review finding + codebase reality |
| R180 | Health deletion/export invalidation logic must be centralized and reused by privacy-center account deletion (`requestAccountDataDeletion`), line deletion, full user deletion, and full organization deletion so no flow can bypass Health cleanup. | Review finding + codebase reality |
| R181 | Any unresolved canonical-owner conflict (`created_by_user_id` null/conflicting) keeps Health fail-closed for that account, blocks Health-bearing export/download access grants, and blocks ownership-transfer completion until remediation succeeds. | Review finding + ownership safety |
| R182 | Health-bearing export artifact retention for v1 is 24 hours (not the current broader export retention); cleanup and invalidation jobs must enforce this exact TTL. | Review finding + lifecycle hardening |
| R183 | Preview/test call sessions must not persist Health consent state, Health consent history, Health suggestion candidates, Health suppression markers, Health notice delivery state, or Health metrics/events; they may return synthetic/no-op success only to exercise tool flow without contaminating durable Health records. | Review finding + existing preview/test behavior gap |
| R184 | Every Health telephony route or internal endpoint that accepts both `lineId` and `callSessionId` must load the call session and reject mismatched line/session combinations before any Health read or write side effect occurs. | Review finding + existing telephony route inconsistency |

---

## 5. PRD Coverage Map

This section is the anti-hallucination map. Every PRD section must be covered by concrete implementation work.

| PRD Section | Requirement IDs | Primary Phases |
|---|---|---|
| 2. Availability & Packaging | R1-R7, R128, R134 | Phase 1, Phase 8 |
| 3. Goals & Non-Goals | R86, R90, R104, R107, R110, R111 | All phases, especially 4-6 |
| 4. Users, Access & Permissions | R8-R11, R35, R127, R181 | Phase 1, Phase 7 |
| 5. Health Consent Model | R12-R33, R183 | Phase 1, Phase 4 |
| 6. Information Architecture & UX | R34-R47 | Phase 1, Phase 2, Phase 5, Phase 6 |
| 7. Shared Suggestions Queue | R48-R57 | Phase 2, Phase 4 |
| 8. Conditions | R58-R64 | Phase 2 |
| 9. Medications | R65-R85 | Phase 2, Phase 3 |
| 10. Documents | R86-R95 | Phase 5, Phase 7 |
| 11. Observations | R96-R105 | Phase 6 |
| 12. AI Behavior & Prompt Use | R106-R112, R177, R184 | Phase 4, Phase 6 |
| 13. Notifications | R113-R118 | Phase 2, Phase 4, Phase 8 |
| 14. Audit, Export, Deletion & Lifecycle | R119-R129, R180, R182 | Phase 1, Phase 2, Phase 3, Phase 5, Phase 7 |
| 15. Security & Privacy Requirements | R130-R133, R178-R179, R183-R184 | Phase 1, Phase 3, Phase 4, Phase 5, Phase 7 |
| 16. UI Sections Summary | R37-R45, R62, R68, R100, R161-R162 | Phase 1, Phase 2, Phase 5, Phase 6 |
| 17. Rollout Phases | Entire spec | All phases |
| 18. Success Metrics | R18, R135, R171 | Phase 1, Phase 8 |
| 19. Future Considerations | Out of scope | None |
| 20. Marketing, Docs & Packaging Notes | R134 | Phase 8 |
| Derived implementation-safety rules | R136-R184 | Phases 1, 3, 4, 7, 8 |

Implementation is not complete until every requirement in Section 4 is mapped to a completed task and verified.

---

## 6. Affected Files

### 6.1 Database Migrations and Database Tests

| File | Change |
|---|---|
| `supabase/migrations/2026MMDD000001_health_profile_foundation.sql` (NEW) | Health enums, runtime feature-flag table, owner-only helper functions, `ultaura_health_line_consent`, `ultaura_health_consent_history`, `ultaura_health_account_state`, conditions/medications/suggestions/history/call-notices tables, suppression fields on existing `ultaura_health_mentions`, and owner-only RLS policies |
| `supabase/migrations/2026MMDD000002_health_profile_reminder_integration.sql` (NEW) | Reminder `source_context` / stacked pause-source columns, health-medication-reminder link table, limit/count logic updates for paused Health reminders, and claim/delivery SQL hardening for consent/eligibility-aware Health reminder delivery |
| `supabase/migrations/2026MMDD000003_health_profile_documents.sql` (NEW) | Documents table, document access log table, `ultaura-health-documents` bucket creation plus private bucket/policy contract, hard-delete document lifecycle support, and export-classification helper extension once `ultaura_health_documents` exists |
| `supabase/migrations/2026MMDD000004_health_profile_observations.sql` (NEW) | Observations table, indexes, and export-classification helper extension once `ultaura_health_observations` exists |
| `supabase/migrations/2026MMDD000005_health_profile_export_hardening.sql` (NEW) | Phase-1-safe export-request immutable visibility class / scope snapshot plus actual delivered artifact metadata, authenticated-download foundations, and base classification helpers that reference only tables available after `000001` |
| `supabase/migrations/2026MMDD000006_health_owner_transfer_backfill.sql` (NEW) | Ownership-transfer backfill and verification helpers plus SQL transfer-function updates so canonical Health owner state is consistent with `created_by_user_id` before launch |
| `supabase/tests/database/health-profile-rls.test.sql` (NEW) | Owner-only access tests, viewer denial, and export visibility rules at the DB policy layer only |
| `supabase/tests/database/health-profile-reminders.test.sql` (NEW) | Health-linked reminder source-context counting, pause/cancel/manual-resume semantics, generic reminder isolation |
| `supabase/tests/database/health-profile-deletion.test.sql` (NEW) | Privacy-center deletion, full org deletion, line deletion, Health storage metadata cleanup expectations |

Migration naming note:

- The `2026MMDD...` prefixes in this spec are illustrative placeholders only. Final implementation must use real monotonically increasing migration timestamps.
- The `00000X` suffixes in placeholder filenames are mnemonic labels, not execution-order guarantees. Final timestamped filenames must enforce this rollout order explicitly, including Phase 1.6 export hardening before the later documents/observations helper extensions.

### 6.2 Shared Types and Validation

| File | Change |
|---|---|
| `packages/types/src/privacy.ts` | Extend shared export-request shapes only where needed for Health-bearing owner-only export visibility; Health consent types stay in `packages/types/src/health.ts` |
| `packages/types/src/health.ts` (NEW) | Canonical Health domain types, enums, approximate date types, Health call-context contract |
| `packages/types/src/tools.ts` | Add telephony tool arg/result types for Health suggestion candidate submission, spoken Health consent, and private-disclosure suppression |
| `packages/types/src/index.ts` | Export new Health types |
| `packages/schemas/src/health.ts` (NEW) | Dashboard form and server-action schemas for Health entities |
| `packages/schemas/src/telephony/health.ts` (NEW) | Schemas for telephony-to-app internal Health payloads |
| `packages/schemas/src/index.ts` | Export new schemas |
| `src/database.types.ts` | Regenerate database types after Health migrations land |
| `src/lib/ultaura/types.ts` | Extend app-side unions and row adapters for new Health enums, history payloads, reminder pause sources, and export visibility fields |
| `telephony/src/utils/supabase.ts` | Refresh telephony DB typings after new migrations if generated client types are used there |

### 6.3 Dashboard Route and UI

| File | Change |
|---|---|
| `src/navigation.config.tsx` | Add Health nav item, locked-nav support, required count badge support, entitlement-aware visibility, and feature-flag-aware hiding |
| `src/app/dashboard/(app)/components/AppSidebarNavigation.tsx` | Render locked Health nav and required badge behavior safely |
| `src/components/MobileAppNavigation.tsx` | Respect Health hidden/locked state and required nav-badge rules on mobile |
| `src/core/ui/Sidebar.tsx` | Support locked/disabled sidebar items and required count badge rendering for Health nav/suggestions |
| `src/lib/search/navigation-registry.ts` | Ensure Health does not leak through command-palette navigation for viewers or locked-plan non-access paths |
| `src/components/SearchCommandPalette.tsx` | Verify locked/hidden Health behavior is respected in dashboard search navigation results |
| `src/app/api/search/route.ts` | Exclude or safely redact Health-linked reminders and any future Health-searchable artifacts from non-Health search surfaces |
| `src/app/dashboard/(app)/health/page.tsx` (NEW) | Server entrypoint for Health Profile route |
| `src/app/dashboard/(app)/health/loading.tsx` (NEW) | Route loading state |
| `src/app/dashboard/(app)/health/error.tsx` (NEW) | Route error state |
| `src/app/dashboard/(app)/health/HealthProfilePageClient.tsx` (NEW) | Main tabbed Health UI orchestration |
| `src/app/dashboard/(app)/health/types.ts` (NEW) | Route-local tab/filter/view types |
| `src/app/dashboard/(app)/health/lib/health-navigation.ts` (NEW) | Parse/build Health URLs for `line` and `tab` |
| `src/app/dashboard/(app)/health/components/HealthLockedState.tsx` (NEW) | Locked-plan landing with generic preservation copy |
| `src/app/dashboard/(app)/health/components/HealthLineSelector.tsx` (NEW) | Explicit first-time line chooser and remembered last-used line behavior |
| `src/app/dashboard/(app)/health/components/HealthDisclaimerDialog.tsx` (NEW) | First-visit disclaimer and material-change re-acknowledgement |
| `src/app/dashboard/(app)/health/components/HealthConsentCard.tsx` (NEW) | Consent state banner, request/re-prompt controls, self opt-in control, and owner-only consent-history preview |
| `src/app/dashboard/(app)/health/components/HealthSuggestionsTab.tsx` (NEW) | Shared suggestions queue UI with Conditions / Medications filters |
| `src/app/dashboard/(app)/health/components/HealthConditionsTab.tsx` (NEW) | Conditions views and actions |
| `src/app/dashboard/(app)/health/components/HealthConditionForm.tsx` (NEW) | Condition create/edit form |
| `src/app/dashboard/(app)/health/components/HealthMedicationsTab.tsx` (NEW) | Medications views and actions |
| `src/app/dashboard/(app)/health/components/HealthMedicationForm.tsx` (NEW) | Medication create/edit form |
| `src/app/dashboard/(app)/health/components/HealthMedicationReminderPanel.tsx` (NEW) | Health-linked reminder management UI |
| `src/app/dashboard/(app)/health/components/HealthDocumentsTab.tsx` (NEW) | Document list UI with category filter and upload-date / document-date sort |
| `src/app/dashboard/(app)/health/components/HealthDocumentUpload.tsx` (NEW) | Upload, retry, progress, preview-ready document flow |
| `src/app/dashboard/(app)/health/components/HealthObservationsTab.tsx` (NEW) | Observations CRUD UI |
| `src/app/dashboard/(app)/health/components/HealthHistoryDrawer.tsx` (NEW) | Reusable history surface for conditions, medications, and observations |
| `src/app/dashboard/(app)/health/components/HealthEmptyState.tsx` (NEW) | First-time explanatory empty state |
| `src/app/dashboard/(app)/health/components/HealthErrorState.tsx` (NEW) | Reusable tab error presentation |
| `src/app/dashboard/(app)/privacy/components/sections/ExportSection.tsx` | Replace raw Health-bearing export links with owner-authenticated download actions |
| `src/app/dashboard/(app)/reminders/components/ReminderActivity.tsx` | Prevent Health-linked reminders from leaking through generic reminder activity history |
| `src/app/dashboard/(app)/lines/[lineId]/LineDetailClient.tsx` | Remove Health-linked reminder counts/details from line detail non-Health surfaces |

### 6.4 App-Side Health Services

| File | Change |
|---|---|
| `src/lib/ultaura/health/access.ts` (NEW) | Canonical owner checks, line authorization, viewer denial, entitlement checks |
| `src/lib/ultaura/health/entitlements.ts` (NEW) | Eligible-plan + trial-status gating helpers plus DB-backed Health kill-switch with env fallback |
| `src/lib/ultaura/health/account-state.ts` (NEW) | Disclaimer acknowledgement plus persisted first/last view and first-item metric anchors |
| `src/lib/ultaura/health/consent.ts` (NEW) | Dashboard-side Health consent state reads, self opt-in/revoke, family re-prompt requests |
| `src/lib/ultaura/health/consent-history.ts` (NEW) | Owner-only Health consent history writes/reads; no reuse of broad generic audit surfaces for detailed Health consent state |
| `src/lib/ultaura/health/types.ts` (NEW) | App-side domain adapters between DB rows and shared types |
| `src/lib/ultaura/health/crypto.ts` (NEW) | Health payload encryption/decryption using line DEKs |
| `src/lib/ultaura/health/autocomplete.ts` (NEW) | Server-side wrappers for ICD-10-CM / Clinical Tables and RxTerms / RxNorm-backed search with plain-text fallback handling |
| `src/lib/ultaura/health/conditions.ts` (NEW) | Conditions CRUD, duplicate warnings, history writes |
| `src/lib/ultaura/health/medications.ts` (NEW) | Medications CRUD, duplicate warnings, history writes |
| `src/lib/ultaura/health/suggestions.ts` (NEW) | Suggestion creation, dedupe, stale invalidation, review/merge, badge counts |
| `src/lib/ultaura/health/reminders.ts` (NEW) | Health reminder link management, pause/resume/cancel orchestration, redaction metadata |
| `src/lib/ultaura/health/documents.ts` (NEW) | Upload draft/finalize flow, metadata edits, delete behavior, export lookups |
| `src/lib/ultaura/health/document-access.ts` (NEW) | App-signed short-lived access tokens, decrypt-and-stream preview/download, minimal access logging |
| `src/lib/ultaura/health/observations.ts` (NEW) | Observation CRUD, list ordering/filtering, history writes |
| `src/lib/ultaura/health/history.ts` (NEW) | Health item history queries and write helpers |
| `src/lib/ultaura/health/call-notices.ts` (NEW) | Queue and dedupe next-call verbal notices and generate app-side spoken text in the live call language with English fallback |
| `src/lib/ultaura/health/analytics.ts` (NEW) | Emit allowlisted Health metric events and expose launch-metric query helpers/reporting definitions |
| `src/lib/ultaura/health/reporting.ts` (NEW) | Concrete launch-reporting queries and joins for activation, consent conversion, suggestion precision, revisit, and privacy-incident metrics |
| `src/lib/ultaura/health/export.ts` (NEW) | Health export dataset composition for export service consumption |
| `src/lib/ultaura/health/deletion.ts` (NEW) | Central Health deletion and storage cleanup utilities reused by privacy-center and full org deletion flows |
| `src/lib/ultaura/privacy.ts` | Wire Health deletion/export ownership changes into privacy-center flows (`requestAccountDataDeletion`) and audit |
| `src/app/dashboard/(app)/privacy/lib/privacy-formatters.ts` | Render authenticated Health export download descriptors without raw signed URL assumptions |
| `src/app/dashboard/(app)/privacy/hooks/useExportPolling.ts` | Poll/authenticate Health-bearing export readiness using the new owner-authenticated download model |
| `src/lib/ultaura/reminders.ts` | Add `source_context` filtering, redaction handling, and active-only Health reminder counting behavior |
| `src/lib/ultaura/reminder-events.ts` | Log system pause/resume/cancel events for Health-linked reminders |
| `src/lib/ultaura/accounts.ts` | Expose plan/trial helpers and reset Health consent/reminders when `upgradeSelfToFamilyMode` changes a line from self-managed to family-managed |
| `src/lib/ultaura/plan-features.ts` | Add Health entitlement metadata for locked landing / plan messaging |
| `src/lib/ultaura/insights.ts` | Ensure reminder-call aggregation does not leak Health-linked reminder data and family-facing insights / weekly-summary readers honor Health private-disclosure suppression |
| `src/lib/ultaura/usage.ts` | Ensure usage/summary surfaces do not leak Health-linked reminder counts or labels |
| `src/app/dashboard/(app)/insights/components/CallMetrics.tsx` | Prevent reminder-call counts or labels from exposing Health-linked reminder behavior |
| `src/lib/ultaura/call-utils.ts` | Prevent Health-linked reminder call labels from surfacing through generic call-history formatting |
| `src/app/dashboard/(app)/lines/[lineId]/components/CallActivityList.tsx` | Prevent Health-linked reminder call labels from leaking in line activity history |
| `src/lib/ultaura/lines.ts` | Wire explicit Health document/blob cleanup and any line-deletion invalidation behavior needed beyond DB cascades |
| `src/lib/server/user/delete-user.ts` | Ensure full user deletion triggers centralized Health cleanup/invalidation and cannot bypass export/document invalidation |
| `src/lib/server/organizations/delete-organization.ts` | Ensure full organization deletion triggers Health document/blob cleanup and export invalidation where needed |
| `src/lib/ultaura/admin/timeline-aggregator.ts` | Prevent Health-bearing export metadata or other Health-only artifacts from surfacing on admin timelines by default |
| `src/lib/ultaura/admin/timeline-redaction.ts` | Omit Health-linked reminder/export artifacts entirely by default; only generic non-Health-safe timeline items may pass through redaction when omission is impossible |
| `src/app/admin/organizations/[uid]/actions.server.ts` | Update canonical owner primitive when admin ownership transfer is intended to change the Health owner |
| `src/lib/organizations/actions.ts` | Update user-facing ownership-transfer flows so Health ownership changes only when `created_by_user_id` is updated intentionally |
| `src/lib/memberships/mutations.ts` | Ensure membership-transfer mutations that change canonical ownership also update `created_by_user_id` before Health launch |
| `src/lib/ultaura/alerts.ts` | Ensure Health private-disclosure suppression and owner-only Health semantics are respected by app-side alert reads |
| `src/lib/ultaura/alert-fanout.ts` | Enforce approved-audience recipient resolution so Health privacy suppression cannot leak through generic alert fanout |
| `src/lib/ultaura/alerts-redaction.ts` | Redact/omit Health-derived alert content in shared alert rendering helpers |
| `src/lib/ultaura/sharing-gate.ts` | Apply Health private-disclosure and family-output suppression rules where existing sharing-tier helpers are reused by alert/summary readers |
| `src/app/dashboard/(app)/alerts/AlertsPageClient.tsx` | Prevent Health-related alert surfaces from leaking beyond the approved audiences |
| `src/components/ultaura/InProgressCallBanner.tsx` | Prevent in-progress call UI from leaking Health-linked reminder/call labels through generic call surfaces |

### 6.5 Internal App API Routes

| File | Change |
|---|---|
| `src/app/api/telephony/health/context/route.ts` (NEW) | Internal authenticated route returning compact Health call context for telephony |
| `src/app/api/telephony/health/suggestions/route.ts` (NEW) | Internal authenticated route for queueing structured Health suggestion candidates |
| `src/app/api/telephony/health/notices/delivered/route.ts` (NEW) | Internal authenticated route to mark a pending Health call notice as delivered after it was actually spoken |
| `src/app/api/health/autocomplete/conditions/route.ts` (NEW) | Canonical owner-authenticated server-side condition autocomplete wrapper |
| `src/app/api/health/autocomplete/medications/route.ts` (NEW) | Canonical owner-authenticated server-side medication autocomplete wrapper |
| `src/app/api/health/documents/upload/route.ts` (NEW) | Owner-authenticated encrypted upload/finalize endpoint |
| `src/app/api/health/documents/[documentId]/access-token/route.ts` (NEW) | Owner-authenticated short-lived token issuance route for preview/download actions |
| `src/app/api/health/documents/[documentId]/preview/route.ts` (NEW) | Owner-authenticated, tokenized decrypt-and-stream preview endpoint |
| `src/app/api/health/documents/[documentId]/download/route.ts` (NEW) | Owner-authenticated, tokenized decrypt-and-stream download endpoint |
| `src/app/api/privacy/exports/[requestId]/download/route.ts` (NEW) | Canonical owner-authenticated ZIP download route for Health-bearing exports without persisted raw storage links |
| `src/app/api/privacy/exports/[requestId]/health-bundle/route.ts` (NEW) | Internal authenticated route returning typed Health manifest data plus internal document-byte paths to the export writer |
| `src/app/api/privacy/exports/[requestId]/health-document-bytes/[documentId]/route.ts` (NEW) | Internal authenticated streaming route that returns decrypted Health document bytes for export composition only |

### 6.6 Telephony and Prompting

| File | Change |
|---|---|
| `packages/prompts/src/profiles/index.ts` | Inject Health context only when granted and only from the internal Health context contract |
| `packages/prompts/src/golden/sections/health-consent.ts` (NEW) | Spoken Health consent instructions for family-managed lines |
| `packages/prompts/src/golden/sections/health-wellness.ts` | Tighten symptom-vs-Health Profile boundaries and private-disclosure suppression guidance |
| `packages/prompts/src/golden/sections/privacy-policy.ts` | Align privacy-request phrasing with the Health private-disclosure rule |
| `packages/prompts/src/golden/sections/insights.ts` | Prevent private Health disclosures from reappearing in call-insights concern/follow-up prompting |
| `packages/prompts/src/golden/sections/tool-policy.ts` | Ensure Health privacy tooling is routed correctly and does not conflict with older generic privacy instructions |
| `packages/prompts/src/tools/definitions.ts` | Add Health suggestion candidate tool and private-disclosure suppression tool definitions |
| `telephony/src/services/health-context.ts` (NEW) | Thin client for fetching Health call context from the app internal API |
| `telephony/src/services/health-suggestions.ts` (NEW) | Thin client for submitting Health suggestion candidates to the app internal API |
| `telephony/src/services/health-privacy-state.ts` (NEW) | Call-local suppression state for health disclosures marked private by the senior |
| `telephony/src/services/insights.ts` | Suppress private Health disclosures from concern/follow-up generation that would otherwise surface to family |
| `telephony/src/services/weekly-summary.ts` | Suppress private Health disclosures from weekly summary concern/follow-up content unless urgent safety applies |
| `telephony/src/services/wellness-alerts.ts` | Respect the new Health private-disclosure suppression state before generating health-mention alerts |
| `telephony/src/services/call-session.ts` | Ensure post-call processing respects Health suppression, suggestion, and notice state |
| `telephony/src/services/line-encryption.ts` | Force/create line DEKs for Health and forbid account-DEK fallback for Health Profile data |
| `telephony/src/websocket/media-stream.ts` | Extend runtime prompt/session assembly for Health consent, Health context, and in-call consent transitions |
| `telephony/src/websocket/grok-bridge.ts` | Register and route Health-related tool invocations in the realtime bridge |
| `telephony/src/routes/tools/voice-consent.ts` | Extend spoken consent tooling with `grant_health_consent`, `deny_health_consent`, and `revoke_health_consent` for family-managed Health consent states |
| `telephony/src/routes/tools/queue-health-suggestion.ts` (NEW) | Telephony tool endpoint that validates session/line and forwards suggestion candidates to the app API |
| `telephony/src/routes/tools/mark-health-disclosure-private.ts` (NEW) | Telephony tool endpoint that marks current-call health disclosure state as private |
| `telephony/src/routes/tools/mark-topic-private.ts` | Route generic topic privacy requests into durable Health suppression when the disclosure is health-adjacent |
| `telephony/src/routes/tools/mark-private.ts` | Route generic privacy requests into durable Health suppression when the disclosure is health-adjacent |
| `telephony/src/routes/tools/log-health-mention.ts` | Check call-local private-disclosure suppression before persisting alertable health mentions |
| `telephony/src/routes/tools/log-call-insights.ts` | Respect Health private-disclosure suppression when logging call concerns/follow-up reasons |
| `telephony/src/routes/tools/set-reminder.ts` | Enforce source-context classification and fail-closed behavior so Health-linked reminders cannot flow through generic plaintext fallback paths |
| `telephony/src/routes/tools/list-reminders.ts` | Exclude Health-linked reminders from generic voice reminder listing behavior |
| `telephony/src/routes/tools/pause-reminder.ts` | Block mutation of Health-linked reminders through generic voice reminder tools |
| `telephony/src/routes/tools/resume-reminder.ts` | Block mutation of Health-linked reminders through generic voice reminder tools |
| `telephony/src/routes/tools/cancel-reminder.ts` | Block mutation of Health-linked reminders through generic voice reminder tools |
| `telephony/src/routes/tools/edit-reminder.ts` | Block mutation of Health-linked reminders through generic voice reminder tools |
| `telephony/src/routes/tools/snooze-reminder.ts` | Block mutation of Health-linked reminders through generic voice snooze flows |
| `telephony/src/routes/tools/reminder-tool-helpers.ts` | Centralize source-context filtering and fail-closed guardrails so all generic reminder tools enforce the same Health exclusion behavior |
| `telephony/src/routes/tools/index.ts` | Register new Health tool routes |
| `telephony/src/utils/event-sanitizer.ts` | Add allowlists for new Health tools and ensure no sensitive Health payload fields survive event logging |
| `telephony/src/services/topic-exclusions.ts` | Reuse deterministic `health_medical` classification as the non-LLM backstop for Health private-disclosure routing |
| `telephony/src/utils/logger.ts` | Add explicit Pino redaction keys for Health payload fields and internal token/path metadata |
| `telephony/src/observability/tracing.ts` | Add OTel attribute redaction for Health payload fields and internal doc/export path metadata |
| `src/core/logger.ts` | Add app-side structured-log redaction for Health payload fields and tokenized document/export internals |
| `src/core/sentry/capture-api-exception.ts` | Ensure exception capture redacts Health payload fields and tokenized document/export internals before reporting |
| `telephony/src/scheduler/call-scheduler.ts` | Re-check consent/eligibility before scheduling or dispatching Health-linked reminder calls |
| `telephony/src/routes/internal/exports.ts` | Register and authorize the internal Health export helper routes used during ZIP composition |
| `telephony/src/scheduler/recording-deletion.ts` | Intentionally own v1 Health export expiry plus stale document-upload, failed-document, and expired document-token cleanup until a dedicated lifecycle scheduler is approved |
| `src/app/api/telephony/wellness-alerts/route.ts` | Respect Health private-disclosure suppression and approved urgent-safety audiences on final alert delivery |
| `src/app/api/telephony/weekly-summary/route.ts` | Enforce Health private-disclosure suppression and approved recipient filtering at the weekly-summary delivery route |

### 6.7 Marketing / Packaging / Launch Copy

| File | Change |
|---|---|
| `src/app/(site)/faq/faq-data.ts` | Update plan availability and any Health-related public copy |
| `src/lib/ultaura/plan-features.ts` | Ensure Health entitlement copy is consistent |
| `src/app/(site)/pricing/page.tsx` or plan-rendering dependencies | Update public entitlements if Health is surfaced there |
| `src/app/(site)/privacy/page.tsx` | Review and update public privacy copy if Health storage/consent language is surfaced there |
| `src/app/(site)/terms/page.tsx` | Review and update product/consent wording if Health is mentioned pre-launch |

### 6.8 Tests

| File | Change |
|---|---|
| `src/lib/ultaura/__tests__/health-access.test.ts` (NEW) | Owner-only access, viewer denial, plan gating, and ownership-transfer source-of-truth behavior |
| `src/lib/ultaura/__tests__/health-consent.test.ts` (NEW) | Consent state transitions, request cooldown, self vs family flows, and self-to-family reset behavior |
| `src/lib/ultaura/__tests__/health-consent-history.test.ts` (NEW) | Owner-only Health consent history preview/read behavior and broad-surface exclusion checks |
| `src/lib/ultaura/__tests__/health-suggestions.test.ts` (NEW) | Dedupe, stale invalidation, merge/update, privacy suppression |
| `src/lib/ultaura/__tests__/health-reminders.test.ts` (NEW) | Linkage, pause/cancel/manual resume, first-grant pause behavior, and generic surface redaction |
| `src/lib/ultaura/__tests__/health-documents.test.ts` (NEW) | Upload state, metadata encryption, access token, stale upload cleanup, and logging minimization |
| `src/lib/ultaura/__tests__/health-export.test.ts` (NEW) | Manifest/ZIP composition, owner-only download auth, duplicate filename handling, and Health artifact expiry |
| `src/lib/ultaura/__tests__/health-call-notices.test.ts` (NEW) | Notice payload generation, live-language spoken text generation, dedupe, and delivery acknowledgement |
| `src/lib/ultaura/__tests__/health-feature-flag.test.ts` (NEW) | DB-backed kill switch with env fallback across nav, routes, and telephony Health gating |
| `src/lib/ultaura/__tests__/health-observations.test.ts` (NEW) | Pre-consent isolation and prompt subset selection |
| `src/app/api/__tests__/search-health-reminder-redaction.test.ts` (NEW) | Ensures dashboard search does not leak Health-linked reminder content |
| `telephony/src/services/__tests__/health-context.test.ts` (NEW) | Context loading, consent gating, pending verbal notice inclusion |
| `telephony/src/services/__tests__/health-privacy-suppression.test.ts` (NEW) | Same-call suppression for persisted health mentions, insights, and weekly summary paths |
| `telephony/src/scheduler/__tests__/health-document-lifecycle.test.ts` (NEW) | Stale uploads, failed uploads, expired document tokens, and Health export expiry cleanup |
| `telephony/src/routes/tools/__tests__/health-tools.test.ts` (NEW) | Tool validation, suppression path, suggestion candidate forwarding |
| `telephony/src/routes/tools/__tests__/voice-consent-health.test.ts` (NEW) | Spoken Health consent capture for family-managed lines |
| `telephony/src/routes/tools/__tests__/set-reminder-health-guard.test.ts` (NEW) | Ensures generic voice reminder creation paths cannot create Health-linked rows or plaintext fallback records |
| `telephony/src/routes/tools/__tests__/list-reminders-health-filter.test.ts` (NEW) | Ensures generic voice reminder tools exclude Health-linked reminders |
| `telephony/src/services/__tests__/wellness-alerts-health-suppression.test.ts` (NEW) | Private-disclosure suppression against health-mention alerts |
| `telephony/src/observability/__tests__/tracing-pii-redaction.test.ts` | Verifies Health payload/token/path values are redacted from OTel span attributes |
| `telephony/src/utils/__tests__/logger-health-redaction.test.ts` (NEW) | Verifies Health payload/token/path values are redacted from structured logs |
| `src/lib/ultaura/__tests__/health-alert-fanout.test.ts` (NEW) | Trusted-contact exclusion and approved audience rules for Health-related delivery paths |
| `cypress/e2e/dashboard/health-profile.cy.ts` (NEW) | Health dashboard flow, locked state, multi-line switching, mobile behavior, viewer denial |

---

## 7. Database Changes

### 7.1 Design Rules

These rules are intentional and should not be relaxed during implementation:

1. Health tables must be owner-only by RLS unless a table is explicitly designated internal-only service-managed in this spec (for example document access logs/tokens); app-only filtering is never sufficient.
2. Sensitive Health payloads must use app-layer per-line encryption with AES-256-GCM and line DEKs; Health must provision a line DEK if one does not already exist.
3. Plaintext columns are allowed only when they are needed for routing, lifecycle state, or server-side filtering that does not leak Health content beyond owner-only/internal-only bounds.
4. Because Health datasets are line-scoped and expected to be small in v1, owner-facing filtering/sorting may decrypt line-scoped rows in server code instead of denormalizing extra plaintext fields.
5. Storage objects for documents must use opaque, random object keys that do not reveal document type, title, or line name.
6. Any table that redundantly stores both `account_id` and `line_id` alongside referenced parent rows must enforce account/line consistency through triggers or equivalent invariant checks.
   This applies to Health consent, Health consent history, conditions, medications, suggestions, observations, documents, document access logs, call notices, and medication-reminder links.
7. Internal/service-role access to owner-only Health rows is allowed only for explicit system jobs such as telephony context fetch, document streaming, export processing, deletion cleanup, and owner-only admin-safe redaction pipelines.
8. Internal routes must still apply explicit owner checks or internal-secret checks at the application layer; service-role credentials alone are not sufficient authorization.
9. Ordinary application and telephony logs must exclude decrypted Health metadata, document titles/filenames, `summaryParaphrase`, and `ownerSafeSummary`.
10. The foundation migration must declare explicit `CREATE POLICY` statements for every Health table in scope; "apply owner-only RLS" is not sufficient without concrete policy DDL.
11. The foundation migration must include one reusable trigger function for redundant `account_id` + `line_id` consistency and attach it to every applicable Health table listed in Rule 6.
12. Service-role access must be procedural and allowlisted: only named internal routes/jobs may use it, and each such path must enforce internal-secret auth plus explicit job-purpose checks before any Health row read/write.
13. Health owner-only enforcement is launch-ready only when RLS, app service checks, and route guards all use the same canonical-owner predicate (`created_by_user_id`) and all three layers are verified in tests.

### 7.1A Required Account/Line Consistency Trigger Coverage

The migration must attach account/line consistency triggers for each of these tables:

- `ultaura_health_line_consent`
- `ultaura_health_consent_history`
- `ultaura_health_conditions`
- `ultaura_health_medications`
- `ultaura_health_suggestions`
- `ultaura_health_item_history`
- `ultaura_health_observations`
- `ultaura_health_documents`
- `ultaura_health_document_access_log`
- `ultaura_health_document_access_tokens`
- `ultaura_health_call_notices`
- `ultaura_health_medication_reminders`

Trigger behavior requirements:

- `line_id` must belong to `account_id` through `ultaura_lines`.
- For cross-row links (`medication_id`, `reminder_id`, `document_id`, `similar_item_id`, `resulting_item_id`), referenced rows must resolve to the same account and line.
- Violations must raise errors at write time (`insert`/`update`) and fail closed.

### 7.1B Runtime Feature Flag Table

Health launch requires a DB-backed runtime kill switch with env fallback.

```sql
create table if not exists ultaura_runtime_feature_flags (
  flag_key text primary key,
  enabled boolean not null,
  updated_at timestamptz not null default now()
);

alter table ultaura_runtime_feature_flags enable row level security;

create or replace function is_runtime_feature_enabled(target_flag_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select enabled
     from ultaura_runtime_feature_flags
     where flag_key = target_flag_key),
    false
  );
$$;
```

Rules:

- The required v1 row key is `health_profile`.
- The foundation migration must seed `ultaura_runtime_feature_flags(flag_key = 'health_profile', enabled = false)` so the feature fails closed by default.
- Application helpers must read the DB row first through `is_runtime_feature_enabled('health_profile')` or an equivalent server-only helper and fall back to env only when the row/helper is unavailable.
- The env fallback key is `HEALTH_PROFILE_ENABLED`.
- If both the DB row and env fallback are unavailable, Health remains disabled.
- If the DB row exists, it is the source of truth and wins over the env fallback.
- Operational control in v1 is explicit:
  - normal enable/disable path = update the `ultaura_runtime_feature_flags.health_profile` row
  - emergency fallback = `HEALTH_PROFILE_ENABLED`
  - launch runbook must name the owning team/person for flipping the DB row and the emergency env fallback
- Direct browser/client mutation of `ultaura_runtime_feature_flags` is forbidden; only service-role/admin-operational paths may change the row.
- Direct browser/client reads of `ultaura_runtime_feature_flags` are also forbidden in v1.
- No authenticated/anon table policies are exposed for `ultaura_runtime_feature_flags`; browser-facing code must never query this table directly.
- The kill switch must fail closed for:
  - Health nav visibility
  - Health page/route access
  - Health API routes
  - telephony Health context fetch
  - Health suggestion submission
  - Health-linked reminder delivery

### 7.2 Create Owner-Only Health Consent Tables

Health consent must not be stored on `ultaura_line_voice_consent` or logged in detailed form through `ultaura_consent_audit_log`, because those surfaces are broader than owner-only Health access.

New enum:

```sql
create type ultaura_health_consent_status as enum (
  'not_requested',
  'granted',
  'denied',
  'revoked'
);

create type ultaura_health_consent_event_type as enum (
  'owner_request',
  'spoken_prompt',
  'spoken_decision',
  'self_service_decision'
);
```

Current-state table:

```sql
create table if not exists ultaura_health_line_consent (
  line_id uuid primary key references ultaura_lines(id) on delete cascade,
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  health_consent ultaura_health_consent_status not null default 'not_requested',
  health_consent_requested_at timestamptz,
  health_first_consent_requested_at timestamptz,
  health_last_prompted_at timestamptz,
  health_last_prompt_call_session_id uuid references ultaura_call_sessions(id),
  self_explanation_requested_at timestamptz,
  self_explanation_last_prompted_at timestamptz,
  self_explanation_last_prompt_call_session_id uuid references ultaura_call_sessions(id),
  health_consent_at timestamptz,
  health_consent_call_session_id uuid references ultaura_call_sessions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

History table:

```sql
create table if not exists ultaura_health_consent_history (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  event_type ultaura_health_consent_event_type not null,
  resulting_status ultaura_health_consent_status,
  actor_user_id uuid references public.users(id),
  call_session_id uuid references ultaura_call_sessions(id),
  created_at timestamptz not null default now(),
  payload_ciphertext bytea not null,
  payload_iv bytea not null,
  payload_tag bytea not null,
  payload_alg text not null default 'aes-256-gcm',
  payload_kid text
);
```

Indexes:

```sql
create index if not exists idx_health_line_consent_status
  on ultaura_health_line_consent(health_consent)
  where health_consent != 'not_requested';

create index if not exists idx_health_line_consent_requested_at
  on ultaura_health_line_consent(health_consent_requested_at)
  where health_consent_requested_at is not null;

create index if not exists idx_health_line_consent_prompted_at
  on ultaura_health_line_consent(health_last_prompted_at)
  where health_last_prompted_at is not null;

create index if not exists idx_health_consent_history_line_created_at
  on ultaura_health_consent_history(line_id, created_at desc);
```

Behavior notes:

- `health_consent_requested_at` is the most recent owner-requested re-prompt timestamp.
- `health_first_consent_requested_at` is write-once and supports the success metric.
- `health_last_prompted_at` is the most recent moment Ultaura actually asked the senior during a call.
- `health_last_prompt_call_session_id` records which call most recently spoke the Health consent prompt.
- `self_explanation_requested_at` is the owner-requested timestamp for the optional self-managed spoken explanation path.
- `self_explanation_last_prompted_at` records when that optional self-managed explanation was actually spoken.
- `self_explanation_last_prompt_call_session_id` records the call where the optional self-managed explanation was spoken.
- Detailed Health consent history lives only in `ultaura_health_consent_history`.
- `ultaura_consent_audit_log` is not used for detailed Health consent history in v1.
- If broader retained compliance logging is later required, it must be generic and non-Health-specific.
- No `pending` Health state is introduced.
- Consent history payloads must validate against `HealthConsentHistoryPayload`.
- The foundation migration must backfill one `ultaura_health_line_consent` row per existing line with `health_consent = 'not_requested'` using idempotent `insert ... on conflict do nothing`.
- New line creation must create the corresponding `ultaura_health_line_consent` row automatically through a database trigger matching the existing voice-consent pattern, not app-only logic.
- Self-managed lines must never persist `health_consent = 'denied'`; enforce this with a DB trigger and service-layer checks.

Required state-enforcement trigger:

```sql
create or replace function enforce_health_consent_line_type_rules()
returns trigger
language plpgsql
as $$
declare
  account_user_type text;
begin
  select a.user_type into account_user_type
  from ultaura_lines l
  join ultaura_accounts a on a.id = l.account_id
  where l.id = new.line_id;

  if account_user_type is null then
    raise exception 'health consent trigger could not resolve account user_type for line %', new.line_id;
  end if;

  if account_user_type = 'self' and new.health_consent = 'denied' then
    raise exception 'self-managed lines cannot use denied health consent state';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_health_consent_line_type_rules on ultaura_health_line_consent;
create trigger trg_enforce_health_consent_line_type_rules
before insert or update on ultaura_health_line_consent
for each row execute function enforce_health_consent_line_type_rules();
```

### 7.3 New Account-Level Health State Table

Create one account-scoped owner-only table for disclaimer acknowledgement and first Health visit tracking.

```sql
create table if not exists ultaura_health_account_state (
  account_id uuid primary key references ultaura_accounts(id) on delete cascade,
  disclaimer_acknowledged_at timestamptz,
  disclaimer_acknowledged_by uuid references public.users(id),
  disclaimer_version text,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  first_item_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Why account-scoped:

- the disclaimer is feature-level, not per-line content
- the canonical Health owner is already account-scoped via `created_by_user_id`
- this avoids re-acknowledging on every line
- this is a feature-entry UX/state decision, not a line-scoped consent rule; line-scoped Health consent and reminder behavior remain unchanged

Ownership rule:

- if the canonical owner primitive changes, the new owner is treated as a fresh Health owner for disclaimer acknowledgement purposes
- owner-experience account-state metrics (`first_viewed_at`, `last_viewed_at`, `first_item_created_at`) also reset on canonical owner change because they describe the current owner's Health onboarding/usage, not the prior owner's behavior
- `disclaimer_version` must be compared against a single server-side source of truth (for example `HEALTH_PROFILE_DISCLAIMER_VERSION`) so "material policy/behavior change" is version-driven, not ad hoc UI logic
- a material policy/behavior change is any server-side disclaimer-version bump that invalidates the previously acknowledged version for that account
- `first_viewed_at` and `last_viewed_at` together anchor the return-usage success metric
- `first_item_created_at` anchors the activation success metric for "created at least one condition or medication within 30 days"

### 7.4 New Owner-Only Helper Functions

Create explicit owner-only helpers instead of reusing `can_access_ultaura_account(account_id)`.

Required helpers:

```sql
create or replace function is_ultaura_account_owner(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from ultaura_accounts a
    where a.id = target_account_id
      and a.created_by_user_id = auth.uid()
  );
$$;

create or replace function can_access_ultaura_health_line(target_line_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from ultaura_lines l
    join ultaura_accounts a on a.id = l.account_id
    where l.id = target_line_id
      and a.created_by_user_id = auth.uid()
  );
$$;
```

Rules:

- `is_ultaura_account_owner` returns true only when `ultaura_accounts.created_by_user_id = auth.uid()`
- `can_access_ultaura_health_line` joins through `ultaura_lines` and the owning account
- all Health table policies must use these helpers for every operation that table explicitly permits

### 7.4A Required Owner-Only RLS Policy Baseline

The foundation migration must include explicit owner-only policies for each new Health table. Use `security definer` helper functions with fixed `search_path` and do not rely on app-side filtering as a substitute.

Policy class 1: owner-readable current-state tables.

Use this pattern for line-scoped current-state tables that owners may read directly but must not mutate directly from browser-authenticated clients:

- `ultaura_health_line_consent`
- `ultaura_health_conditions`
- `ultaura_health_medications`
- `ultaura_health_suggestions`
- `ultaura_health_observations`
- `ultaura_health_documents`
- `ultaura_health_medication_reminders`

```sql
alter table <table_name> enable row level security;

create policy <table_name>_owner_select
  on <table_name> for select
  using (is_ultaura_account_owner(account_id) and can_access_ultaura_health_line(line_id));

-- Intentionally no owner insert/update/delete policies.
```

Policy class 2: owner-readable history/audit tables.

These tables are user-visible history/audit surfaces and must not be directly owner-written or owner-mutated:

- `ultaura_health_consent_history`
- `ultaura_health_item_history`

```sql
alter table <table_name> enable row level security;

create policy <table_name>_owner_select
  on <table_name> for select
  using (is_ultaura_account_owner(account_id) and can_access_ultaura_health_line(line_id));

-- Intentionally no owner insert/update/delete policies.
```

Policy class 3: service-managed lifecycle tables.

- `ultaura_health_document_access_tokens` is internal-only and should not expose owner direct table policies.
- `ultaura_health_document_access_log` is internal-only security logging and should not expose owner direct table policies in v1.
- `ultaura_health_call_notices` is service-managed for lifecycle transitions; owner access is read-only.

```sql
alter table ultaura_health_call_notices enable row level security;

create policy health_call_notices_owner_select
  on ultaura_health_call_notices for select
  using (is_ultaura_account_owner(account_id) and can_access_ultaura_health_line(line_id));

-- Intentionally no owner insert/update/delete policies.
```

Account-scoped owner-only table policy pattern:

```sql
alter table ultaura_health_account_state enable row level security;

create policy health_account_state_owner_select
  on ultaura_health_account_state for select
  using (is_ultaura_account_owner(account_id));

-- Intentionally no direct owner insert/update/delete policies.
```

Export table policy hardening (dual-mode rows):

```sql
drop policy if exists "Users can view export requests for their accounts"
  on ultaura_data_export_requests;
drop policy if exists "Users can insert export requests for their accounts"
  on ultaura_data_export_requests;
drop policy if exists export_requests_health_owner_select
  on ultaura_data_export_requests;
drop policy if exists export_requests_health_owner_insert
  on ultaura_data_export_requests;
drop policy if exists export_requests_standard_member_insert
  on ultaura_data_export_requests;
drop policy if exists export_requests_health_owner_update
  on ultaura_data_export_requests;
drop policy if exists export_requests_health_owner_delete
  on ultaura_data_export_requests;

create policy export_requests_health_owner_select
  on ultaura_data_export_requests for select
  using (
    (
      visibility_scope = 'standard_account'
      and can_access_ultaura_account(account_id)
    ) or (
      visibility_scope = 'health_owner_only'
      and is_ultaura_account_owner(account_id)
    )
  );

create policy export_requests_standard_member_insert
  on ultaura_data_export_requests for insert
  with check (
    visibility_scope = 'standard_account'
    and can_access_ultaura_account(account_id)
    and coalesce(includes_health_profile, false) = false
  );

create policy export_requests_health_owner_insert
  on ultaura_data_export_requests for insert
  with check (
    visibility_scope = 'health_owner_only'
    and includes_health_profile = true
    and is_ultaura_account_owner(account_id)
  );
```

Rules:

- Health-bearing export creation is owner-only at policy level: no member insert policy may allow a `health_owner_only` row.
- Standard (non-Health) export creation may continue to use broader account-member insert behavior.
- Canonical owners may create export requests but may not mutate or delete existing export request rows.
- Export request lifecycle mutation (`status`, artifact metadata, invalidation, cleanup markers) is service-owned only.
- Browser-authenticated clients must not write Health current-state, history, audit, or account-state tables directly in v1; all such writes must go through authenticated server actions/routes/services that re-check canonical owner, enforce encryption discipline, maintain history, and apply the documented lifecycle rules.
- User-visible Health history tables (`consent_history`, `item_history`) are read-only to owners at the table-policy layer; only service-mediated writes may append them.
- Internal-only security/lifecycle tables (`document_access_log`, `document_access_tokens`, `call_notices`) are service-managed and must not expose direct owner table policies unless explicitly called out elsewhere in this spec.
- Soft-delete current-state tables (`conditions`, `medications`, `observations`, reminder-link rows) must not expose direct owner `DELETE`; service-mediated delete flows must translate owner delete intents into the documented soft-delete lifecycle.

### 7.5 Shared Encrypted Payload Shape

For Health tables that store sensitive content, use one encrypted payload shape:

```sql
payload_ciphertext bytea not null,
payload_iv bytea not null,
payload_tag bytea not null,
payload_alg text not null default 'aes-256-gcm',
payload_kid text
```

The decrypted payload is JSON and validated in application code against shared Health schemas.

### 7.6 Conditions Table

```sql
create type ultaura_health_condition_status as enum ('active', 'monitoring', 'resolved');

create table if not exists ultaura_health_conditions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  status ultaura_health_condition_status not null,
  source text not null check (source in ('owner_manual', 'suggestion_approved')),
  created_by_user_id uuid references public.users(id), -- nullable only for legacy/system repair paths; owner-authored writes must populate
  updated_by_user_id uuid references public.users(id), -- nullable only for legacy/system repair paths; owner-authored edits must populate
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload_ciphertext bytea not null,
  payload_iv bytea not null,
  payload_tag bytea not null,
  payload_alg text not null default 'aes-256-gcm',
  payload_kid text
);
```

Encrypted payload contract:

```ts
type StoredConditionPayload = {
  name: string;
  standardizedId: { system: string; code: string } | null;
  diagnosedOnsetDate: ApproximateDate | null;
  stageSeverity: string | null;
  treatingClinician: string | null;
  notes: string | null;
};
```

Required indexes:

- `(line_id, status, created_at desc)` where `deleted_at is null`
- `(line_id, deleted_at)`
- `(account_id, deleted_at)`

Actor-column rule for structured owner-managed tables (`conditions`, `medications`, `observations`, `documents`):

- `created_by_user_id` is required for owner-authored dashboard writes and suggestion approvals.
- `updated_by_user_id` is required for owner-authored edits after creation.
- null actor ids are allowed only for legacy backfill, system repair, or storage-lifecycle jobs that do not have a human actor.
- The DB columns remain nullable only to permit those controlled non-owner/system paths; owner-authored inserts/updates must fail closed in app/service logic if the required actor id is missing.

### 7.7 Medications Table

```sql
create type ultaura_health_medication_status as enum ('current', 'as_needed', 'discontinued');

create table if not exists ultaura_health_medications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  linked_condition_id uuid references ultaura_health_conditions(id) on delete set null,
  status ultaura_health_medication_status not null,
  source text not null check (source in ('owner_manual', 'suggestion_approved')),
  created_by_user_id uuid references public.users(id), -- nullable only for legacy/system repair paths; owner-authored writes must populate
  updated_by_user_id uuid references public.users(id), -- nullable only for legacy/system repair paths; owner-authored edits must populate
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload_ciphertext bytea not null,
  payload_iv bytea not null,
  payload_tag bytea not null,
  payload_alg text not null default 'aes-256-gcm',
  payload_kid text
);
```

Required indexes:

- `(line_id, status, created_at desc)` where `deleted_at is null`
- `(line_id, deleted_at)`
- `(account_id, deleted_at)`

Encrypted payload contract:

```ts
type StoredMedicationPayload = {
  name: string;
  standardizedId: { system: string; code: string } | null;
  dosage: string | null;
  frequency: string | null;
  timesOfDay: string[]; // canonical HH:MM 24-hour strings
  prescribedBy: string | null;
  startDate: ApproximateDate | null;
  endDate: ApproximateDate | null;
  linkedReason: string | null;
  notes: string | null;
};
```

### 7.8 Health Suggestions Table

```sql
create type ultaura_health_suggestion_type as enum ('condition', 'medication');
create type ultaura_health_suggestion_mode as enum ('new', 'update');
create type ultaura_health_suggestion_status as enum ('pending', 'approved', 'dismissed');
create type ultaura_health_suggestion_dismiss_reason as enum ('owner_dismissed', 'system_stale');
create type ultaura_health_suggestion_suppression_reason as enum ('owner_private_disclosure');

create table if not exists ultaura_health_suggestions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  suggestion_type ultaura_health_suggestion_type not null,
  suggestion_mode ultaura_health_suggestion_mode not null,
  status ultaura_health_suggestion_status not null default 'pending',
  dismiss_reason ultaura_health_suggestion_dismiss_reason,
  dedupe_key text not null,
  material_evidence_key text not null,
  similar_item_id uuid,
  resulting_item_id uuid,
  source_call_session_id uuid references ultaura_call_sessions(id),
  source_call_started_at timestamptz,
  reviewed_by_user_id uuid references public.users(id),
  reviewed_at timestamptz,
  suppressed_at timestamptz,
  suppression_reason ultaura_health_suggestion_suppression_reason,
  suppressed_by_call_session_id uuid references ultaura_call_sessions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload_ciphertext bytea not null,
  payload_iv bytea not null,
  payload_tag bytea not null,
  payload_alg text not null default 'aes-256-gcm',
  payload_kid text
);
```

Required indexes and invariants:

- unique partial index on `(line_id, dedupe_key)` where `status = 'pending' and suppressed_at is null`
- index on `(line_id, material_evidence_key, created_at desc)`
- trigger validation that any `similar_item_id` or `resulting_item_id` belongs to the same account and line
- `dedupe_key` must encode `suggestion_type`; agents must not rely on `normalizedName` alone

Encrypted payload contract:

```ts
type ConditionSuggestionProposedFields = {
  standardizedId: { system: string; code: string } | null;
  status?: 'active' | 'monitoring' | 'resolved';
  diagnosedOnsetDate?: ApproximateDate | null;
};

type MedicationSuggestionProposedFields = {
  standardizedId: { system: string; code: string } | null;
  status?: 'current' | 'as_needed' | 'discontinued';
  dosage?: string | null;
  frequency?: string | null;
  timesOfDay?: string[]; // canonical HH:MM 24-hour strings
  startDate?: ApproximateDate | null;
  endDate?: ApproximateDate | null;
};

type StoredHealthSuggestionPayload = {
  normalizedName: string;
  confidenceLabel: 'high' | 'medium';
  summaryParaphrase: string;
  proposedFields:
    | ConditionSuggestionProposedFields
    | MedicationSuggestionProposedFields;
  similarItemWarning: boolean;
};
```

Implementation rules:

- There is no `stale` user-facing status.
- Internal stale handling uses `status = 'dismissed'` plus `dismiss_reason = 'system_stale'`.
- Suppressed suggestions are not a user-facing status. They remain internal rows excluded from owner queue surfaces, badges, exports, and family-visible downstream processing.
- Raw transcript content is never stored in this table.
- `dedupe_key` must be an HMAC, not a plaintext health-derived string.
- `dedupe_key` must use an HKDF-derived HMAC subkey from the line DEK with info string `health-suggestion-dedupe-v1`.
- `dedupe_key` must be computed from `suggestion_type`, `suggestion_mode`, `normalizedName`, and target item identity:
  - `condition:new:<normalizedName>`
  - `condition:update:<normalizedName>:<similarItemId>`
  - `medication:new:<normalizedName>`
  - `medication:update:<normalizedName>:<similarItemId>`
- `material_evidence_key` must be an HMAC, not a plaintext health-derived string.
- `material_evidence_key` must use an HKDF-derived HMAC subkey from the line DEK with info string `health-suggestion-evidence-v1`.
- `material_evidence_key` must be computed from `suggestion_type`, `normalizedName`, and the canonicalized structured field delta that differs from the current stored item.
- `material_evidence_key` must ignore `summaryParaphrase` and other narrative-only text so dismissed suggestions reappear only on materially different structured evidence.
- Ordinary KEK/wrapping-key rotation must not change these HMAC outputs because the underlying line DEK remains stable.
- If a line DEK itself is ever regenerated for a line, suggestion/notices HMAC-backed keys for that line must be backfilled in the same maintenance flow before Health is re-enabled for that line; v1 must not silently accept long-term dedupe drift after DEK regeneration.
- `summaryParaphrase` received from telephony must be app-side sanitized before persistence; if sanitization cannot produce a quote-free, attribution-free single-sentence summary, the candidate must be blocked rather than persisted.
- Suggested structured fields must stay narrow and PRD-approved; the queue must not persist AI-authored notes blobs, clinician narrative, stage/severity narrative, or other open-ended review data beyond the single sanitized `summaryParaphrase`.
- If a same-call privacy request arrives after a suggestion row was already persisted, that row must be durably marked with `suppressed_at`, `suppression_reason = 'owner_private_disclosure'`, and `suppressed_by_call_session_id`.
- Suppressed suggestion rows must be excluded from queue reads, counts, exports, history surfaced to owners, and any downstream review workflow.

### 7.9 Observations Table

```sql
create type ultaura_health_observation_category as enum (
  'memory',
  'mood_emotional',
  'physical_mobility',
  'nutrition_eating',
  'sleep',
  'social_engagement',
  'medication_compliance',
  'general_other'
);

create type ultaura_health_observation_concern as enum ('note', 'mild_concern', 'significant_concern');

create table if not exists ultaura_health_observations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  created_by_user_id uuid references public.users(id), -- nullable only for legacy/system repair paths; owner-authored writes must populate
  updated_by_user_id uuid references public.users(id), -- nullable only for legacy/system repair paths; owner-authored edits must populate
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload_ciphertext bytea not null,
  payload_iv bytea not null,
  payload_tag bytea not null,
  payload_alg text not null default 'aes-256-gcm',
  payload_kid text
);
```

Encrypted payload contract:

```ts
type StoredObservationPayload = {
  text: string;
  category: HealthObservationCategory | null;
  observedDate: string | null; // defaults to today's date in the line timezone on create when omitted
  concernLevel: HealthObservationConcern | null;
};
```

Rules:

- `observedDate` defaults to the current local date in the line timezone, not the browser timezone or server timezone, when omitted on create.
- If the line timezone is null, invalid, or otherwise unavailable, `observedDate` defaulting falls back to UTC in v1.
- `observedDate` remains optional in v1 and has no automatic default when the owner explicitly clears it after creation.
- Call-context recency ranking for the 3-observation subset is line-scoped and deterministic: only non-deleted observations from the selected line participate.
- Call-context recency ranking for the 3-observation subset uses `coalesce(observedDate, createdAt::date)` desc, then `createdAt` desc, then `id` desc.
- Medication `timesOfDay` values are wall-clock local times in the line timezone for reminder scheduling and call context in v1.
- If the line timezone is null, invalid, or otherwise unavailable, `timesOfDay` interpretation falls back to UTC in v1 until a valid line timezone is present.
- If the line timezone changes later, existing `timesOfDay` values are re-interpreted in the new line timezone unless a future product revision introduces zone-bound medication scheduling.

Required indexes:

- `(line_id, created_at desc)` where `deleted_at is null`
- `(line_id, deleted_at)`
- `(account_id, deleted_at)`

### 7.10 Documents Table and Access Log

```sql
create type ultaura_health_document_status as enum ('uploading', 'active', 'failed');

create table if not exists ultaura_health_documents (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  storage_object_key text unique,
  mime_type text,
  file_extension text,
  file_size_bytes bigint,
  file_iv bytea,
  file_tag bytea,
  file_alg text default 'aes-256-gcm',
  file_kid text,
  status ultaura_health_document_status not null default 'uploading',
  uploaded_by_user_id uuid references public.users(id), -- nullable only for legacy/system repair paths; owner-authored uploads must populate
  updated_by_user_id uuid references public.users(id), -- nullable only for legacy/system repair paths; owner-authored edits must populate
  upload_failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload_ciphertext bytea not null,
  payload_iv bytea not null,
  payload_tag bytea not null,
  payload_alg text not null default 'aes-256-gcm',
  payload_kid text
);

create table if not exists ultaura_health_document_access_log (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  document_id uuid not null,
  actor_user_id uuid references public.users(id),
  action text not null check (action in ('preview', 'download')),
  was_successful boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists ultaura_health_document_access_tokens (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  document_id uuid not null references ultaura_health_documents(id) on delete cascade,
  actor_user_id uuid references public.users(id),
  action text not null check (action in ('preview', 'download')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
```

Storage contract:

- bucket name: `ultaura-health-documents`
- bucket privacy: private only
- public object access: forbidden
- object keys: opaque random values only
- object key format: `<uuidv4>.bin` with no line/account/title-derived prefixes
- stored object body: raw encrypted file ciphertext only
- file-level crypto metadata location: `file_iv`, `file_tag`, `file_alg`, `file_kid` on `ultaura_health_documents`
- direct browser-to-storage uploads: forbidden in v1
- the documents migration must create the `ultaura-health-documents` bucket before any upload route is enabled, using the same SQL-managed bucket-creation pattern already used elsewhere in the repo
- `storage.objects` policies for `ultaura-health-documents` must deny public reads and ordinary authenticated direct reads/writes; only service-role paths may read/write/delete objects in that bucket
- stored object metadata must never include decrypted title, notes, category labels, or original filenames; only opaque operational metadata needed for storage lifecycle is allowed
- application routes may stream decrypted content only after owner-authenticated access checks
- single-document owner delete hard-deletes both the storage object and the document row immediately
- document access logs survive single-document delete and are deleted only on line/full Health deletion
- access tokens do not survive document deletion, line deletion, full deletion, owner change, or locked-plan transition
- v1 upload allowlist is exact and fail-closed:
  - `application/pdf`
  - `image/jpeg`
  - `image/png`
  - `image/heic`
- maximum upload size is 25 MB per document
- extension and MIME type must both agree with the detected file signature/magic bytes
- access-log inserts must enforce account/line/document consistency at write time for active documents; no free-form document ids are allowed on insert
- access-log consistency must be DB-enforced with an insert trigger that validates `document_id` exists, is `status = 'active'`, and matches the incoming `account_id` + `line_id`; mismatches or missing documents must raise a deterministic error and reject the insert
- stale upload lifecycle in v1:
  - `uploading` rows older than 24 hours must be auto-marked `failed`
  - `failed` rows older than 30 days must be cleaned up with any orphaned blob bytes
- draft flow invariants:
  - `uploading` rows may exist before file storage metadata is available, but they must already contain the encrypted metadata payload (`payload_*`) and the owner-authored uploader/update ids
  - `active` rows must have non-null `storage_object_key`, `mime_type`, `file_extension`, `file_size_bytes`, `file_iv`, and `file_tag`
  - a DB check/trigger must reject any transition to `status = 'active'` unless those storage/encryption fields are all populated
  - a DB check/trigger must reject any insert/update where `status = 'uploading'` or `status = 'failed'` and the encrypted metadata payload is missing
- `telephony/src/scheduler/recording-deletion.ts` is the intentional v1 owner of stale document-upload cleanup, expired document-token cleanup, and Health export expiry until a dedicated lifecycle scheduler is approved

Encrypted document metadata payload:

```ts
type StoredDocumentPayload = {
  title: string;
  category: HealthDocumentCategory | null;
  documentDate: string | null;
  notes: string | null;
  originalFilename: string;
};
```

Required indexes:

- `(line_id, status, created_at desc)`
- `(account_id, status, created_at desc)`
- `(line_id, created_at desc)` on `ultaura_health_document_access_log`
- `(document_id, expires_at desc)` on `ultaura_health_document_access_tokens`
- `(expires_at)` on `ultaura_health_document_access_tokens` where `used_at is null` for token cleanup
- `(line_id, document_id, created_at desc)` on `ultaura_health_document_access_log` for internal security-audit read paths

Critical implementation rule:

- `storage_object_key` must be opaque and random.
- Health document preview/download cannot expose raw storage signed URLs for encrypted objects.
- The "signed access" requirement is satisfied by app-signed short-lived access tokens that back decrypt-and-stream routes.

### 7.11 Health Item History

```sql
create type ultaura_health_item_kind as enum ('condition', 'medication', 'document', 'observation', 'suggestion');
create type ultaura_health_item_action as enum (
  'created',
  'edited',
  'deleted',
  'suggestion_approved',
  'suggestion_dismissed',
  'system_stale_dismissed'
);
create type ultaura_health_actor_type as enum ('owner', 'system', 'telephony');

create table if not exists ultaura_health_item_history (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  item_kind ultaura_health_item_kind not null,
  item_id uuid,
  action ultaura_health_item_action not null,
  actor_type ultaura_health_actor_type not null,
  actor_user_id uuid references public.users(id),
  created_at timestamptz not null default now(),
  payload_ciphertext bytea not null,
  payload_iv bytea not null,
  payload_tag bytea not null,
  payload_alg text not null default 'aes-256-gcm',
  payload_kid text
);
```

Rules:

- User-facing history reads from this table.
- Document preview/download do not write here.
- Health delete actions write here before removing active visibility.
- History payloads must use an explicit discriminated union keyed by `item_kind` and `action`; they may not use open-ended blobs.
- Edit/history payloads must capture enough structured detail to explain what changed to an owner and to preserve meaningful export history:
  - conditions: name, status, onset date, stage/severity, treating clinician, notes
  - medications: name, status, dosage, frequency, `timesOfDay`, start/end date, prescriber, linked condition/reason, notes
  - observations: text, category, concern level, observed date
  - documents: title, category, document date, notes, original filename
- Edit actions must use explicit field-level before/after change entries rather than only shallow labels.
- `system_stale_dismissed` is an internal lifecycle action that must remain preserved in exported history and audit reads, but it must not appear as a separate user-facing queue status.

Required indexes:

- `(line_id, created_at desc)`
- `(account_id, created_at desc)`

### 7.12 Health-Linked Reminder Link Table

```sql
create table if not exists ultaura_health_medication_reminders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  medication_id uuid not null references ultaura_health_medications(id) on delete cascade,
  reminder_id uuid not null references ultaura_reminders(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists idx_health_medication_reminders_active_reminder
  on ultaura_health_medication_reminders(reminder_id)
  where deleted_at is null;
```

Extend `ultaura_reminders`:

```sql
create type ultaura_reminder_pause_source as enum (
  'manual',
  'health_manual_resume_required',
  'health_consent_not_requested',
  'health_consent_denied',
  'health_consent_revoked',
  'health_plan_ineligible'
);

alter table ultaura_reminders
  add column if not exists source_context text not null default 'general'
    check (source_context in ('general', 'health_profile')),
  add column if not exists pause_sources ultaura_reminder_pause_source[] not null default '{}';
```

Do not add a new reminder status enum for Health. Continue to use the existing reminder status enum and `is_paused` / `paused_at`.

Rules:

- `pause_sources` is the authoritative stacked pause-source model.
- `is_paused` must be true whenever `pause_sources` is non-empty.
- `pause_sources` must be canonicalized on every write: no nulls, no duplicates, and deterministic enum-order sorting.
- Manual pause and Health-system pause sources may coexist.
- `health_manual_resume_required` is the persisted hold source used when a Health-linked reminder must stay paused after a prior consent/plan/user-type blocker is cleared until the owner explicitly resumes it.
- When a consent/plan/user-type blocker is cleared but the reminder must remain paused pending owner action, the resolved blocker source is removed and `health_manual_resume_required` is added in the same write.
- Owner manual resume is the only action that may clear `health_manual_resume_required`.
- A reminder may resume only when its `pause_sources` array is fully cleared by the appropriate actor/rule.
- Pause/resume/cancel mutations must lock the target reminder row (`SELECT ... FOR UPDATE`) and recompute `pause_sources` from the latest stored value to avoid lost-update races.
- Concurrent source-clearing behavior must be deterministic: each actor clears only its own source(s), the resulting array is normalized, and reminder resume occurs only when the post-commit `pause_sources` array is empty.
- Add trigger validation so each medication-reminder link row matches the same account and line on both referenced parents.
- Add a DB check/trigger so `source_context = 'health_profile'` implies `delivery_method = 'outbound_call'`.
- Add a DB invariant so a reminder with `source_context = 'health_profile'` has exactly one active medication-link row, and a general reminder cannot be linked into Health.
- Because `ultaura_reminders` and `ultaura_reminder_events` are shared generic tables with broader existing account access patterns, `000002` must also add DB-enforced visibility protection so browser/member read paths outside canonical-owner Health surfaces cannot read rows/events where `source_context = 'health_profile'`.
- App filtering alone is insufficient for `ultaura_reminders` and `ultaura_reminder_events`; the migration must tighten the DB read model for Health-linked rows/events through policy changes, security-definer read paths, or equivalent DB-enforced isolation.
- All reminder mutation paths (dashboard services, DB RPC/update helpers, telephony tools, scheduler claim/delivery paths) must enforce these source-context invariants, not only Health UI paths.
- If a link is replaced, the old link row must first be soft-deleted (`deleted_at`) so the active-link partial unique index remains valid.
- Health reminder creates/updates must fail closed when encrypted reminder persistence cannot be guaranteed; generic plaintext reminder fallback is forbidden for `source_context = 'health_profile'`.
- Migration backfill must set `pause_sources = '{\"manual\"}'` for any existing paused generic reminder rows before the new trigger logic becomes authoritative.
- The migration must replace `enforce_reminder_limit()` so line-limit counting excludes only `source_context = 'health_profile' AND is_paused = true` rows while preserving existing counting behavior for all generic reminders.
- The migration must also update any live call / scheduler claim SQL so Health-linked reminders remain blocked when consent or eligibility no longer allows delivery.

Canonicalization trigger requirement:

```sql
create or replace function normalize_ultaura_reminder_pause_sources()
returns trigger
language plpgsql
as $$
begin
  new.pause_sources := coalesce(new.pause_sources, '{}');

  -- de-duplicate and sort for deterministic semantics
  new.pause_sources := (
    select coalesce(array_agg(distinct src order by src), '{}')
    from unnest(new.pause_sources) as src
  );

  new.is_paused := cardinality(new.pause_sources) > 0;
  return new;
end;
$$;
```

Reminder-limit SQL shape:

```sql
... where r.status = 'scheduled'
  and (
    r.source_context = 'general'
    or r.is_paused = false
  );
```

Interpretation:

- Generic reminders keep existing count semantics even when paused.
- Only paused Health-linked reminders are excluded from active-limit counts.

### 7.13 Pending Call Notices Table

```sql
create type ultaura_health_call_notice_type as enum ('consent_change', 'major_profile_change');
create type ultaura_health_call_notice_status as enum ('pending', 'delivered', 'superseded', 'canceled');

create table if not exists ultaura_health_call_notices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  notice_type ultaura_health_call_notice_type not null,
  status ultaura_health_call_notice_status not null default 'pending',
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delivered_at timestamptz,
  payload_ciphertext bytea not null,
  payload_iv bytea not null,
  payload_tag bytea not null,
  payload_alg text not null default 'aes-256-gcm',
  payload_kid text
);
```

Rules:

- Only one active pending `major_profile_change` notice per line should exist at a time.
- New qualifying changes should merge into the existing pending notice instead of stacking multiple notices.
- Pending call notices exist only for family-managed lines.
- `consent_change` notices are family-managed-only safe system notices and may still be delivered even when Health consent is not granted.
- `major_profile_change` notices are family-managed-only and are queued only after Health consent has been granted.
- Self-managed optional spoken explanation requests are not represented through `ultaura_health_call_notices`; they are represented by the dedicated self-managed explanation fields on `ultaura_health_line_consent`.
- Add a unique partial index enforcing one pending `major_profile_change` notice per line.
- Pending notices are canceled on line deletion, full deletion, or canonical owner change.
- Pending `major_profile_change` notices are also canceled if Health consent becomes denied/revoked or the plan becomes ineligible before delivery.
- Pending notices are superseded when a newer qualifying notice replaces an older undelivered one.
- Pending notices are marked delivered only after the notice was actually spoken in a successful call.
- Notice payloads must use an explicit discriminated union keyed by `notice_type`; they may not use open-ended blobs.
- `dedupe_key` must be an HMAC, not a plaintext health-derived string.
- `dedupe_key` for `consent_change` notices must be based on `line_id`, `notice_type`, and the effective consent status.
- `dedupe_key` for `major_profile_change` notices must be based on `line_id`, `notice_type`, and the sorted change-type set.
- `major_profile_change` change-type set is limited to:
  - `condition_added`
  - `condition_status_changed`
  - `medication_added`
  - `medication_status_changed`
  - `medication_schedule_changed`

### 7.14 Export Request Hardening

Extend `ultaura_data_export_requests` with immutable Health-bearing request classification:

```sql
alter table ultaura_data_export_requests
  add column if not exists visibility_scope text not null default 'standard_account'
    check (visibility_scope in ('standard_account', 'health_owner_only')),
  add column if not exists includes_health_profile boolean not null default false,
  add column if not exists requested_scope_snapshot jsonb,
  add column if not exists artifact_storage_path text,
  add column if not exists artifact_extension text,
  add column if not exists artifact_content_type text,
  add column if not exists invalidated_at timestamptz;
```

Typed contract:

```ts
type HealthExportScopeSnapshot = {
  requestedFormat: 'json' | 'csv';
  visibilityScope: 'standard_account' | 'health_owner_only';
  healthInclusionMode: 'automatic_when_present';
  includesHealthProfile: boolean;
  includesDocumentFiles: boolean;
  deliveredArtifactFormat: 'zip' | 'requested_format_native';
};
```

DB-side snapshot shape validation:

```sql
create or replace function is_valid_health_export_scope_snapshot(payload jsonb)
returns boolean
language sql
immutable
as $$
  select
    jsonb_typeof(payload) = 'object'
    and (payload ? 'requestedFormat')
    and (payload ? 'visibilityScope')
    and (payload ? 'healthInclusionMode')
    and (payload ? 'includesHealthProfile')
    and (payload ? 'includesDocumentFiles')
    and (payload ? 'deliveredArtifactFormat')
    and (payload->>'requestedFormat') in ('json', 'csv')
    and (payload->>'visibilityScope') in ('standard_account', 'health_owner_only')
    and (payload->>'healthInclusionMode') = 'automatic_when_present'
    and jsonb_typeof(payload->'includesHealthProfile') = 'boolean'
    and jsonb_typeof(payload->'includesDocumentFiles') = 'boolean'
    and (payload->>'deliveredArtifactFormat') in ('zip', 'requested_format_native');
$$;

alter table ultaura_data_export_requests
  add constraint chk_health_export_scope_snapshot_shape
  check (
    is_valid_health_export_scope_snapshot(requested_scope_snapshot)
  );

update ultaura_data_export_requests
set requested_scope_snapshot = jsonb_build_object(
  'requestedFormat', format::text,
  'visibilityScope', 'standard_account',
  'healthInclusionMode', 'automatic_when_present',
  'includesHealthProfile', false,
  'includesDocumentFiles', false,
  'deliveredArtifactFormat', 'requested_format_native'
)
where requested_scope_snapshot is null;

alter table ultaura_data_export_requests
  alter column requested_scope_snapshot set not null;

create or replace function has_exportable_health_document_files(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select false;
$$;

create or replace function has_exportable_health_profile_data(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from ultaura_health_conditions c
      where c.account_id = target_account_id
        and c.deleted_at is null
    )
    or exists (
      select 1
      from ultaura_health_medications m
      where m.account_id = target_account_id
        and m.deleted_at is null
    )
    or exists (
      select 1
      from ultaura_health_item_history h
      where h.account_id = target_account_id
    );
$$;
```

Later migration extensions:

- `2026MMDD000005_health_profile_export_hardening.sql` must be Phase-1-safe and must not reference `ultaura_health_documents` or `ultaura_health_observations` before those tables exist.
- `2026MMDD000003_health_profile_documents.sql` must `create or replace`:
  - `has_exportable_health_document_files(target_account_id uuid)` so it returns true when active documents exist
  - `has_exportable_health_profile_data(target_account_id uuid)` so it also counts active Health documents
- `2026MMDD000004_health_profile_observations.sql` must `create or replace has_exportable_health_profile_data(target_account_id uuid)` again so it also counts non-deleted observations
- The post-Phase-6 final definition of `has_exportable_health_profile_data` is the union of active conditions, active medications, non-deleted observations, preserved Health item history, and active Health documents.

DB enforcement for immutable request-time classification:

```sql
create or replace function enforce_health_export_scope_immutability()
returns trigger
language plpgsql
as $$
begin
  if new.requested_scope_snapshot is null then
    raise exception 'export request scope invalid';
  end if;

  if (new.requested_scope_snapshot->>'requestedFormat') is distinct from new.format::text then
    raise exception 'export request scope invalid';
  end if;

  if (new.requested_scope_snapshot->>'visibilityScope') is distinct from new.visibility_scope then
    raise exception 'export request scope invalid';
  end if;

  if ((new.requested_scope_snapshot->>'includesHealthProfile')::boolean is distinct from new.includes_health_profile) then
    raise exception 'export request scope invalid';
  end if;

  if tg_op = 'INSERT' then
    if new.includes_health_profile is distinct from has_exportable_health_profile_data(new.account_id) then
      raise exception 'export request scope invalid';
    end if;

    if ((new.requested_scope_snapshot->>'includesDocumentFiles')::boolean is distinct from has_exportable_health_document_files(new.account_id)) then
      raise exception 'export request scope invalid';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if old.requested_scope_snapshot is distinct from new.requested_scope_snapshot then
      raise exception 'export request scope invalid';
    end if;

    if old.visibility_scope is distinct from new.visibility_scope then
      raise exception 'export request scope invalid';
    end if;

    if old.includes_health_profile is distinct from new.includes_health_profile then
      raise exception 'export request scope invalid';
    end if;
  end if;

  if new.includes_health_profile and new.visibility_scope <> 'health_owner_only' then
    raise exception 'export request scope invalid';
  end if;

  if new.includes_health_profile and (new.requested_scope_snapshot->>'deliveredArtifactFormat') <> 'zip' then
    raise exception 'export request scope invalid';
  end if;

  if not new.includes_health_profile and (new.requested_scope_snapshot->>'deliveredArtifactFormat') <> 'requested_format_native' then
    raise exception 'export request scope invalid';
  end if;

  if new.includes_health_profile and new.download_url is not null then
    raise exception 'export request scope invalid';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_health_export_scope_immutability on ultaura_data_export_requests;
create trigger trg_enforce_health_export_scope_immutability
before insert or update on ultaura_data_export_requests
for each row execute function enforce_health_export_scope_immutability();
```

Rules:

- `visibility_scope`, `includes_health_profile`, and `requested_scope_snapshot` must be populated in the same insert statement that creates the export request row.
- `requested_scope_snapshot` is required on every export row after migration backfill; nullable snapshots are not allowed in v1.
- Health inclusion is automatic in v1 whenever request-time scope detects any Health data for the account; there is no owner-facing include/exclude Health toggle.
- Request-time Health inclusion detection is based only on exportable Health datasets: structured Health items, Health item history, document metadata, and original Health document files. Pending suggestions and Health-linked reminders do not make an export Health-bearing in v1.
- The DB function `has_exportable_health_profile_data(account_id)` is the classification source of truth at insert time; app-only classification is insufficient.
- `has_exportable_health_profile_data` must be `security definer` with fixed `search_path` so classification is not dependent on caller RLS visibility.
- The DB function `has_exportable_health_document_files(account_id)` is the request-time source of truth for `requested_scope_snapshot.includesDocumentFiles`; app-only classification is insufficient.
- During Phase 1.6, those helper functions must be foundation-safe and may only inspect tables already created by `000001`; later Health dataset migrations are responsible for extending them as those tables are introduced.
- Structured Health detection uses active rows only (`deleted_at is null` for conditions/medications/observations and `status = 'active'` for documents). Soft-deleted structured rows do not count directly; their preserved history rows still count through `ultaura_health_item_history`.
- Current export structured arrays (`conditions`, `medications`, `observations`) include only active rows at request time; soft-deleted structured items appear only through preserved `history` rows, not as current structured records.
- Deleted documents do not appear in `documents[]`; only their preserved item-history rows remain exportable.
- When a request includes Health Profile content, the request row itself must become `visibility_scope = 'health_owner_only'`.
- `requested_scope_snapshot` is immutable request-time scope and remains the source of truth even if Health data changes before processing completes.
- `requested_scope_snapshot` must validate against `HealthExportScopeSnapshot`.
- DB trigger enforcement must assert `requested_scope_snapshot.requestedFormat == format`, `requested_scope_snapshot.visibilityScope == visibility_scope`, and `requested_scope_snapshot.includesHealthProfile == includes_health_profile` on every insert/update.
- DB trigger enforcement on insert must also assert `requested_scope_snapshot.includesDocumentFiles == has_exportable_health_document_files(account_id)` so document-file inclusion is request-time immutable and not app-guessed.
- DB trigger enforcement for immutable request-time scope/classification is mandatory; app-only immutability checks are insufficient.
- DB constraints must also validate requested-scope snapshot shape; app-only JSON validation is insufficient.
- If the request does not include Health Profile content, existing broader visibility behavior may remain unchanged.
- The application layer must still enforce owner-only request, list, and download behavior for Health-bearing exports even if the RLS layer is misconfigured.
- Non-owner create/list/download attempts that encounter Health-bearing export rules must fail with a generic owner-only denial response and must not reveal whether the account currently has Health data.
- DB trigger/constraint exception text for Health-bearing export classification is implementation-internal only; app/API layers must catch and normalize those failures to non-informative owner-only or export-unavailable responses before anything reaches the client.
- RLS on `ultaura_data_export_requests` must enforce scope-class creation exactly: `standard_account` rows may be member-created, but `health_owner_only` rows may be owner-created only; user `update`/`delete` policies are forbidden for export lifecycle integrity.
- The existing export status enum remains `pending | processing | ready | expired | failed`; `invalidated_at` is a separate terminal access gate, not a replacement status enum.
- Deletion flows must set `invalidated_at` before storage cleanup begins.
- The export writer must abort before persisting a final artifact when `invalidated_at` is set.
- If `invalidated_at` is set while a request is `pending` or `processing`, the writer must stop and persist `status = 'failed'`.
- If `invalidated_at` is set after a request reached `ready`, downloads must fail closed, the artifact must be cleaned up, and UI/API surfaces must present the request as unavailable rather than downloadable.
- Any row with `invalidated_at is not null` must be treated as non-downloadable regardless of its underlying `status`.
- Health-bearing export rows must not persist a raw storage signed URL in `download_url`; the value must remain null for those rows.
- This `download_url is null` rule for `visibility_scope = 'health_owner_only'` must be DB-enforced (trigger/constraint), not only app-enforced.
- Before Health launch, any pre-existing `ready` export row that is reclassified as Health-bearing must have persisted `download_url` cleared and be invalidated or migrated to the authenticated-download path; if reliable migration is not possible, the row must be invalidated before the Health flag can be enabled.
- Legacy `ready` export remediation must be deterministic:
  - identify candidate rows using immutable request-time Health classification logic
  - set `invalidated_at`
  - clear any persisted `download_url`
  - remove the old storage artifact if one exists
  - ensure owner/non-owner list/download surfaces treat the row as unavailable before Health launch
- The legacy-export remediation runbook must be explicit and repeatable:
  1. Freeze the Health flag off.
  2. Query candidate `ready` rows whose request-time scope now classifies as Health-bearing.
  3. In one migration-safe batch flow, set `invalidated_at`, clear `download_url`, and persist any audit marker needed for later cleanup.
  4. Run storage cleanup for the old artifacts.
  5. Verify there are zero remaining Health-bearing `ready` rows with non-null `download_url`.
  6. Only then allow the Health flag to be enabled.
- Health export artifacts expire after 24 hours in v1 and cleanup must use the persisted artifact metadata fields rather than inferring from requested format.
- Every Health-bearing export artifact must materialize as a ZIP file.
- Non-health exports must use `deliveredArtifactFormat = 'requested_format_native'` in `requested_scope_snapshot`.
- `artifact_storage_path`, `artifact_extension`, and `artifact_content_type` must persist the actual delivered artifact metadata so cleanup never infers storage shape from `requestedFormat` alone.
- Requested JSON format still produces a ZIP, with Health content under `health/manifest.json` plus original Health document files under `health/documents/`.
- Requested CSV format may still include legacy CSV datasets, but Health content must still be represented through `health/manifest.json` plus original Health document files under `health/documents/`.
- Health-bearing export downloads must go through an owner-authenticated application route, not a client-visible storage signed URL.
- If a request includes Health Profile content, the delivered artifact is always a ZIP and the UI must label it accordingly even if the user originally chose a JSON-oriented export option.

### 7.15 Existing Health-Mention Suppression Support

The Health private-disclosure rule requires durable suppression state on already-persisted same-call health mentions.

```sql
alter table ultaura_health_mentions
  add column if not exists suppressed_at timestamptz,
  add column if not exists suppression_reason text
    check (suppression_reason in ('owner_private_disclosure')),
  add column if not exists suppressed_by_call_session_id uuid references ultaura_call_sessions(id);

create index if not exists idx_health_mentions_unsuppressed_alert
  on ultaura_health_mentions(triggers_alert)
  where triggers_alert = true and suppressed_at is null;
```

Rules:

- Persisted health mentions are never hard-deleted for a private-disclosure request in v1.
- Private-disclosure handling must durably mark same-call rows as suppressed.
- Suppressed rows must be excluded from wellness alerts, call-insights concerns/follow-up reasons, weekly summaries, and any owner/family alerting surfaces.

### 7.16 Call-Level Durable Suppression Marker

Reader-side exclusion for already-persisted insights and weekly-summary inputs requires a durable call-level suppression marker.

```sql
alter table ultaura_call_sessions
  add column if not exists health_private_disclosure_suppressed_at timestamptz,
  add column if not exists health_private_disclosure_suppression_reason text
    check (health_private_disclosure_suppression_reason in ('owner_private_disclosure'));

create index if not exists idx_call_sessions_health_private_suppressed
  on ultaura_call_sessions(health_private_disclosure_suppressed_at)
  where health_private_disclosure_suppressed_at is not null;
```

Rules:

- A private-disclosure request marks the current call session with durable suppression metadata.
- Persisted `ultaura_call_insights` rows are not deleted.
- V1 family-facing readers of call insights, alerts, and weekly summaries must apply whole-call health-adjacent suppression for a suppressed call rather than attempting per-concern provenance.
- Family-facing readers of call insights, alerts, and weekly summaries must exclude health-adjacent concern/follow-up data from suppressed calls unless the urgent safety / verification boundary applies.
- "health-adjacent" classification for this suppression path must follow the broad PRD standard, with Section 8.6 acting only as a minimum positive detector and fail-closed backstop rather than an exhaustive allowlist.
- This is a reader-side exclusion rule, not a hard-delete rule.

---

## 8. Type and API Contracts

### 8.1 Core Shared Types

```ts
export type HealthConsentStatus = 'not_requested' | 'granted' | 'denied' | 'revoked';

export type ApproximateDatePrecision = 'year' | 'month' | 'day';

export type ApproximateDateValue =
  | `${number}${number}${number}${number}`
  | `${number}${number}${number}${number}-${number}${number}`
  | `${number}${number}${number}${number}-${number}${number}-${number}${number}`;

export type ApproximateDate = {
  precision: ApproximateDatePrecision;
  value: ApproximateDateValue; // YYYY | YYYY-MM | YYYY-MM-DD
};

// Compile-time shape is intentionally broad; runtime schema/calendar validation is authoritative.

export type HealthTabValue =
  | 'suggestions'
  | 'conditions'
  | 'medications'
  | 'documents'
  | 'observations';

export type HealthConditionStatus = 'active' | 'monitoring' | 'resolved';
export type HealthMedicationStatus = 'current' | 'as_needed' | 'discontinued';
export type HealthSuggestionStatus = 'pending' | 'approved' | 'dismissed';
export type HealthSuggestionType = 'condition' | 'medication';
export type HealthSuggestionMode = 'new' | 'update';

export type HealthObservationCategory =
  | 'memory'
  | 'mood_emotional'
  | 'physical_mobility'
  | 'nutrition_eating'
  | 'sleep'
  | 'social_engagement'
  | 'medication_compliance'
  | 'general_other';

export type HealthObservationConcern =
  | 'note'
  | 'mild_concern'
  | 'significant_concern';

export type HealthDocumentCategory =
  | 'lab_results'
  | 'discharge_summary'
  | 'prescription'
  | 'insurance'
  | 'imaging_scans'
  | 'doctors_notes'
  | 'other';

export type HealthAutocompleteProvider =
  | 'icd10cm_clinical_tables'
  | 'rxterms_rxnorm'
  | 'plain_text_fallback';
```

Validation rule:

- Shared schemas must enforce `ApproximateDate.value` with a regex equivalent to `^\\d{4}(-\\d{2}){0,2}$` and must reject values inconsistent with the declared precision.
- Shared schemas must also reject calendar-invalid month/day values such as `2023-13` or `2023-02-30`.
- Shared schemas must validate every `timesOfDay` item against a canonical 24-hour regex equivalent to `^([01]\\d|2[0-3]):[0-5]\\d$`.
- Shared schemas must enforce `timesOfDay` array bounds in v1: 0-8 items, unique, canonicalized, and sorted ascending.
- Datetime strings in API payloads must be ISO-8601 UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`); date-only strings must remain `YYYY-MM-DD`.
- Shared schemas must enforce max lengths for user-entered text fields in v1:
  - condition/medication `name` and `normalizedName`: 1-120 chars
  - condition `stageSeverity`: 0-120 chars
  - condition `treatingClinician`: 0-160 chars
  - condition `notes`: 0-2000 chars
  - medication `dosage`: 0-120 chars
  - medication `frequency`: 0-120 chars
  - medication `prescribedBy`: 0-160 chars
  - medication `linkedReason`: 0-200 chars
  - medication `notes`: 0-2000 chars
  - observation `text`: 1-2000 chars
  - `summaryParaphrase`: 1-240 chars, single sentence
  - document `title`: 1-120 chars
  - document `notes`: 0-2000 chars
- Owner-only denial/error contracts must be generic and non-inferential:
  - `health_owner_only`, `document_access_denied`, and equivalent export denial paths must use fixed generic messages
  - API responses must not reveal whether Health data exists, whether a document exists, or whether an export was classified as Health-bearing

### 8.2 Dashboard Entity Shapes

```ts
export interface HealthCondition {
  id: string;
  lineId: string;
  status: HealthConditionStatus;
  name: string;
  standardizedId: { system: string; code: string } | null;
  diagnosedOnsetDate: ApproximateDate | null;
  stageSeverity: string | null;
  treatingClinician: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HealthMedication {
  id: string;
  lineId: string;
  status: HealthMedicationStatus;
  name: string;
  standardizedId: { system: string; code: string } | null;
  dosage: string | null;
  frequency: string | null;
  timesOfDay: string[]; // canonical HH:MM 24-hour strings
  prescribedBy: string | null;
  startDate: ApproximateDate | null;
  endDate: ApproximateDate | null;
  linkedConditionId: string | null;
  linkedReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HealthDocument {
  id: string;
  lineId: string;
  title: string;
  category: HealthDocumentCategory | null;
  documentDate: string | null;
  notes: string | null;
  mimeType: string;
  fileExtension: string;
  fileSizeBytes: number;
  status: 'uploading' | 'active' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface HealthObservation {
  id: string;
  lineId: string;
  text: string;
  category: HealthObservationCategory | null;
  observedDate: string | null;
  concernLevel: HealthObservationConcern | null;
  createdAt: string;
  updatedAt: string;
}
```

Rules:

- Dashboard entity shapes are active-view shapes only and must not include soft-deleted items in normal tab payloads.
- Deleted structured items remain available only through Health history/export contracts, not the current-view dashboard entities above.

### 8.3 Suggestion Contracts

```ts
export interface HealthSuggestion {
  id: string;
  lineId: string;
  suggestionType: HealthSuggestionType;
  suggestionMode: HealthSuggestionMode;
  status: HealthSuggestionStatus;
  normalizedName: string;
  confidenceLabel: 'high' | 'medium';
  summaryParaphrase: string;
  proposedFields:
    | ConditionSuggestionProposedFields
    | MedicationSuggestionProposedFields;
  similarItemId: string | null;
  similarItemWarning: boolean;
  sourceCallStartedAt: string | null;
  reviewedAt: string | null;
}
```

Rules:

- `summaryParaphrase` must be a minimized, quote-free, attribution-free summary suitable for owner review only.
- `summaryParaphrase` must not contain transcript wording, direct quotations, or caregiver-voice phrasing.
- App-side ingestion must sanitize `summaryParaphrase` before persistence and reject candidates that still contain disallowed quote/attribution patterns after sanitization.
- `summaryParaphrase` must be capped at 240 characters.

### 8.4 Telephony Health Context Contract

This is the only Health context shape telephony should consume. Telephony should not query encrypted Health tables directly in v1.

```ts
export type TelephonyPendingHealthNotice =
  | {
      id: string;
      noticeType: 'consent_change';
      spokenText: string;
      spokenLanguage: string | null;
      consentStatus: 'granted' | 'denied' | 'revoked';
    }
  | {
      id: string;
      noticeType: 'major_profile_change';
      spokenText: string;
      spokenLanguage: string | null;
      changeTypes: HealthMajorProfileChangeType[];
    };

export interface TelephonyHealthContext {
  schemaVersion: 'health-context-v1';
  lineId: string;
  consentStatus: HealthConsentStatus;
  canUseHealthInCall: boolean;
  familyManagedConsentPrompt: {
    hasOutstandingOwnerRequest: boolean;
    requestedAt: string | null;
    lastPromptedAt: string | null;
  } | null;
  selfManagedExplanationPrompt: {
    hasOutstandingOwnerRequest: boolean;
    requestedAt: string | null;
    lastPromptedAt: string | null;
  } | null;
  conditions: Array<{
    name: string;
    status: 'active' | 'monitoring';
  }>;
  medications: Array<{
    name: string;
    status: 'current' | 'as_needed';
    timesOfDay: string[];
  }>;
  observations: Array<{
    ownerSafeSummary: string;
    category: HealthObservationCategory | null;
    concernLevel: HealthObservationConcern | null;
    observedDate: string | null;
  }>;
  pendingNotices: TelephonyPendingHealthNotice[];
}
```

Rules:

- `familyManagedConsentPrompt` is present only for eligible family-managed lines.
- `selfManagedExplanationPrompt` is present only for eligible self-managed lines.
- `familyManagedConsentPrompt.hasOutstandingOwnerRequest` is true only when all of the following are true:
  - the line is family-managed
  - `health_consent` is not `granted`
  - `health_consent_requested_at` is non-null
  - `health_consent_requested_at` is later than `health_last_prompted_at`, or `health_last_prompted_at` is null
- `selfManagedExplanationPrompt.hasOutstandingOwnerRequest` is true only when all of the following are true:
  - the line is self-managed
  - `self_explanation_requested_at` is non-null
  - `self_explanation_requested_at` is later than `self_explanation_last_prompted_at`, or `self_explanation_last_prompted_at` is null
- Whether the current call should actually speak the prompt is a telephony-runtime decision that must also consider current-call state such as "already prompted in this call".
- The endpoint may be fetched before consent is granted for eligible family-managed lines so telephony can see pending prompt/notices state; in that pre-consent case the structured Health arrays must be empty and `canUseHealthInCall` must remain false.
- Only active/monitoring conditions are included, and only `name` plus `status` are sent in call context in v1.
- Only current/as-needed medications that are appropriate for conversational context are included, and only `name`, `status`, and `timesOfDay` are sent in call context in v1.
- "Appropriate for conversational context" is deterministic in v1: include `current` medications with explicit `timesOfDay` first, then `current` medications without explicit `timesOfDay`, then `as_needed` medications only when `timesOfDay.length > 0`, up to the cap.
- Medication context is capped at 10 items per call in v1. This is an engineering assumption, not a PRD-level product promise.
- Selection order is deterministic: use the current/without-times/as-needed-with-times subgroup order above; within each subgroup sort by earliest `timesOfDay` when present, then normalized medication name asc, then lexical `id` asc, and cap at 10.
- Only the 3 most recent observations are included.
- Observation recency basis is deterministic: sort by `coalesce(observedDate, createdAt::date)` desc, then `createdAt` desc, then `id` desc.
- Documents and pending suggestions are never included.
- `pendingNotices` may include safe `consent_change` notices for family-managed lines even when Health consent is not granted.
- `major_profile_change` notices are included only when Health consent is granted.
- Self-managed optional spoken explanation is represented only through `selfManagedExplanationPrompt`, not through `pendingNotices`.
- `spokenText` is generated app-side by `src/lib/ultaura/health/call-notices.ts` at fetch time from the structured notice payload and must already be non-specific and safe to speak; free-form notice copy is not stored as the persisted source of truth.
- `spokenLanguage` is generated app-side from the current call language resolved server-side from `callSessionId` when supported; if that language is not yet known at fetch time, use the line/account preferred language when supported, with English fallback otherwise.
- All datetime values in telephony Health context must be ISO-8601 UTC strings; date-only fields remain `YYYY-MM-DD`.
- `ownerSafeSummary` must be app-generated and minimized before telephony fetches it; raw observation text must never be passed through as-is.
- `ownerSafeSummary` generation is an app-side deterministic text-processing step in v1; it must not make an additional LLM call during context fetch.
- `ownerSafeSummary` generation must run in this order:
  1. normalize whitespace, collapse repeated punctuation, and trim leading/trailing separators
  2. strip direct-quote wrappers and common speaker labels/prefixes such as `Mom said:`, `Caregiver noted:`, `He said`, `She said`
  3. strip leading caregiver-attribution phrases such as `I noticed`, `I think`, `I saw`, `I heard`, `I feel`, `I felt`, `we noticed`, `caregiver reported`, `daughter said`, `son noted`
  4. keep only the first factual sentence candidate
  5. reject the result if it is primarily opinion, instruction, meta-commentary, or emotional framing rather than an observable fact
  6. cap the final result at 140 characters without adding new factual content
- Minimum deterministic rejection patterns include:
  - pure opinion/openers such as `I worry`, `maybe`, `probably`, `it seems like` when no concrete fact remains
  - instructions or requests such as `please tell the doctor`, `remind her to`, `call the clinic`
  - empty/near-empty text after stripping quotes/attribution
- `ownerSafeSummary` examples:
  - `I noticed Mom seemed more tired today.` -> `Seemed more tired today.`
  - `Caregiver noted: "She said her knees hurt this morning."` -> `Knees hurt this morning.`
  - `I think she may be declining and I'm scared.` -> omitted from telephony context
- If no safe factual summary remains, omit the observation from telephony context instead of sending raw text.

### 8.5 Telephony Suggestion Candidate Contract

```ts
export interface QueueHealthSuggestionCandidateInput {
  lineId: string;
  callSessionId: string;
  suggestionType: 'condition' | 'medication';
  suggestionMode: 'new' | 'update';
  normalizedName: string;
  confidenceLabel: 'high' | 'medium';
  summaryParaphrase: string;
  proposedFields:
    | ConditionSuggestionProposedFields
    | MedicationSuggestionProposedFields;
}
```

Rules:

- No raw transcript excerpts.
- No open-ended blobs.
- Telephony may send only candidate data; final queue dedupe, account derivation, and stale handling remain app-side responsibilities.
- Telephony does not provide update-target identity directly.
- For `suggestionMode = 'update'`, the app side must resolve the target item before persistence and must not persist an update suggestion if no valid target can be resolved.
- Update-target resolution must be deterministic across retries and workers:
  1. candidate set = active same-kind items in the same line
  2. rank by exact normalized-name match, then known alias match, then similarity score
  3. if multiple candidates tie, choose by `updated_at` desc then `id` asc
  4. if no candidate meets threshold, return `no_update_target` and store no suggestion row

### 8.6 Telephony Privacy and Consent Tool Contracts

```ts
export type HealthSpokenConsentToolName =
  | 'grant_health_consent'
  | 'deny_health_consent'
  | 'revoke_health_consent';

export interface HealthSpokenConsentToolInput {
  lineId: string;
  callSessionId: string;
}

export interface MarkHealthDisclosurePrivateInput {
  lineId: string;
  callSessionId: string;
}

export type HealthSpokenConsentToolResult = {
  success: true;
  resultingConsentStatus: 'granted' | 'denied' | 'revoked';
  effectiveScope: 'next_call' | 'current_call_shutdown';
  canUseHealthInCurrentCall: boolean;
};

export type MarkHealthDisclosurePrivateResult = {
  success: true;
  suppressionScope: 'current_call_health_adjacency';
  affectedCallSessionId: string;
};
```

Rules:

- Family-managed spoken Health consent uses explicit tool names aligned with the existing voice-consent pattern: `grant_health_consent`, `deny_health_consent`, and `revoke_health_consent`.
- `mark_health_disclosure_private` is the health-specific tool for "don't tell my family / keep this private" when the current disclosure is health-adjacent, and in v1 it applies whole-call health-adjacent suppression for the active call session.
- In v1 this tool captures privacy intent from the current disclosure but does not attempt disclosure-level provenance tracking; whole-call health-adjacent suppression is the only supported persistence scope.
- Health-specific privacy tooling takes precedence over generic `mark_topic_private` / `mark_private` when the current disclosure is being considered for Health suggestions, health-mention alerts, follow-up reasons, or health-adjacent concern codes.
- Generic privacy tools remain valid for non-Health privacy requests and broader topic privacy outside this Health-specific path.
- Every Health tool route or internal Health endpoint that receives both `lineId` and `callSessionId` must load the call session and reject mismatches before any read/write side effect; this includes context fetch, spoken-consent capture, suggestion queueing, private-disclosure suppression, and notice-delivered acknowledgements.
- Preview/test call sessions must not persist Health consent state, Health consent history, Health suggestion candidates, Health suppression markers, Health notice delivery state, or Health metrics/events; they may return synthetic/no-op success for tool-flow testing only.

Health-adjacent detection in v1:

- The deterministic rubric below is a minimum positive detector and non-LLM backstop, not an exclusive allowlist for suppression.
- A disclosure must be treated as health-adjacent when any of these signals are true in the current turn/call:
  - `log_health_mention` category is one of: `pain`, `medication`, `appointment`, `symptom`, `sleep`, `appetite`, `mobility`, `energy`
  - call insights concern/follow-up codes include one of: `sleep`, `pain`, `fatigue`, `appetite`
  - text matches the existing `health_medical` classifier pattern used by telephony topic exclusions
- If the speaker is discussing medical conditions, medications, symptoms, tests, appointments, treatment, mobility, appetite, sleep, or comparable care needs and the system is unsure, suppression must fail closed and treat the disclosure as health-adjacent.
- If generic privacy tooling (`mark_topic_private` / `mark_private`) fires and this rubric is true, telephony must also invoke the same durable suppression behavior as `mark_health_disclosure_private`.
- If the rubric is false and the disclosure is clearly non-health, generic privacy tooling remains generic and does not trigger Health suppression.

### 8.7 Health Reminder Classification Contract

```ts
export type ReminderSourceContext = 'general' | 'health_profile';

export type ReminderPauseSource =
  | 'manual'
  | 'health_manual_resume_required'
  | 'health_consent_not_requested'
  | 'health_consent_denied'
  | 'health_consent_revoked'
  | 'health_plan_ineligible';

export type HealthHistoryChange<Field extends string, Value> = {
  field: Field;
  before: Value | null;
  after: Value | null;
};

export type HealthConditionHistorySnapshot = {
  name: string;
  status: HealthConditionStatus;
  diagnosedOnsetDate: ApproximateDate | null;
  stageSeverity: string | null;
  treatingClinician: string | null;
  notes: string | null;
};

export type HealthMedicationHistorySnapshot = {
  name: string;
  status: HealthMedicationStatus;
  dosage: string | null;
  frequency: string | null;
  timesOfDay: string[];
  startDate: ApproximateDate | null;
  endDate: ApproximateDate | null;
  prescribedBy: string | null;
  linkedConditionId: string | null;
  linkedReason: string | null;
  notes: string | null;
};

export type HealthObservationHistorySnapshot = {
  text: string;
  category: HealthObservationCategory | null;
  concernLevel: HealthObservationConcern | null;
  observedDate: string | null;
};

export type HealthDocumentHistorySnapshot = {
  title: string;
  category: HealthDocumentCategory | null;
  documentDate: string | null;
  notes: string | null;
  originalFilename: string | null;
};

export type HealthConditionHistoryChange =
  | HealthHistoryChange<'name', string>
  | HealthHistoryChange<'status', HealthConditionStatus>
  | HealthHistoryChange<'diagnosedOnsetDate', ApproximateDate>
  | HealthHistoryChange<'stageSeverity', string>
  | HealthHistoryChange<'treatingClinician', string>
  | HealthHistoryChange<'notes', string>;

export type HealthMedicationHistoryChange =
  | HealthHistoryChange<'name', string>
  | HealthHistoryChange<'status', HealthMedicationStatus>
  | HealthHistoryChange<'dosage', string>
  | HealthHistoryChange<'frequency', string>
  | HealthHistoryChange<'timesOfDay', string[]>
  | HealthHistoryChange<'startDate', ApproximateDate>
  | HealthHistoryChange<'endDate', ApproximateDate>
  | HealthHistoryChange<'prescribedBy', string>
  | HealthHistoryChange<'linkedConditionId', string>
  | HealthHistoryChange<'linkedReason', string>
  | HealthHistoryChange<'notes', string>;

export type HealthObservationHistoryChange =
  | HealthHistoryChange<'text', string>
  | HealthHistoryChange<'category', HealthObservationCategory>
  | HealthHistoryChange<'concernLevel', HealthObservationConcern>
  | HealthHistoryChange<'observedDate', string>;

export type HealthDocumentHistoryChange =
  | HealthHistoryChange<'title', string>
  | HealthHistoryChange<'category', HealthDocumentCategory>
  | HealthHistoryChange<'documentDate', string>
  | HealthHistoryChange<'notes', string>
  | HealthHistoryChange<'originalFilename', string>;

export type HealthHistoryPayload =
  | { itemKind: 'condition'; action: 'created' | 'deleted'; snapshot: HealthConditionHistorySnapshot }
  | { itemKind: 'condition'; action: 'edited'; summaryLabel: string; changes: HealthConditionHistoryChange[] }
  | { itemKind: 'medication'; action: 'created' | 'deleted'; snapshot: HealthMedicationHistorySnapshot }
  | { itemKind: 'medication'; action: 'edited'; summaryLabel: string; changes: HealthMedicationHistoryChange[] }
  | { itemKind: 'observation'; action: 'created' | 'deleted'; snapshot: HealthObservationHistorySnapshot }
  | { itemKind: 'observation'; action: 'edited'; summaryLabel: string; changes: HealthObservationHistoryChange[] }
  | { itemKind: 'document'; action: 'created' | 'deleted'; snapshot: HealthDocumentHistorySnapshot }
  | { itemKind: 'document'; action: 'edited'; summaryLabel: string; changes: HealthDocumentHistoryChange[] }
  | { itemKind: 'suggestion'; action: 'suggestion_approved' | 'suggestion_dismissed' | 'system_stale_dismissed'; suggestionType: HealthSuggestionType; normalizedName: string; resultingItemId: string | null };

// `system_stale_dismissed` is preserved for history/export correctness but should render as a dismissed/stale system outcome, not a separate primary owner-facing status.

export type HealthMajorProfileChangeType =
  | 'condition_added'
  | 'condition_status_changed'
  | 'medication_added'
  | 'medication_status_changed'
  | 'medication_schedule_changed';

export type HealthCallNoticePayload =
  | { noticeType: 'consent_change'; consentStatus: 'granted' | 'denied' | 'revoked' }
  | { noticeType: 'major_profile_change'; changeTypes: HealthMajorProfileChangeType[] };

export type HealthConsentHistoryPayload =
  | { eventType: 'owner_request'; requestedAt: string }
  | { eventType: 'spoken_prompt'; promptedAt: string; callSessionId: string }
  | { eventType: 'spoken_decision'; consentStatus: 'granted' | 'denied' | 'revoked'; callSessionId: string }
  | { eventType: 'self_service_decision'; consentStatus: 'granted' | 'revoked'; actedAt: string };

export interface HealthAutocompleteOption {
  provider: Exclude<HealthAutocompleteProvider, 'plain_text_fallback'>;
  label: string;
  normalizedName: string;
  standardizedId: { system: string; code: string };
}

export interface HealthExportDownloadDescriptor {
  requestId: string;
  visibilityScope: 'standard_account' | 'health_owner_only';
  authenticatedDownloadPath: string | null;
  artifactExtension: 'zip' | null;
  artifactContentType: string | null;
}

export interface HealthExportConditionRow {
  conditionId: string;
  lineId: string;
  status: HealthConditionStatus;
  name: string;
  standardizedId: { system: string; code: string } | null;
  diagnosedOnsetDate: ApproximateDate | null;
  stageSeverity: string | null;
  treatingClinician: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HealthExportMedicationRow {
  medicationId: string;
  lineId: string;
  status: HealthMedicationStatus;
  name: string;
  standardizedId: { system: string; code: string } | null;
  dosage: string | null;
  frequency: string | null;
  timesOfDay: string[];
  prescribedBy: string | null;
  startDate: ApproximateDate | null;
  endDate: ApproximateDate | null;
  linkedConditionId: string | null;
  linkedReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HealthExportObservationRow {
  observationId: string;
  lineId: string;
  text: string;
  category: HealthObservationCategory | null;
  observedDate: string | null;
  concernLevel: HealthObservationConcern | null;
  createdAt: string;
  updatedAt: string;
}

export interface HealthExportHistoryRow {
  createdAt: string;
  lineId: string;
  itemKind: 'condition' | 'medication' | 'document' | 'observation' | 'suggestion';
  itemId: string | null;
  action: 'created' | 'edited' | 'deleted' | 'suggestion_approved' | 'suggestion_dismissed' | 'system_stale_dismissed';
  actorType: 'owner' | 'system' | 'telephony';
  actorUserId: string | null;
  payload: HealthHistoryPayload;
}

export interface HealthExportDocumentRow {
  documentId: string;
  lineId: string;
  title: string;
  notes: string | null;
  originalFilename: string;
  exportedFilename: string;
  mimeType: string;
  category: HealthDocumentCategory | null;
  documentDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HealthExportManifest {
  schemaVersion: 'health-profile-export-v1';
  requestId: string;
  requestedFormat: 'json' | 'csv';
  exportedAt: string;
  conditions: HealthExportConditionRow[];
  medications: HealthExportMedicationRow[];
  observations: HealthExportObservationRow[];
  history: HealthExportHistoryRow[];
  documents: HealthExportDocumentRow[];
}

export interface HealthExportBundlePayload {
  schemaVersion: 'health-export-bundle-v1';
  requestId: string;
  manifest: HealthExportManifest;
  documentFiles: Array<{
    documentId: string;
    internalBytePath: string; // app-internal relative POST path that streams decrypted bytes; never a filesystem path or signed URL
    originalFilename: string;
    mimeType: string;
  }>;
}

export interface HealthDocumentAccessTokenDescriptor {
  token: string;
  expiresAt: string;
}

export type QueueHealthSuggestionCandidateResult = {
  schemaVersion: 'health-suggestions-v1';
  success: true;
  action: 'queued' | 'noop_duplicate' | 'noop_blocked';
};
```

Shared failure contract:

```ts
export type HealthActionErrorCode =
  | 'health_owner_only'
  | 'health_locked'
  | 'health_feature_disabled'
  | 'health_context_unavailable'
  | 'health_consent_not_granted'
  | 'health_cooldown'
  | 'invalid_line'
  | 'health_export_invalidated'
  | 'document_access_denied'
  | 'document_access_token_expired'
  | 'document_file_type_not_supported'
  | 'document_file_too_large'
  | 'health_general_reminder_link_forbidden'
  | 'health_reminder_resume_limit_exceeded'
  | 'partial_reminder_update';

export type HealthActionError = {
  success: false;
  code: HealthActionErrorCode;
  message: string;
};
```

### 8.8 Internal API Endpoints

Versioning rule:

- Internal telephony Health endpoints must require `x-ultaura-health-contract-version: v1` and fail closed on unsupported versions.

`GET /api/telephony/health/context?lineId=...&callSessionId=...`

- Auth: internal API secret only
- Returns: `TelephonyHealthContext`
- Request must include both `lineId` and `callSessionId`
- The endpoint must validate that the call session belongs to the same line before returning any Health data
- Returns no structured Health profile data when consent is not granted
- May still include safe family-managed `consent_change` notices when Health consent is not granted
- May include `selfManagedExplanationPrompt` for eligible self-managed lines without enabling structured Health profile context
- Response must include `schemaVersion = 'health-context-v1'` for app/telephony contract compatibility checks.
- Telephony client behavior on timeout/non-200 is fail-closed: continue the call with `canUseHealthInCall = false`, empty structured arrays, and no Health tool use for that turn/call path.
- Telephony retries this endpoint at most once per call setup path; repeated failures do not unblock Health.

`GET /api/health/autocomplete/conditions?q=...`

- Auth: canonical owner only
- Source: ICD-10-CM / Clinical Tables through a server-side wrapper
- Returns: `HealthAutocompleteOption[]`
- If the source is unavailable or low-confidence, the UI must still allow plain-text entry

`GET /api/health/autocomplete/medications?q=...`

- Auth: canonical owner only
- Source: RxTerms / RxNorm-backed search through a server-side wrapper
- Returns: `HealthAutocompleteOption[]`
- If the source is unavailable or low-confidence, the UI must still allow plain-text entry

`POST /api/telephony/health/suggestions`

- Auth: internal API secret only
- Body: `QueueHealthSuggestionCandidateInput`
- Response:

```ts
{
  schemaVersion: 'health-suggestions-v1';
  success: true;
  action: 'queued' | 'noop_duplicate' | 'noop_blocked' | 'no_update_target';
}
```

- The route must validate that `callSessionId` belongs to `lineId` before evaluating dedupe, update-target resolution, or persistence.
- If `suggestionMode = 'update'` and no valid target crosses the documented threshold, the route returns `action = 'no_update_target'` and persists nothing.

`POST /api/telephony/health/notices/delivered`

- Auth: internal API secret only
- Body: `{ lineId: string; noticeId: string; callSessionId: string }`
- Behavior:
  - marks a pending notice as `delivered` only after the notice was actually spoken in that call
  - no-ops safely if the notice was already superseded/canceled
  - rejects mismatched line/call session combinations

`POST /api/health/documents/upload`

- Auth: canonical owner only
- Input: `multipart/form-data` only with:
  - `lineId`
  - `file`
  - `title`
  - optional `category`
  - optional `documentDate`
  - optional `notes`
- Behavior:
  - validate owner, plan eligibility, file type, secure MIME sniffing / magic-byte match, and size limit
  - enforce MIME/extension allowlist in v1:
    - `application/pdf` + `.pdf`
    - `image/jpeg` + `.jpg`/`.jpeg`
    - `image/png` + `.png`
    - `image/heic` + `.heic`
  - enforce upload safety policy in v1:
    - reject any file whose extension and magic bytes disagree
    - reject all executable, script, archive, office-document, and other active-content/container formats
    - v1 malware policy is strict allowlist + magic-byte verification only; unsupported or ambiguous files fail closed
  - enforce field bounds in v1:
    - `title`: 1-120 chars
    - `notes`: 0-2000 chars
- enforce rate limits in v1:
  - upload: max 10 document uploads per line per hour
  - access-token issuance: max 30 token requests per document per hour
- encrypt metadata payload
- create `uploading` draft row with the encrypted metadata payload and owner actor ids already populated
- encrypt file server-side with the line DEK
- upload encrypted bytes to storage under an opaque object key
- finalize row to `active`, or mark `failed`
- Browser-direct storage upload is out of scope for v1 because app-layer encryption and metadata protection must remain server-controlled
- This route must run on a Node-capable runtime and be configured to safely handle the 25 MB multipart upload ceiling in v1

`POST /api/health/documents/[documentId]/access-token`

- Auth: canonical owner only
- Body: `{ action: 'preview' | 'download' }`
- Returns: `HealthDocumentAccessTokenDescriptor`
- Rules:
  - validate owner, current plan eligibility, locked-state denial, and active document state before issuing a token
  - token is an opaque server-stored random value, not a self-describing signed token
  - only a token hash may be stored server-side
  - token is bound to canonical owner, document id, and requested action
  - token TTL is 5 minutes in v1
  - token is single-purpose
  - token becomes invalid after first successful use, expiry, owner change, line deletion, document deletion, or plan ineligibility / locked-plan transition
  - client requests a fresh token when the previous token expires or a new action is needed

`POST /api/health/documents/[documentId]/preview`
`POST /api/health/documents/[documentId]/download`

- Auth: canonical owner only plus short-lived app-signed token
- Body: `{ token: string }`
- Behavior: re-check current plan eligibility, locked-state denial, token validity, and active document state before decrypting and streaming content server-side; log minimal access event
- Expired or invalid tokens must fail closed and require a fresh `access-token` request
- Token transport must not use URL query params in v1
- Responses must set `Cache-Control: no-store, private, max-age=0`, `Pragma: no-cache`, `Expires: 0`, and `X-Content-Type-Options: nosniff`.

`GET /api/privacy/exports/[requestId]/download`

- Auth: canonical owner only
- Behavior:
  - verifies request ownership and completion status at read time
  - for Health-bearing exports, streams the ZIP artifact through the application without exposing a raw storage signed URL
  - for non-Health exports, existing legacy behavior may remain until separately upgraded

`GET /api/privacy/exports/[requestId]/health-bundle`

- Auth: internal API secret only
- Returns: `HealthExportBundlePayload`
- Behavior:
  - validates that the export request is currently classified as Health-bearing
  - composes the Health manifest on the app side through `src/lib/ultaura/health/export.ts`
  - returns a typed `HealthExportManifest` plus app-generated internal document byte paths for the telephony export writer
  - response includes `schemaVersion = 'health-export-bundle-v1'`
  - app-side export composition owns document decryption access through line DEKs; telephony does not fetch line DEKs or raw storage object keys for Health documents
  - fails closed if the request is `invalidated_at` or no longer qualifies as Health-bearing at the immutable request-time snapshot

`POST /api/privacy/exports/[requestId]/health-document-bytes/[documentId]`

- Auth: internal API secret only
- Behavior:
  - validates request/document ownership and that the document belongs to the immutable Health export snapshot for that request
  - decrypts and streams the document bytes directly from the app side
  - is the only valid target for `HealthExportBundlePayload.documentFiles[].internalBytePath`
  - `internalBytePath` is an app-internal relative HTTP path, not a temp-file path, storage URL, or signed URL
  - telephony export composition must stream the response directly into the ZIP writer and must not require decrypted temp files on disk

Health ZIP layout:

- Every Health-bearing export ZIP stores Health content under `health/`
- Manifest path is always `health/manifest.json`
- Original document files live under `health/documents/`
- Exported document filenames must use `documentId__sanitizedOriginalFilename` so duplicates are impossible while `originalFilename` remains preserved in the manifest

---

## 9. Access, Consent, and Visibility Matrix

### 9.1 Dashboard Access Matrix

| User / State | Health Nav | Health Page | Health Data | Health Export | Health Docs |
|---|---|---|---|---|---|
| Family canonical owner, eligible plan | Visible | Allowed | Allowed | Allowed | Allowed |
| Self canonical owner, eligible plan | Visible | Allowed | Allowed | Allowed | Allowed |
| Non-owner user (viewer, member, admin, or other non-primary user) | Hidden | Denied | Denied | Denied | Denied |
| Eligible owner, locked plan | Visible but locked | Locked landing only | No detailed data | Allowed | Denied from direct doc access while locked |

### 9.2 Call-Side Use Matrix

| State | Health Context in Call | Structured Suggestions | Observation Context | Health Reminder Delivery |
|---|---|---|---|---|
| `granted` | Allowed | Allowed | Allowed | Allowed |
| `not_requested` | Blocked | Blocked | Blocked | Blocked |
| `denied` | Blocked | Blocked | Blocked | Blocked |
| `revoked` | Blocked | Blocked | Blocked | Blocked |
| Locked plan | Blocked | Blocked | Blocked | Blocked |
| Privacy override phrase | Blocked for that disclosure path | Blocked | N/A | N/A |

### 9.3 Non-Health Surface Visibility Matrix for Health-Linked Reminders

| Surface | Behavior |
|---|---|
| `/dashboard/reminders` generic lists | Fully hidden in v1 |
| Dashboard home upcoming reminders | Fully hidden in v1 |
| Line detail reminder count | Excluded from all count and detail surfaces |
| Viewer-read surfaces | Fully hidden |
| Locked-plan UI | Fully hidden |
| Generic exports without Health data | Excluded |
| Health-bearing export | Excluded in v1 |
| Outside-Health fallback | Not part of v1. Health-linked reminders are fully omitted outside Health in this build; any future exception requires a separate approved spec revision. |

### 9.4 Document Access Matrix

| Actor | Metadata View | Preview | Download | Access Log Visibility |
|---|---|---|---|---|
| Canonical owner | Allowed | Allowed | Allowed | Not user-facing |
| Any non-owner user | Denied | Denied | Denied | Denied |
| Locked plan owner | Metadata denied in UI | Denied in UI; outstanding document access tokens invalidated | Denied in UI; outstanding document access tokens invalidated | Not user-facing |
| Export processor | Internal only | N/A | Internal only | Internal only |

### 9.5 Internal / Administrative Surface Rule

Default rule:

- Health-bearing artifacts, Health-bearing export rows, and Health-derived reminder metadata are owner-only even on internal/admin/support surfaces.

Out-of-scope exception:

- a separate explicit break-glass model may be designed later, but it is not part of this feature and must not be assumed by implementation agents.

Allowed service-role job categories in v1:

- telephony Health context fetch and suggestion/notices delivery plumbing
- export artifact assembly/expiry cleanup for owner-approved requests
- deletion cleanup for line/account/org destructive flows
- admin timeline redaction pipelines that return no Health-specific content by default

Any new service-role consumer outside this allowlist must be treated as out of scope until explicitly approved.

---

## 10. Reminder Isolation Rules

This section is intentionally explicit because reminder leakage was the last major PRD review seam.

### 10.1 Classification Rule

Every reminder must have a `source_context`.

- `general` = existing generic reminder
- `health_profile` = Health-linked reminder created from a medication in Health

No Health-linked reminder may be created without `source_context = 'health_profile'`.

### 10.2 Delivery Rule

Health-linked reminders:

- must use `delivery_method = 'outbound_call'`
- must never use SMS
- may exist before consent is granted
- must not deliver until consent is granted
- may only be created from inside Health as `source_context = 'health_profile'`; existing general reminders must not be reclassified or linked into Health in v1
- tool-layer `deliveryMethod = 'call'` must map to DB/app `delivery_method = 'outbound_call'`; Health reminder flows must never persist a raw `'call'` literal or allow `'sms'`

### 10.3 Query Rule

All generic reminder queries must be audited and updated.

Default rule:

- generic reminder surfaces must exclude `source_context = 'health_profile'` and must not expose Health-linked reminders outside Health in v1

Exception rule:

- no reminder fallback path outside Health is included in v1
- if a future product/privacy/legal decision ever requires such a fallback, it must be added only through a separate approved spec revision and not improvised during implementation

This rule applies to all of the following, not just the dashboard reminders page:

- dashboard reminder pages
- dashboard home reminder widgets
- line detail reminder counts and previews
- dashboard search
- insights surfaces that summarize reminder-call behavior
- telephony reminder tools such as `list_reminders`, `pause_reminder`, `resume_reminder`, `cancel_reminder`, `edit_reminder`, and `snooze_reminder`
- reminder activity/history surfaces
- call history and line activity surfaces
- usage and dashboard summary surfaces
- admin/internal timeline surfaces that summarize reminder activity
- generic reminder notification channels such as email/push/SMS, if they exist
- scheduler claim/delivery logic
- generic reminder export composition

### 10.4 Count Rule

Health-linked reminders count toward reminder limits only while active.

For Health-linked reminders, "active" means:

- `status = 'scheduled'`
- `is_paused = false`

When a Health-linked reminder is paused because consent is not granted, consent is revoked, or the plan is ineligible, it must stop counting toward limits immediately.

Do not broaden this rule to generic reminders unless explicitly chosen elsewhere. The Health rule is a feature-specific exception.

### 10.5 Pause and Resume Rule

System-driven Health reminder pauses must set:

- `is_paused = true`
- `paused_at = now()`
- `pause_sources` to include the exact Health pause cause
- database trigger logic must keep `is_paused` synchronized with whether `pause_sources` is empty or non-empty
- when a blocking pause source later clears but the reminder must still remain paused until explicit owner action, `pause_sources` must retain `health_manual_resume_required`

Manual resume is required after:

- `not_requested -> granted`
- `revoked/denied -> granted`
- `ineligible -> eligible`

No automatic resume is allowed.

If a senior or owner later adds/removes one pause source while others remain:

- the reminder stays paused until all pause sources are cleared
- the UI must explain which pause sources remain

### 10.6 Cancellation Rule

Health-linked reminders must be canceled, not merely paused, when:

- a medication is deleted
- a medication status becomes `discontinued`

### 10.7 Reminder Events Rule

`ultaura_reminder_events` must log Health-linked lifecycle actions with metadata sufficient for debugging and owner history, without leaking medication names into generic viewer-readable surfaces.

Required event types:

- `health_link_created`
- `health_link_paused`
- `health_link_resumed`
- `health_link_canceled`
- `health_link_schedule_mismatch_prompted`

Event enum and constraint updates are part of this work; agents must not assume current DB and TS unions already allow these values.

---

## 11. Export, Deletion, and Audit Lifecycle Matrix

| Scenario | Structured Health | Suggestions | History | Docs Metadata | Doc Files | Reminder Links | Document Access Logs | Compliance Logs |
|---|---|---|---|---|---|---|---|---|
| Dashboard item delete | Removed from active views | N/A | Preserved | N/A | N/A | Medication delete/discontinue cancels linked reminders; non-medication deletes do not create reminder-link side effects | Unchanged | Unchanged |
| Document delete | N/A | N/A | Preserved | Hard delete immediately | Hard delete immediately | N/A | Preserved until line/full deletion | Unchanged |
| Line deletion | Hard delete | Hard delete | Hard delete | Hard delete | Hard delete | Hard delete | Hard delete | Existing platform rules |
| Privacy-center account deletion | Hard delete | Hard delete | Hard delete | Hard delete | Hard delete + storage cleanup | Hard delete | Hard delete | Existing platform rules |
| Full user/org deletion | Hard delete | Hard delete | Hard delete | Hard delete | Hard delete + storage cleanup | Hard delete | Hard delete | Existing platform rules |
| Plan downgrade to ineligible | Preserved but locked | Preserved but hidden | Preserved | Preserved but hidden | Preserved but inaccessible | Paused | Preserved | Unchanged |
| Health-bearing export | Included | Excluded in v1 | Included | Included | Included | Excluded in v1 | Excluded | Excluded except any future generic non-Health retained audit |

Rules:

1. Health item history is user-facing feature history and must be deleted on full account deletion.
2. Broader platform compliance logs may keep non-Health skeletons as already required by platform rules, but Health-specific content must not be retained beyond those minimum requirements.
3. Storage object cleanup is an explicit deletion step and cannot rely on SQL cascade behavior.
4. Health-bearing export requests, rows, and download access are owner-only.
5. If deletion begins after an export request is created, any Health-bearing export artifact and any issued access grant must be invalidated as part of deletion.

---

## 12. Implementation Tasks by Phase

Note:

- The requirement IDs listed under each task are the requirements that task directly advances or partially satisfies.
- A requirement is only considered complete when all dependent tasks touching that behavior are complete and verified.
- Agents should use Section 5 and Section 14, not a single task entry, to determine final coverage.

### Phase 1: Foundation and Entitlements

Purpose:

- establish schema, ownership, entitlements, consent primitives, nav shell, locked state, disclaimer handling, and safe dashboard entrypoints before any Health data can be created

#### 1.1 Create foundation migration

Files:

- `supabase/migrations/2026MMDD000001_health_profile_foundation.sql`
- `supabase/tests/database/health-profile-rls.test.sql`

Requirements:

- R8-R18
- R123
- R130-R133
- R137
- R140
- R142
- R148
- R158
- R172

Dependencies:

- none

Acceptance criteria:

- owner-only Health consent state and consent history tables exist
- owner-only RLS helpers exist
- explicit `CREATE POLICY` owner-only RLS definitions exist for every Health table in scope (not just helper-function scaffolding)
- owner-only Health tables exist for consent state, consent history, account state, conditions, medications, suggestions, history, and call notices
- durable suppression fields exist on persisted `ultaura_health_mentions`
- durable call-level suppression fields exist on `ultaura_call_sessions`
- DB-backed runtime feature-flag row/table exists for `health_profile`
- the `health_profile` runtime-flag row is seeded disabled by default and DB-first/env-fallback precedence is verified
- viewer/non-owner access is denied at the database layer
- browser-authenticated owner writes directly against Health current-state/history/audit tables are denied at the database layer; service-mediated mutation paths are required

#### 1.2 Add shared Health types and schemas

Files:

- `packages/types/src/health.ts`
- `packages/types/src/privacy.ts`
- `packages/types/src/tools.ts`
- `packages/schemas/src/health.ts`
- `packages/schemas/src/telephony/health.ts`

Requirements:

- R12-R18
- R48-R57
- R58-R68
- R86-R105
- R106-R118
- R157
- R170

Dependencies:

- 1.1

Acceptance criteria:

- all Health domain types are exported from shared packages
- approximate date and Health consent types are canonical and reused everywhere
- `timesOfDay` is validated as canonical `HH:MM` 24-hour time in shared schemas
- failure and token descriptor contracts are canonical and reused everywhere

#### 1.3 Build app-side Health service scaffolding

Files:

- `src/lib/ultaura/health/access.ts`
- `src/lib/ultaura/health/entitlements.ts`
- `src/lib/ultaura/health/account-state.ts`
- `src/lib/ultaura/health/consent.ts`
- `src/lib/ultaura/health/consent-history.ts`
- `src/lib/ultaura/health/crypto.ts`
- `src/lib/ultaura/health/types.ts`
- `src/lib/ultaura/accounts.ts`
- `telephony/src/services/line-encryption.ts`

Requirements:

- R3-R11
- R12-R27
- R41-R47
- R136-R140
- R160
- R168
- R172
- R178

Dependencies:

- 1.1
- 1.2

Acceptance criteria:

- owner-only auth helper exists for all Health actions
- eligible-plan + trial check exists as reusable helper
- disclaimer acknowledgement and first-view tracking exist
- server-side `disclaimer_version` comparison exists so material policy/behavior changes force re-acknowledgement predictably
- self opt-in and family re-prompt requests can be read/written safely
- self-managed to family-managed upgrade resets Health consent to `not_requested` and pauses Health-linked reminders before any future family-managed call-side use
- self-managed to family-managed upgrade also clears outstanding self-explanation prompt state, cancels pending Health notices, invalidates outstanding Health document/export access grants, and forces queued reminder/export jobs to re-check current consent and account `user_type` before any side effect
- route guards, service helpers, and RLS all resolve owner-only access from `created_by_user_id` rather than membership role heuristics
- Health mutations run only through server-side Health services/actions; direct browser Supabase writes are forbidden for Health current-state/history/audit tables
- detailed Health consent history does not reuse broader generic consent audit surfaces
- Health storage paths force/create a line DEK and never fall back to an account DEK for Health data
- a server-side Health feature flag exists and can fail closed across nav, routes, and telephony integrations

#### 1.4 Add Health nav, route shell, locked state, and first-visit flow

Files:

- `src/navigation.config.tsx`
- `src/app/dashboard/(app)/components/AppSidebarNavigation.tsx`
- `src/components/MobileAppNavigation.tsx`
- `src/core/ui/Sidebar.tsx`
- `src/lib/search/navigation-registry.ts`
- `src/components/SearchCommandPalette.tsx`
- `src/app/dashboard/(app)/health/page.tsx`
- `src/app/dashboard/(app)/health/loading.tsx`
- `src/app/dashboard/(app)/health/error.tsx`
- `src/app/dashboard/(app)/health/HealthProfilePageClient.tsx`
- `src/app/dashboard/(app)/health/lib/health-navigation.ts`
- `src/app/dashboard/(app)/health/components/HealthLockedState.tsx`
- `src/app/dashboard/(app)/health/components/HealthLineSelector.tsx`
- `src/app/dashboard/(app)/health/components/HealthDisclaimerDialog.tsx`
- `src/app/dashboard/(app)/health/components/HealthConsentCard.tsx`
- `src/app/dashboard/(app)/health/components/HealthEmptyState.tsx`
- `src/app/dashboard/(app)/health/components/HealthErrorState.tsx`
- `src/lib/ultaura/sharing-gate.ts`

Requirements:

- R1-R11
- R57
- R167
- R153
- R34-R47
- R178

Dependencies:

- 1.3

Acceptance criteria:

- canonical owners can navigate to Health
- all non-owner users, including viewers and other non-primary organization members, are denied from Health navigation and route access
- Health nav visibility and route loaders resolve owner-only access from `ultaura_accounts.created_by_user_id`, not viewer/non-viewer role heuristics
- locked plans see only the locked landing with no counts/details
- locked plans do not show suggestion badges, counts, or any other health-derived metadata
- first visit shows disclaimer and records acknowledgement
- a persistent About Health Profile entry point remains available after acknowledgement
- a material disclaimer/policy version change forces re-acknowledgement before normal Health detail views resume
- the first-visit disclaimer copy matches the PRD v1 text exactly:
  - `Important: Ultaura is not a doctor or medical professional. Health information stored here is for personal reference and, with your permission, to help Ultaura provide more informed companionship. Ultaura may make mistakes. Always consult qualified healthcare providers for medical advice, diagnosis, or treatment.`
- multi-line accounts require explicit first selection and then remember last-used line
- `?line=` uses `lines.short_id`, and URL state wins over any remembered line state
- the first empty state shows the PRD setup order explicitly: Conditions -> Medications -> Documents -> Observations
- top-level Health nav and Suggestions tab badge rules work only when Health is unlocked
- failed Health consent re-prompt attempts show a clear cooldown/denial reason to the owner
- Health consent card shows an owner-only consent-history preview (newest first) and that preview is absent from broader privacy/consent surfaces
- Health tab navigation follows the Alerts/Privacy responsive pattern and is verified usable at 375px
- at 375px, Health tab selection collapses into the PRD mobile dropdown pattern rather than relying on full-width desktop tab chrome

#### 1.5 Add instrumentation for first view, disclaimer, and consent request timing

Files:

- `src/lib/ultaura/health/account-state.ts`
- `src/lib/ultaura/health/consent.ts`
- analytics/instrumentation hooks in Health route components

Requirements:

- R18
- R41
- R135

Dependencies:

- 1.4

Acceptance criteria:

- first Health visit is measurable
- disclaimer acknowledgement is measurable
- first and last Health consent request timestamps are measurable

#### 1.6 Lay down Health-bearing export visibility and authenticated download foundations

Files:

- `supabase/migrations/2026MMDD000005_health_profile_export_hardening.sql`
- `src/lib/ultaura/privacy.ts`
- `src/lib/ultaura/health/export.ts`
- `src/app/dashboard/(app)/privacy/components/sections/ExportSection.tsx`
- `src/app/api/privacy/exports/[requestId]/download/route.ts`
- `telephony/src/services/exports.ts`
- `telephony/src/scheduler/recording-deletion.ts`

Requirements:

- R127
- R144
- R147
- R151
- R159
- R163
- R179
- R182

Dependencies:

- 1.1
- 1.2

Acceptance criteria:

- Health-bearing export row visibility is classified owner-only at request creation time
- Health-bearing export row visibility is classified through an immutable request-time visibility class and scope snapshot
- Health inclusion is automatic whenever request-time scope detects Health data; there is no owner-facing include/exclude toggle
- the Phase 1.6 export migration is table-safe at Phase 1 timing and references only Health tables created by `000001`
- Health-bearing exports do not expose persisted raw `download_url` links
- the privacy UI has an explicit owner-authenticated download path for Health-bearing exports
- non-owner members cannot list or download Health-bearing exports
- request-time export visibility is driven by an immutable visibility class and requested-scope snapshot, not a mutable post-processing flag
- immutable visibility/scope classification is DB-enforced through trigger logic, not app checks alone
- the export writer no longer persists `download_url` for Health-bearing exports
- the export writer persists actual artifact path, extension, and content type for Health-bearing ZIPs
- the export cleanup scheduler understands Health-bearing ZIP artifacts and expires/cleans them correctly
- Health-bearing export artifact cleanup TTL is explicitly 24 hours in scheduler/config, regardless of broader legacy export retention defaults
- the export writer and cleanup flow both honor `invalidated_at`
- legacy broad export policies are dropped/replaced for Health-aware export visibility before the Health flag can be enabled
- Phase 1.6 is foundation-only for classification/authenticated access and artifact metadata persistence; document/observation export detection is wired later by `000003` and `000004`, and full Health dataset composition and final ZIP contract are completed in Phase 7.1

### Phase 2: Core Profile, Conditions, Medications, and Suggestions

Purpose:

- deliver the main owner-facing Health Profile experience with safe structured CRUD and reviewable AI suggestions

#### 2.0 Add medical autocomplete provider wrappers and API contracts

Files:

- `src/lib/ultaura/health/autocomplete.ts`
- `src/app/api/health/autocomplete/conditions/route.ts`
- `src/app/api/health/autocomplete/medications/route.ts`
- `packages/types/src/health.ts`
- `packages/schemas/src/health.ts`

Requirements:

- R58-R68
- R150

Dependencies:

- Phase 1

Acceptance criteria:

- condition autocomplete uses ICD-10-CM / Clinical Tables through a server-side wrapper
- medication autocomplete uses RxTerms / RxNorm-backed search through a server-side wrapper
- plain-text fallback remains available when autocomplete is unavailable or unhelpful

#### 2.1 Implement Conditions domain and UI

Files:

- `src/lib/ultaura/health/conditions.ts`
- `src/app/dashboard/(app)/health/components/HealthConditionsTab.tsx`
- `src/app/dashboard/(app)/health/components/HealthConditionForm.tsx`
- `src/app/dashboard/(app)/health/components/HealthHistoryDrawer.tsx`

Requirements:

- R58-R64
- R119-R120

Dependencies:

- Phase 1
- 2.0

Acceptance criteria:

- conditions can be created, edited, resolved, deleted, and viewed in history
- approximate dates round-trip without precision loss
- Monitoring stays inside Active with a visible badge/filter

#### 2.2 Implement Medications domain and UI

Files:

- `src/lib/ultaura/health/medications.ts`
- `src/app/dashboard/(app)/health/components/HealthMedicationsTab.tsx`
- `src/app/dashboard/(app)/health/components/HealthMedicationForm.tsx`
- `src/app/dashboard/(app)/health/components/HealthHistoryDrawer.tsx`

Requirements:

- R65-R68
- R84-R85
- R119-R120

Dependencies:

- Phase 1
- 2.0

Acceptance criteria:

- medications can be created, edited, status-changed, deleted, and viewed in history
- linked condition / reason contract is preserved exactly
- duplicate warning paths work

#### 2.3 Implement shared Suggestions queue domain logic

Files:

- `src/lib/ultaura/health/suggestions.ts`
- `src/app/dashboard/(app)/health/components/HealthSuggestionsTab.tsx`
- `src/app/dashboard/(app)/health/components/HealthHistoryDrawer.tsx`

Requirements:

- R48-R57
- R161
- R108-R109
- R112
- R113-R115
- R119-R120

Dependencies:

- 2.1
- 2.2

Acceptance criteria:

- suggestions show the allowed review-card fields only
- suggestion filters for Conditions / Medications work and preserve queue counts correctly
- approve as new / approve as update / dismiss all work
- stale pending suggestions are removed from the active queue when owners manually edit the underlying item
- badges show count only and disappear when Health is locked

#### 2.4 Finalize dashboard-only pending suggestion surfacing

Files:

- `src/lib/ultaura/health/suggestions.ts`
- `src/app/dashboard/(app)/health/HealthProfilePageClient.tsx`
- `src/app/dashboard/(app)/health/components/HealthSuggestionsTab.tsx`

Requirements:

- R113-R118

Dependencies:

- 2.3

Acceptance criteria:

- pending suggestion notifications are dashboard-only in v1
- dashboard detail is normalized and quote-free
- no trusted-contact routing occurs

### Phase 3: Reminder Integration and Isolation

Purpose:

- safely connect medications to the existing reminder engine without leaking medication information across current reminder surfaces

#### 3.1 Create reminder integration migration

Files:

- `supabase/migrations/2026MMDD000002_health_profile_reminder_integration.sql`
- `supabase/tests/database/health-profile-reminders.test.sql`

Requirements:

- R69-R83
- R128-R129
- R142
- R146

Dependencies:

- Phase 2

Acceptance criteria:

- reminder `source_context` and stacked `pause_sources` exist
- medication-reminder link table exists
- active link uniqueness is enforced with partial uniqueness (`deleted_at is null`) so relink flows are valid
- DB invariants enforce `source_context='health_profile' => delivery_method='outbound_call'` and block linking general reminders into Health
- DB-enforced read isolation exists for `ultaura_reminders` and `ultaura_reminder_events` so non-owner/shared-account read paths cannot surface `source_context='health_profile'` rows/events
- `health_manual_resume_required` exists and is used when a blocker clears but the reminder must remain paused until explicit owner resume
- DB tests cover limit/count behavior for paused Health reminders
- DB tests cover scheduler claim/delivery exclusion for ineligible or consent-blocked Health reminders
- migration replaces `enforce_reminder_limit()` with Health-aware counting that excludes only paused Health-linked reminders and preserves existing generic reminder behavior

#### 3.2 Implement Health reminder linking service

Files:

- `src/lib/ultaura/health/reminders.ts`
- `src/app/dashboard/(app)/health/components/HealthMedicationReminderPanel.tsx`
- `src/lib/ultaura/reminder-events.ts`

Requirements:

- R69-R85
- R164
- R173

Dependencies:

- 3.1

Acceptance criteria:

- owners can create/manage multiple linked reminders per medication
- reminders are call-only
- no delivery happens before consent
- pre-created reminders stay paused until manual resume even after the first `not_requested -> granted` transition
- blockers that clear without an owner resume convert into `health_manual_resume_required` rather than auto-resuming the reminder
- manual resume fails cleanly if resuming would exceed current reminder limits
- pause/cancel/manual-resume rules work exactly as specified
- existing general reminders are not reclassified into Health-linked reminders in v1
- Health reminder writes fail closed if encrypted reminder storage is unavailable; plaintext fallback is forbidden for `health_profile` reminders

#### 3.3 Harden dashboard, search, insights, and admin reminder surfaces against Health leakage

Files:

- `src/lib/ultaura/reminders.ts`
- `src/app/dashboard/(app)/reminders/page.tsx`
- `src/app/dashboard/(app)/reminders/RemindersPageClient.tsx`
- `src/app/dashboard/(app)/reminders/components/ReminderActivity.tsx`
- `src/app/dashboard/(app)/page.tsx`
- `src/components/ultaura/InProgressCallBanner.tsx`
- `src/app/dashboard/(app)/lines/[lineId]/page.tsx`
- `src/app/dashboard/(app)/lines/[lineId]/LineDetailClient.tsx`
- `src/app/dashboard/(app)/lines/[lineId]/components/CallActivityList.tsx`
- `src/app/api/search/route.ts`
- `src/lib/ultaura/call-utils.ts`
- `src/lib/ultaura/insights.ts`
- `src/lib/ultaura/usage.ts`
- `src/app/dashboard/(app)/insights/components/CallMetrics.tsx`
- `src/lib/ultaura/admin/timeline-aggregator.ts`
- `src/lib/ultaura/admin/timeline-redaction.ts`

Requirements:

- R74-R78
- R82-R83
- R128-R129
- R139
- R146
- R147
- R173
- R179

Dependencies:

- 3.2

Acceptance criteria:

- Health-linked reminders are forbidden outside Health surfaces in v1 by default
- generic reminder reads, reminder activity/history, home cards, and line detail counts do not leak Health-derived reminder detail
- dashboard search, insights, usage, export composition, and admin timeline surfaces do not leak Health-linked reminder content or counts
- in-progress call banners and generic call-status UI do not leak Health-linked reminder/call labels
- call history labels do not expose Health-linked reminder behavior
- no fallback rendering of Health-linked reminders outside Health is part of v1

#### 3.4 Harden telephony reminder tools, scheduler, and export paths against Health leakage

Files:

- `telephony/src/routes/tools/set-reminder.ts`
- `telephony/src/routes/tools/list-reminders.ts`
- `telephony/src/routes/tools/pause-reminder.ts`
- `telephony/src/routes/tools/resume-reminder.ts`
- `telephony/src/routes/tools/cancel-reminder.ts`
- `telephony/src/routes/tools/edit-reminder.ts`
- `telephony/src/routes/tools/snooze-reminder.ts`
- `telephony/src/routes/tools/reminder-tool-helpers.ts`
- `telephony/src/scheduler/call-scheduler.ts`
- `telephony/src/services/exports.ts`

Requirements:

- R74-R78
- R82-R83
- R128-R129
- R139
- R146
- R147
- R173

Dependencies:

- 3.3

Acceptance criteria:

- generic reminder exports exclude Health-linked reminders in v1
- generic voice reminder tools exclude Health-linked reminders
- generic `set_reminder` paths cannot create `source_context='health_profile'` rows and cannot fall back to plaintext for Health-linked reminder writes
- scheduler/runtime surfaces do not leak Health-linked reminders
- scheduler claim/delivery logic re-checks Health eligibility and consent before delivering Health-linked reminders
- scheduler claim/delivery logic also re-checks current account `user_type` and canonical-owner-aligned Health state so queued jobs created before a self->family conversion cannot deliver under stale assumptions
- generic reminder plaintext fallback paths are blocked for `source_context='health_profile'` rows

### Phase 4: AI / Telephony Integration

Purpose:

- wire Health into calls only through explicit, narrow, consent-safe paths

Delivery note:

- Treat Phase 4 as two gated sub-phases:
  - Phase 4A = consent capture and Health context wiring (`4.0`-`4.2`)
  - Phase 4B = suggestion submission, privacy suppression, and immediate shutdown behavior (`4.3`-`4.6`)
- Phase 4B must not begin until Phase 4A is working end-to-end in a live call path.

#### 4.0 Add family-managed spoken Health consent capture

Files:

- `packages/prompts/src/tools/definitions.ts`
- `packages/prompts/src/profiles/index.ts`
- `packages/prompts/src/golden/sections/health-consent.ts`
- `telephony/src/routes/tools/voice-consent.ts`
- `telephony/src/services/privacy.ts`
- `telephony/src/websocket/media-stream.ts`
- `telephony/src/websocket/grok-bridge.ts`

Requirements:

- R12-R27
- R136-R137
- R154
- R155
- R183
- R184

Dependencies:

- Phase 1

Acceptance criteria:

- family-managed calls can explicitly capture Health `granted` / `denied` through spoken consent tooling
- spoken consent tooling uses explicit `grant_health_consent`, `deny_health_consent`, and `revoke_health_consent` paths
- dashboard re-prompt requests do not bypass the senior
- owner-request timing and spoken-prompt timing are stored separately
- spoken Health grant does not activate Health behavior until the next call
- self-managed Health opt-in remains dashboard-driven and does not depend on this spoken path
- self-managed users may request an optional spoken explanation for a future call without changing consent state
- spoken Health consent prompts follow the live call language when supported, with English fallback otherwise
- preview/test calls do not persist Health consent state/history or any other durable Health side effects while exercising the spoken-consent path
- spoken-consent routes reject mismatched `lineId` / `callSessionId` combinations before reading or writing Health state

#### 4.1 Build app internal Health context endpoint

Files:

- `src/lib/ultaura/health/call-notices.ts`
- `src/lib/ultaura/health/conditions.ts`
- `src/lib/ultaura/health/medications.ts`
- `src/app/api/telephony/health/context/route.ts`

Requirements:

- R20-R21
- R28-R30
- R166
- R157
- R106-R112
- R184

Dependencies:

- Phase 1
- Phase 2
- 4.0

Acceptance criteria:

- telephony receives only compact approved Health context
- pending suggestions and documents are excluded
- pending next-call verbal notices are included in safe phrasing
- medication context uses only normalized structured medication fields approved for call context, never raw caregiver-authored free text
- observation context returns an empty array until Phase 6.3 lands
- self-managed optional spoken explanation requests produce next-call non-state-changing prompt state without altering consent state, and the request/last-prompted timestamps are persisted so the explanation is spoken once per outstanding request
- the context endpoint rejects mismatched `lineId` / `callSessionId` combinations before returning any Health data

#### 4.2 Build telephony Health context client and prompt wiring

Files:

- `telephony/src/services/health-context.ts`
- `packages/prompts/src/profiles/index.ts`
- `telephony/src/websocket/media-stream.ts`
- `telephony/src/websocket/grok-bridge.ts`

Requirements:

- R20-R21
- R106-R112
- R138
- R175-R176

Dependencies:

- 4.1

Acceptance criteria:

- calls may fetch prompt/notices state for eligible family-managed lines before consent is granted, but structured Health arrays stay empty until consent and eligibility allow call-side use
- pending suggestions never enter prompt context
- spoken prompt/notice text is generated in the live call language when supported, with English fallback otherwise
- Health context fetch uses a 3-second timeout with at most one retry during call setup
- context-fetch timeout/error paths fail closed (no structured Health context, no Health tools) while the call continues

#### 4.3 Add Health suggestion candidate tool path

Files:

- `packages/prompts/src/tools/definitions.ts`
- `telephony/src/routes/tools/queue-health-suggestion.ts`
- `telephony/src/services/health-suggestions.ts`
- `src/app/api/telephony/health/suggestions/route.ts`
- `telephony/src/utils/event-sanitizer.ts`

Requirements:

- R31-R33
- R48-R57
- R157
- R108-R109
- R145
- R177
- R183
- R184

Dependencies:

- 2.3
- 4.2

Acceptance criteria:

- telephony can submit narrow structured candidates
- app side decides `queued` vs `noop_duplicate` vs `noop_blocked` vs `no_update_target`
- no raw transcripts or quotes are ever persisted
- same-call suppression can retroactively block already-buffered or already-persisted same-call Health suggestion rows before post-call processing completes
- update-mode candidates that do not resolve to a deterministic valid target return `no_update_target` and persist nothing
- suggestion routes reject mismatched `lineId` / `callSessionId` combinations before dedupe or persistence logic runs
- preview/test calls do not persist Health suggestion candidates or downstream Health metrics/events

#### 4.4 Add private-disclosure capture and suppression core

Files:

- `packages/prompts/src/tools/definitions.ts`
- `packages/prompts/src/golden/sections/privacy-policy.ts`
- `packages/prompts/src/golden/sections/insights.ts`
- `packages/prompts/src/golden/sections/tool-policy.ts`
- `telephony/src/routes/tools/mark-health-disclosure-private.ts`
- `telephony/src/routes/tools/mark-topic-private.ts`
- `telephony/src/routes/tools/mark-private.ts`
- `telephony/src/services/health-privacy-state.ts`
- `telephony/src/routes/tools/log-health-mention.ts`
- `telephony/src/routes/tools/log-call-insights.ts`
- `telephony/src/services/call-session.ts`
- `packages/prompts/src/golden/sections/health-wellness.ts`

Requirements:

- R31-R33
- R110-R111
- R132-R133
- R143
- R145
- R158
- R183
- R184

Dependencies:

- 4.2

Acceptance criteria:

- "don't tell my family / keep this private" can suppress Health suggestions
- health-specific private-disclosure tooling wins over generic privacy tools when the current disclosure is health-adjacent
- generic privacy tool routes (`mark_topic_private`, `mark_private`) invoke the same durable Health suppression behavior whenever the disclosure is health-adjacent
- if the privacy request comes after earlier same-call Health mention or suggestion persistence/buffering, the already-written same-call health-mention and suggestion rows are durably marked suppressed and all downstream artifacts are blocked before alert processing completes
- post-call suppression is applied before `processWellnessAlertsForCall()` or any other family-facing alert/insight fanout step
- implementation does not assume existing wellness plumbing already satisfies this
- private-disclosure routes reject mismatched `lineId` / `callSessionId` combinations before any suppression write or downstream fanout suppression runs
- preview/test calls do not persist Health suppression markers or other durable Health side effects while exercising the private-disclosure flow

#### 4.5 Harden downstream readers, delivery routes, and observability against suppressed Health disclosures

Files:

- `telephony/src/services/insights.ts`
- `telephony/src/services/weekly-summary.ts`
- `src/app/api/telephony/weekly-summary/route.ts`
- `telephony/src/services/wellness-alerts.ts`
- `src/app/api/telephony/wellness-alerts/route.ts`
- `src/lib/ultaura/alerts.ts`
- `src/lib/ultaura/alert-fanout.ts`
- `src/lib/ultaura/alerts-redaction.ts`
- `src/lib/ultaura/insights.ts`
- `src/app/dashboard/(app)/alerts/AlertsPageClient.tsx`
- `telephony/src/utils/event-sanitizer.ts`
- `telephony/src/utils/logger.ts`
- `telephony/src/observability/tracing.ts`
- `src/core/logger.ts`
- `src/core/sentry/capture-api-exception.ts`

Requirements:

- R31-R33
- R110-R111
- R132-R133
- R143
- R145
- R149
- R165
- R158

Dependencies:

- 4.4

Acceptance criteria:

- the same suppression path blocks health-mention-derived wellness alerts unless urgent safety applies
- the same suppression path blocks call-insights concerns, follow-up reasons, and weekly summaries that would otherwise expose the disclosure to family
- weekly-summary delivery routes and recipient selection enforce the same suppression rules before any email/send path executes
- alert fanout and recipient resolution enforce the same suppression rules before any family-facing delivery executes
- v1 uses whole-call health-adjacent suppression for aggregated insights/weekly-summary readers when per-concern provenance is unavailable
- the urgent-safety bypass is tied to the existing urgent safety / verification boundary, not ordinary health-mention severity alone
- if the privacy request comes after earlier same-call Health mention or suggestion persistence/buffering, the already-written same-call health-mention and suggestion rows are durably marked suppressed and all downstream artifacts are blocked before alert processing completes
- urgent safety outcomes from private disclosures use only the existing urgent safety / verification boundary audiences and do not broaden to viewers or trusted contacts through Health-specific logic
- tool/event sanitizer coverage is updated for every new Health tool route so allowlist-based logging does not leak uncategorized payloads
- Sentry, OTel, and logger redaction rules explicitly exclude decrypted Health fields, document filenames/titles, and summary paraphrases from routine logs/traces/errors

#### 4.6 Wire Health consent changes and immediate call-side shutdown behavior

Files:

- `telephony/src/services/call-session.ts`
- `telephony/src/services/privacy.ts`
- `packages/prompts/src/profiles/index.ts`
- `src/app/api/telephony/health/notices/delivered/route.ts`

Requirements:

- R20-R27
- R136-R137
- R155
- R169
- R183
- R184

Dependencies:

- 4.2
- 4.4

Acceptance criteria:

- in-call denial/revocation disables further Health usage for the remainder of the call
- Health suggestion tool use stops immediately after in-call revocation/denial
- in-call grant does not retroactively inject Health into the current realtime session; Health becomes available on the next call only
- delivered pending call notices are acknowledged back to the app only after they were actually spoken
- spoken consent capture, prompt timing, and immediate shutdown behavior remain consistent within the same live session
- mid-call deny/revoke is enforced through session-local Health-disabled state that blocks further Health context use, Health tool invocation, and suggestion creation for the rest of that call
- session-local gating is the required and authoritative shutdown mechanism; realtime prompt refresh is an additional mitigation, not the primary enforcement primitive
- if Health context was already injected into the realtime session, telephony sends a `session.update` / prompt refresh that removes Health context from active instructions for the remainder of the call
- if that realtime prompt refresh fails, the call still fails closed through session-local gating and outbound-response guards for the rest of the call
- outbound assistant responses after deny/revoke must be guarded so they do not reference previously injected Health context for the remainder of that call
- post-revoke Health tool calls must return deterministic failures (`health_context_unavailable`) so runtime behavior is consistent and testable
- notice-delivered acknowledgement and any other Health route that receives both `lineId` and `callSessionId` reject mismatched combinations before mutating durable Health state

### Phase 5: Documents

Purpose:

- add secure document storage without weakening line-scoped encryption or leaking metadata

#### 5.1 Create documents migration and storage contract

Files:

- `supabase/migrations/2026MMDD000003_health_profile_documents.sql`
- `supabase/tests/database/health-profile-rls.test.sql`

Requirements:

- R86-R95
- R162
- R130-R131
- R126

Dependencies:

- Phase 1

Acceptance criteria:

- document and document-access-log tables exist
- the `ultaura-health-documents` storage bucket is created by migration before any upload route is enabled
- metadata protection rules are encoded in schema/service contracts
- the documents migration replaces the export-classification helper functions so active Health documents are counted only after `ultaura_health_documents` exists
- the chosen deployment/runtime path for document upload is explicitly verified to support the 25 MB multipart upload ceiling before upload implementation proceeds

#### 5.2 Implement encrypted upload/finalize/delete flow

Files:

- `src/lib/ultaura/health/documents.ts`
- `src/lib/ultaura/health/document-access.ts`
- `src/app/api/health/documents/[documentId]/access-token/route.ts`
- `src/app/api/health/documents/upload/route.ts`
- `src/app/dashboard/(app)/health/components/HealthDocumentsTab.tsx`
- `src/app/dashboard/(app)/health/components/HealthDocumentUpload.tsx`

Requirements:

- R86-R95

Dependencies:

- 5.1

Acceptance criteria:

- upload creates an `uploading` draft, finalizes to `active`, and marks `failed` on interrupted or partial failure
- stale `uploading` rows auto-transition to `failed` after 24 hours, and stale `failed` rows are cleaned after 30 days with orphaned-blob cleanup
- HEIC is allowed, with download fallback when inline preview is unavailable
- unsupported file types and oversize files fail safely
- owner-driven document delete hard-deletes both the encrypted blob and the document row immediately while preserving only allowed Health history
- opaque access-token storage exists before preview/download launch
- documents support category filtering and upload-date / document-date sort without exposing decrypted metadata to non-owner surfaces
- production rollout keeps Health feature flag fail-closed for document surfaces until Phase 7 export/deletion hardening is complete

#### 5.3 Implement preview/download routes with app-signed access

Files:

- `src/app/api/health/documents/[documentId]/access-token/route.ts`
- `src/app/api/health/documents/[documentId]/preview/route.ts`
- `src/app/api/health/documents/[documentId]/download/route.ts`
- `src/lib/ultaura/health/document-access.ts`

Requirements:

- R91-R95

Dependencies:

- 5.2

Acceptance criteria:

- token issuance/refresh is explicit and owner-bound
- token storage is opaque, server-stored, single-purpose, and revocable on owner/document/line changes
- preview/download token transport uses POST body submission, not query params
- encrypted objects are decrypted server-side and streamed
- access events log only minimal allowed fields
- no raw storage signed URL or decrypted metadata leaks to logs
- preview/download responses explicitly set no-store/no-cache/nosniff headers

#### 5.4 Add bulk document/blob cleanup hooks immediately

Files:

- `src/lib/ultaura/health/deletion.ts`
- `src/lib/ultaura/privacy.ts`
- `src/lib/server/user/delete-user.ts`
- `src/lib/server/organizations/delete-organization.ts`
- `src/lib/ultaura/lines.ts`
- `telephony/src/scheduler/recording-deletion.ts`

Requirements:

- R121-R125
- R152

Dependencies:

- 5.1

Acceptance criteria:

- privacy-center deletion calls Health document/blob cleanup as soon as document storage exists
- full user/org deletion calls Health document/blob cleanup as soon as document storage exists
- line deletion calls Health document/blob cleanup as soon as document storage exists
- blob cleanup completes before the owning line/account/org row delete is allowed to cascade away Health document rows
- document blobs are not left orphaned between Phase 5 and Phase 7
- stale `uploading` rows, expired document access tokens, and failed-upload cleanup have an explicit scheduler owner in v1 and are not left as implicit future work

### Phase 6: Observations

Purpose:

- ship the observation log safely as dashboard-first data with tightly limited post-consent call use

#### 6.1 Create observations migration and service

Files:

- `supabase/migrations/2026MMDD000004_health_profile_observations.sql`
- `src/lib/ultaura/health/observations.ts`
- `src/lib/ultaura/health/history.ts`

Requirements:

- R96-R105
- R174
- R126

Dependencies:

- Phase 1

Acceptance criteria:

- observation CRUD and history work
- category filtering and recent sorting work
- the observations migration replaces the export-classification helper function so non-deleted observations are counted only after `ultaura_health_observations` exists

#### 6.2 Implement Observations UI

Files:

- `src/app/dashboard/(app)/health/components/HealthObservationsTab.tsx`

Requirements:

- R96-R105

Dependencies:

- 6.1

Acceptance criteria:

- pre-consent state is clearly labeled as private dashboard-only
- no reminder-offer, alert, or insights controls appear
- self-managed canonical owners can use Observations in v1 with the same owner-only storage and call-side consent boundaries

#### 6.3 Add post-consent observation subset to call context

Files:

- `src/lib/ultaura/health/observations.ts`
- `src/app/api/telephony/health/context/route.ts`

Requirements:

- R101-R103
- R106

Dependencies:

- 4.1
- 6.1

Acceptance criteria:

- exactly 3 most recent observations are included after consent
- the observation subset uses the documented deterministic recency/tie-break order from Section 7.9 and excludes deleted rows
- observations never feed alerts, insights, or pattern detection

### Phase 7: Export, Deletion, and Audit Hardening

Purpose:

- close the lifecycle risks around owner-only exports, deletion correctness, storage cleanup, and Health/compliance boundary clarity

#### 7.1 Harden export visibility and include Health datasets

Files:

- `src/lib/ultaura/privacy.ts`
- `src/lib/ultaura/health/export.ts`
- `telephony/src/services/exports.ts`
- `telephony/src/scheduler/recording-deletion.ts`
- `telephony/src/routes/internal/exports.ts`
- `src/app/dashboard/(app)/privacy/components/sections/ExportSection.tsx`
- `src/app/dashboard/(app)/privacy/lib/privacy-formatters.ts`
- `src/app/dashboard/(app)/privacy/hooks/useExportPolling.ts`
- `src/app/api/privacy/exports/[requestId]/download/route.ts`
- `src/app/api/privacy/exports/[requestId]/health-bundle/route.ts`
- `src/app/api/privacy/exports/[requestId]/health-document-bytes/[documentId]/route.ts`
- `src/lib/ultaura/admin/timeline-aggregator.ts`
- `src/lib/ultaura/admin/timeline-redaction.ts`

Requirements:

- R6
- R126-R127
- R139
- R144
- R147
- R151
- R159
- R163

Dependencies:

- Phases 2, 3, 5, 6
- 1.6

Acceptance criteria:

- Health datasets appear in exports
- Phase 7.1 is where full Health dataset composition/manifest ZIP contract becomes authoritative; it must not be treated as optional follow-up to Phase 1.6
- pending suggestions remain excluded from Health export in v1
- any export containing Health data is requestable, visible, and downloadable only by the canonical Health owner
- Health-linked reminders remain excluded from Health export in v1
- Health export inclusion is automatic whenever request-time scope detects Health data
- Health-bearing exports materialize as ZIP artifacts with a JSON manifest and original document files
- Health ZIP layout is fixed as `health/manifest.json` plus `health/documents/`
- Health document bytes are streamed through app-internal export byte routes; `internalBytePath` is never a temp-file path or signed URL
- Health-bearing export access is owner-only on internal/admin/support surfaces by default
- locked-plan owner export still works
- app-side `health/export.ts` is the sole owner of Health dataset composition and Health document decryption access, while telephony `exports.ts` is the sole owner of artifact assembly, storage, and expiry cleanup
- telephony `exports.ts` receives Health manifest JSON and app-generated internal document byte paths only through the internal `health-bundle` route, not by re-implementing Health dataset composition or fetching line DEKs directly
- duplicate original filenames are made collision-safe through deterministic exported filenames while original filenames remain preserved in the manifest
- actual artifact path, extension, and content type are persisted for Health-bearing export cleanup
- Health-bearing export artifacts expire after 24 hours
- export request and download UI clearly indicate that Health-bearing artifacts download as ZIP files even when the requested format was JSON-oriented
- any pre-existing ready Health-bearing export rows with persisted `download_url` are invalidated or migrated to the authenticated-download path before the Health flag is enabled

#### 7.2 Centralize Health deletion and storage cleanup

Files:

- `src/lib/ultaura/health/deletion.ts`
- `src/lib/ultaura/privacy.ts`
- `supabase/migrations/2026MMDD000006_health_owner_transfer_backfill.sql`
- `src/lib/server/user/delete-user.ts`
- `src/lib/server/organizations/delete-organization.ts`
- `src/app/admin/organizations/[uid]/actions.server.ts`
- `src/lib/organizations/actions.ts`
- `src/lib/memberships/mutations.ts`
- `src/lib/ultaura/lines.ts`
- `telephony/src/services/exports.ts`

Requirements:

- R121-R125
- R140-R141
- R152
- R156
- R180-R181

Dependencies:

- Phases 2, 3, 5, 6
- 1.6

Acceptance criteria:

- privacy-center account deletion removes Health data and doc blobs
- full user/org deletion removes Health data and doc blobs
- line deletion removes line Health data and doc blobs
- `requestAccountDataDeletion`, `delete-user`, and `delete-organization` all call the same centralized Health cleanup/invalidation entrypoint; no duplicate flow-specific Health cleanup logic remains
- document/blob cleanup runs before destructive line/account/org row deletion steps that would otherwise orphan storage objects
- Health-bearing export rows are marked `invalidated_at` before deletion cleanup proceeds
- any in-flight Health-bearing export artifact, document access token, or other Health download grant is invalidated immediately when deletion or owner-change processing begins
- export artifact cleanup deletes orphaned Health-bearing storage objects even when DB row deletion/transition happened earlier
- canonical-owner change resets disclaimer state, pending notices, and Health-bearing export ownership to the new owner
- self-managed to family-managed conversion invalidates outstanding Health export/download access grants and clears pending self-managed explanation state before any later family-managed call-side use
- every ownership-transfer flow that intends to change the Health owner, including admin and user-facing transfer paths, also updates `ultaura_accounts.created_by_user_id`
- the `000006` ownership migration explicitly patches SQL-level ownership-transfer helpers/RPCs so membership-role transfer cannot bypass canonical owner mutation
- ownership transfer that changes the Health owner is transactional and ordered:
  - validate the target owner and required membership/org preconditions first
  - update `ultaura_accounts.created_by_user_id`
  - invalidate prior-owner Health export/download grants and reset fresh-owner Health state
  - commit membership-role changes only after the canonical owner mutation succeeds
  - if any Health ownership step fails, the transfer rolls back and the prior canonical owner remains authoritative
- ownership-backfill conflict policy is deterministic:
  - if `created_by_user_id` is null and an account has exactly one active owner membership, backfill aligns `created_by_user_id` to that owner
  - if `created_by_user_id` is non-null and matches the single active owner membership, backfill leaves it unchanged
  - if `created_by_user_id` conflicts with active owner membership state, or an account has zero or multiple active owner memberships, backfill does not guess; it records a conflict for manual remediation and keeps Health launch fail-closed for that account until resolved
- pre-launch ownership verification query/report exists and confirms Health-eligible accounts have canonical owner state consistent with `created_by_user_id` after backfill/remediation
- unresolved canonical-owner conflicts keep Health fail-closed for the account (no Health route access and no Health-bearing export access grants) until remediation is complete

#### 7.3 Finalize Health history / compliance boundary

Files:

- `src/lib/ultaura/health/history.ts`
- `src/lib/ultaura/privacy.ts`

Requirements:

- R119-R124
- R141
- R147

Dependencies:

- Phases 2, 5, 6

Acceptance criteria:

- Health history is visible only through Health surfaces
- preview/download access logs stay out of user-facing history
- compliance logs are not used as a backdoor Health history surface
- Health document access logs delete with Health data according to the v1 rule
- admin/internal timeline surfaces do not surface Health-bearing call-event payloads or Health-only export metadata by default
- the minimum surviving non-Health compliance footprint for Health operations is explicitly limited to generic operational fields such as account id, line id, request id, event type, actor id, timestamps, and success/failure status; Health content and decrypted metadata never survive there

### Phase 8: Launch Cleanup, Packaging Alignment, and QA

Purpose:

- align public copy, finalize instrumentation, and run the launch-quality verification required for a sensitive feature

#### 8.1 Update public plan and packaging copy

Files:

- `src/app/(site)/faq/faq-data.ts`
- `src/lib/ultaura/plan-features.ts`
- public pricing/plan rendering files as needed

Requirements:

- R134

Dependencies:

- Phase 1

Acceptance criteria:

- public plan messaging no longer implies Health is available on all plans
- public copy does not position Health as available on Care or Free Trial
- public copy does not position Health Profile as a care hub or clinical platform

#### 8.2 Instrument success metrics

Files:

- `src/lib/ultaura/health/account-state.ts`
- `src/lib/ultaura/health/analytics.ts`
- `src/lib/ultaura/health/reporting.ts`
- `src/lib/ultaura/health/consent.ts`
- `src/lib/ultaura/health/conditions.ts`
- `src/lib/ultaura/health/medications.ts`
- `src/lib/ultaura/health/suggestions.ts`
- launch reporting queries/dashboards owned by the Health reporting layer

Requirements:

- R18
- R135
- R171

Dependencies:

- Phases 1-7

Acceptance criteria:

- the PRD's activation, consent conversion, precision, privacy-incident, and return-usage metrics are measurable
- persisted metric anchors exist before launch:
  - `ultaura_health_account_state.first_viewed_at`
  - `ultaura_health_account_state.last_viewed_at`
  - `ultaura_health_account_state.first_item_created_at`
  - `ultaura_health_line_consent.health_first_consent_requested_at`
  - `ultaura_health_line_consent.health_consent_at`
- explicit instrumentation exists for at least:
  - `health_profile_first_view`
  - `health_item_created`
  - `health_consent_requested`
  - `health_consent_granted`
  - `health_suggestion_reviewed`
  - `health_profile_revisit`
- privacy/support incident rate has a defined source of truth before launch:
  - support incidents tagged `health_privacy`
  - security incidents tagged `health_privacy`
  - a reporting query that joins these incident feeds by account/time window
- if those tagged incident feeds live outside this repo, the external system of record and export/query path must be written into the launch runbook; this spec does not require building a new incident tracker in-product
- `src/lib/ultaura/health/reporting.ts` is the canonical owner of in-repo metric definitions, launch-report query outputs, and any repo-resident joins/adapters for incident inputs; if the tagged incident feeds stay external, the system-specific dashboard/query may live outside this repo, but the feed contract and runbook path must still be documented and reviewed before launch
- `health_profile_revisit` means any later Health page view after the first recorded Health view for that account
- reporting queries are explicitly defined, not implied:
  - activation = account first Health view to first Health item created within 30 days
  - consent conversion = first owner-requested consent event to granted consent
  - precision = reviewed Health suggestions by approve/dismiss outcome
  - return usage = account revisit after first Health view
  - privacy incident rate = tagged support/security incidents over Health-enabled accounts
- analytics/observability payloads for Health events use an explicit allowlist only:
  - allowed: anonymous event name, account id, line id, entity type/id, coarse status/result codes, timestamps
  - forbidden: decrypted Health text, titles/filenames, notes, summary paraphrases, token values, internal storage paths
- reporting queries/dashboards exist for those launch metrics before release
- Phase 8 is not complete until those metric queries/dashboards are reviewed and runnable against staging/production-shaped data

#### 8.3 Full QA hardening

Files:

- all changed code and test files

Requirements:

- all

Dependencies:

- Phases 1-7

Acceptance criteria:

- mobile 375px flows verified
- owner/viewer/locked-plan behavior verified
- export/deletion/reminder privacy seams verified
- public pricing/FAQ/plan copy shipped in its final Health-accurate state
- privacy/terms/support-facing copy changes reviewed and signed off before launch
- final launch checklist explicitly verifies reminder, export, alert, insights, weekly-summary, search, and internal-surface leak paths

---

## 13. Edge Cases and Error Handling

### 13.1 Entitlement and Access

- If the account is on an eligible `plan_id` but `status = 'trial'`, Health must remain locked.
- If any non-owner user manually navigates to `/dashboard/health`, the route must server-deny, not just render an empty state.
- If the canonical owner changes only at membership level and not `created_by_user_id`, Health access must not silently transfer.

### 13.2 Consent

- If a family owner re-requests consent before 30 days, the dashboard must fail cleanly and explain the cooldown.
- If the dashboard has requested a re-prompt but Ultaura has not yet asked during a call, requested and prompted timestamps must remain distinct.
- If a denied or revoked family-managed line has reached the 30-day cooldown, the owner may request another spoken Health prompt.
- If Health consent is denied or revoked mid-call, telephony must stop further Health prompt use and suggestion creation for the rest of that call through session-local fail-closed gating and outbound-response guards that prevent references to previously injected Health context; v1 does not rely on realtime prompt replacement.
- If Health consent is granted mid-call for a family-managed line, Health remains off for the rest of that call and becomes available on the next call only.
- If a self-managed user turns on Health in the dashboard, the consent state becomes `granted` immediately without a separate verbal call prompt.
- Self-managed lines may transition only between `not_requested`, `granted`, and `revoked`; `denied` is reserved for family-managed spoken declines.
- If a self-managed account upgrades to family-managed, each line's Health consent resets to `not_requested`, Health-linked reminders pause, and future call-side Health use must wait for fresh spoken senior consent.
- If a self-managed account upgrades to family-managed, outstanding self-managed explanation requests are cleared, pending Health notices are canceled, outstanding Health document/export access grants are invalidated, and queued reminder/export jobs must re-check current account `user_type`, consent, and canonical owner before side effects.
- Detailed Health consent state/history must remain absent from the existing privacy page and other broader consent surfaces unless those surfaces are explicitly rebuilt as owner-only.

### 13.3 Suggestions

- If the owner manually edits a condition while a matching suggestion is open in another tab, review submission must fail with a refresh-and-review-again message rather than silently overwrite.
- If a suggestion targets an item that was deleted before review, the review UI must fall back to approve-as-new or dismiss; it must not error with an unusable stale target.
- If a similar suggestion already exists pending, app-side dedupe should no-op rather than add queue noise.

### 13.4 Conditions and Medications

- Similar-name checks must still warn on common alias collisions like brand vs generic meds where standardized autocomplete did not resolve both names.
- Approximate dates must round-trip without converting `2023` into `2023-01-01` in the UI.
- If a medication links to a condition that is later soft-deleted, Health reads and forms must treat the link as null and let the owner re-link it explicitly.

### 13.5 Documents

- If the blob upload succeeds but draft-row finalization fails, keep the row in `failed` state and surface retry/delete actions; do not expose a half-saved active document.
- If metadata save succeeds but storage upload fails, mark `failed` and allow cleanup/retry.
- If preview fails because the browser cannot render HEIC, fall back to download without marking the document broken.
- If download/preview token expires, the client should request a fresh token; do not reuse expired access grants.
- If a preview/download stream is interrupted after response headers are committed, the token is still considered spent; the client must request a fresh token instead of resuming or replaying the old one.
- If a canonical owner change happens before a pending download/preview grant is used, the old owner's grant must no longer authorize access.
- If a document is deleted by the owner, its storage object must be hard-deleted immediately and must no longer be exportable or previewable.

### 13.6 Observations

- Observations entered pre-consent must remain excluded from AI systems until consent is granted; once consent is granted, the current app-side context rules may consider the eligible recent subset regardless of whether the observations were created before or after consent.
- Significant Concern is a display concern level only in v1; it does not create alerts.

### 13.7 Health-Linked Reminders

- If a medication time changes and reminder updates partially fail, leave the medication edit intact and surface partial-success messaging with manual reminder fix actions.
- If a plan downgrade happens while a reminder delivery job is being claimed, the job must re-check Health eligibility before delivery.
- If consent is later re-granted, paused Health reminders do not auto-resume.
- No outside-Health reminder fallback is part of v1, even under shared-engine constraints; if a future product/legal/privacy decision requires one, it must be added only through a separate approved spec revision.
- If a reminder is manually paused and then Health consent is revoked, manual resume later must not clear the Health-system pause source.

### 13.8 Export and Deletion

- If an export request is already processing when account deletion starts, deletion wins and the export file must be deleted or invalidated.
- If line deletion occurs before export processing completes, deleted-line Health data must not remain in the final export artifact.
- Health-bearing export rows must not be visible to non-owner organization members even if the export processor has already created a file.
- If the canonical owner changes, pending Health-bearing export visibility must move to the new owner only; the old owner must not retain access through stale row visibility or stale access grants.
- Health-bearing exports always download through an owner-authenticated application route; persisted raw storage URLs remain unavailable for those rows.
- If automatic Health inclusion causes an export to become owner-only, non-owner members must receive a generic owner-only unavailable message and must not be told whether Health data caused the restriction.

### 13.9 Same-Call Privacy Suppression

- If the senior says "keep this private" after an earlier same-call Health disclosure already created a buffered or persisted suggestion candidate, or an alertable health-mention artifact, those artifacts must be marked suppressed before post-call processing finishes.
- If an earlier same-call health mention or suggestion row was already written before the privacy request, that row must be marked suppressed or excluded from all downstream alert, insight, weekly-summary, queue, and export processing before the call finalizes.
- If the same call also contains a genuine urgent safety event, only the urgent safety path may bypass suppression; the ordinary Health Profile and health-mention family-notification paths remain blocked.

---

## 14. Testing and Verification

Monorepo prerequisite:

- run `pnpm build:packages` before `pnpm tsc --noEmit` so shared package outputs/types are current during verification

### 14.1 Required Automated Coverage

Database:

- owner-only Health RLS
- owner-only Health consent state/history isolation
- viewer denial
- DB-enforced read isolation on shared `ultaura_reminders` and `ultaura_reminder_events` for `source_context='health_profile'`
- reminder limit logic with paused Health reminders
- Health-bearing export visibility rules
- deletion cleanup coverage
- account/line consistency triggers for duplicated foreign-key context

App/server:

- entitlement checks
- `created_by_user_id`-based nav/route owner gating
- locked-plan-safe badge/count absence on owner-facing loaders where counts are computed server-side
- consent transitions and cooldown
- requested-vs-prompted consent timing
- owner-only consent-history preview behavior and broad-surface exclusion
- disclaimer acknowledgement and version re-ack
- approximate-date regex and calendar validation
- duplicate detection and merge/update suggestions
- suggestion `dedupe_key` and `material_evidence_key` construction
- stale suggestion invalidation
- autocomplete provider wrappers and plain-text fallback
- app-side `summaryParaphrase` sanitization
- deterministic `ownerSafeSummary` minimization
- deterministic medication context ordering/tie-break at the 10-item cap
- deterministic 3-observation recency ordering/tie-break
- no outside-Health reminder fallback in v1; generic reminder reads fail closed for `source_context='health_profile'`
- document metadata encryption and minimal access logging
- dashboard home, line detail, search, insights, in-progress call banner, and admin timeline reminder leak closure
- weekly-summary route recipient filtering and suppression
- export invalidation when deletion begins
- owner-authenticated Health export download route
- document access-token issuance, refresh, expiry, and owner binding

Telephony:

- family-managed spoken Health consent capture
- Health context fetch may occur pre-consent for prompt/notices state, but structured arrays remain empty until consent and entitlement allow
- private-disclosure suppression blocks suggestions and health-mention alerts
- private-disclosure suppression also blocks call-insights concerns, follow-up reasons, and weekly summaries
- pending suggestions excluded from prompt context
- symptoms remain in existing health-mention flow
- generic voice reminder tools exclude Health-linked reminders
- same-call retroactive privacy suppression works before post-call alert/suggestion handling, including already-persisted same-call health mentions
- mid-call grant waits until the next call while deny/revoke shuts off immediately

End-to-end:

- owner on eligible plan can use Health
- owner on ineligible plan sees locked landing only
- viewer never sees Health
- multi-line explicit first selection works and persists last-used line
- Health-linked reminders do not appear in generic reminders UI, dashboard home, line detail counts, in-progress call banner, or admin reminder timelines
- document preview/download works for allowed owner only
- admin ownership transfer updates the canonical owner primitive before Health access changes

### 14.2 Manual Verification Checklist

1. Eligible family owner with one line:
   - Health nav visible
   - first visit disclaimer appears
   - Conditions tab default when no suggestions
2. Eligible family owner with pending suggestions:
   - Suggestions tab becomes default
   - badge count appears on nav and tab only
3. Viewer account:
   - Health nav hidden
   - direct route denied
4. Trial account on `comfort`:
   - Health locked
   - no counts/badges/details
5. Locked account export:
   - owner can still request export
   - non-owner cannot view/download health-bearing export
   - Health-bearing export downloads through owner-authenticated app route, not raw `download_url`
6. Medication-linked reminder:
   - call-only copy visible
   - no SMS option
   - generic Reminders page does not leak message content
   - dashboard home, line detail counts, dashboard search, insights, call history, in-progress call banner, admin timeline, and voice reminder tools do not leak Health-linked reminders
7. Privacy override:
   - "keep this private" prevents Health suggestion
   - if a same-call suggestion row was already persisted before the privacy request, it is suppressed and disappears from queue/export surfaces
   - same call does not produce health-mention alert unless urgent safety threshold is hit
   - the same disclosure does not appear later through concerns, follow-up reasons, or weekly summary content
8. Documents:
   - upload progress and retry
   - preview/download only for owner
   - access logs exclude metadata
   - owner delete hard-deletes stored blob and document row immediately
9. Deletion:
   - privacy-center deletion removes Health rows and documents
   - full org deletion removes Health rows and documents
   - line deletion removes Health rows and documents
10. Family-managed consent:
   - spoken Health consent can be granted or denied during a call
   - dashboard re-prompt request does not itself change consent state
   - denied/revoked family-managed lines can be re-requested after the 30-day cooldown
   - spoken grant applies on the next call only; deny/revoke takes effect immediately
   - Health consent history preview is visible only to the canonical owner inside Health and sorted newest-first
   - Health consent state/history do not surface through broader privacy-page tables
11. Autocomplete and line state:
   - `?line=` uses the line `short_id`
   - last-used line is remembered in local storage keyed by account id, but URL state wins when present
   - condition and medication autocomplete still allow plain-text fallback
12. Ownership transfer:
   - admin transfer updates `created_by_user_id` before Health ownership changes
13. Deterministic call-context selection:
   - when more than 10 qualifying medications exist, the same call-context medication set/order is returned across repeated fetches
   - observation subset is exactly 3 rows using the documented deterministic recency/tie-break order

### 14.3 Definition of Done

Health Profile is not done when the main dashboard page works.

It is done only when:

- all requirement IDs in Section 4 are mapped to implemented code
- all phases through Phase 8 are complete or explicitly cut with written approval
- no user-visible production rollout occurs until Phase 1 through Phase 8 launch gates pass; partial phase deployments must keep the Health feature flag fail-closed
- PRD and spec remain aligned
- reminder, export, alert, and deletion leak paths are verified closed

---

## 15. Launch Dependencies

These items are required for launch readiness, even though they are not all part of core CRUD implementation:

Implementation-freeze governance note: unless explicitly reclassified in Section 18 as a true blocker, Section 15 items and related product/legal sign-off tracking are treated as External Operational Dependencies for implementation freeze (still required before launch).

1. Public plan/FAQ/pricing copy reflects Health availability accurately.
2. A server-side Health feature flag / kill switch with DB-backed runtime source of truth and env-var fallback is verified to hide the Health nav, deny Health routes, and block telephony Health context/suggestion/reminder paths without redeploying code.
3. The chosen deployment/runtime path for document upload is verified to support the 25 MB multipart ceiling before documents ship.
4. Internal support/support-ops notes explain:
   - owner-only access
   - call-only Health reminders
   - locked-plan preservation behavior
   - export rules
   - no Health break-glass data access in v1 and the escalation path when support needs owner-provided screenshots/session repro
5. Privacy and legal copy are reviewed if product-language changes are needed around storing structured health data and encrypted document uploads.
6. Security review explicitly checks:
   - owner-only route guarding
   - owner-only Health consent storage and history isolation
   - RLS on Health tables
   - Health-bearing export visibility
   - private-disclosure suppression across wellness alerts, call insights, and weekly summaries
   - document access token expiry and non-reusability
   - document access token TTL = 5 minutes and Health export artifact TTL = 24 hours
   - document metadata minimization in logs
7. Ownership-transfer backfill/remediation is complete before Health rollout:
   - pre-launch verification report has zero unresolved owner conflicts for Health-enabled accounts
   - `created_by_user_id` is confirmed as the canonical owner source of truth for all Health-enabled accounts
8. Ownership-backfill verification/remediation must also run before owner-only Health QA in staging:
   - accounts with unresolved owner conflicts stay Health-disabled/fail-closed during QA
   - no owner-gated Health QA sign-off is valid until the verification report is clean for the tested accounts

---

## 16. Out of Scope

The following are explicitly out of scope for this build:

- structured symptoms as first-class Health entities
- vitals
- AI document parsing
- legal document storage inside Health
- multi-user Health access beyond the canonical owner
- observation-driven reminders
- observation-driven alerts / insights / pattern detection
- health advice, diagnosis, interpretation, or medication guidance
- automatic reminder resume after consent re-grant or plan re-eligibility
- making existing exports broader owner-only beyond the Health-bearing export requirement

---

## 17. Recommended Build Order Summary

This engineering build order intentionally reorders some PRD Section 17 items for safety and dependency reasons. The PRD remains the product source of truth; this section exists to prevent implementation teams from landing privacy-sensitive work in the wrong sequence.

Implementation-freeze note:

- This reordered implementation sequence and the v1 engineering constraints recorded in this section are the frozen engineering baseline for implementation.
- Any change to those decisions requires an explicit spec revision.

Recorded user/spec-owner clarifications from this review thread:

- self-managed -> family-managed upgrades reset Health consent to `not_requested`
- Health may only create/manage reminders that are born as Health-linked in v1
- document preview/download uses POST requests with the opaque access token in the request body
- the runtime kill switch is DB-backed with env-var fallback
- document access token TTL is 5 minutes and Health export artifact TTL is 24 hours
- self-managed canonical owners may use Observations in v1

These thread-level clarifications are incorporated into the sign-off record below.

Section 17 sign-off and governance record:

- status: implementation-freeze ready for engineering scope; launch approvals (product/legal/privacy) tracked separately and required before launch, not automatic implementation-freeze blockers
- recorded-by: Joseph Silvagnoli (spec owner for this review thread)
- last-updated: March 14, 2026
- decision source: this Health spec review thread
- recorded engineering decision scope:
  - reordered export work
  - 10-med context cap
  - 3-second Health context timeout with one retry during call setup
  - 5-minute document access token TTL
  - 24-hour Health export artifact TTL
  - upload/token rate limits defined in this spec
  - whole-call suppression for aggregated readers
  - immutable request-time Health export classification / scope snapshot for Health-bearing exports
  - owner-authenticated ZIP download path for Health-bearing exports with no persisted raw `download_url`
  - stacked reminder pause sources
  - no outside-Health reminder fallback in v1
  - session-local mid-call revoke gating as the authoritative shutdown mechanism, with best-effort realtime prompt refresh as a secondary mitigation
  - fresh-owner reset semantics for owner-bound Health state
  - DB-backed runtime kill switch with env-var fallback
- required before launch sign-off is considered complete:
  - product sign-off record (name + date + decision artifact link/reference)
  - legal/privacy sign-off record (name + date + decision artifact link/reference)
- governance note: PRD Section 17 reorder-signoff is implementation-frozen for engineering execution based on the recorded decisions above; launch cannot proceed until the product/legal/privacy records are completed.

1. Foundation and entitlement work must land first. Without owner-only RLS, locked-plan gating, and Health consent primitives, every later phase risks leaking data.
2. Health-bearing export visibility and authenticated download foundations land with the foundation work, because the current broad export path is not a safe default for owner-only Health data.
3. Core profile CRUD and suggestion review come next. That gives a usable owner-only dashboard record before we touch call behavior.
4. Reminder integration comes before telephony Health context because reminder leakage is the biggest shared-surface risk outside exports.
   - No owner-visible or telephony-enabled Health rollout may occur after Phase 3 unless Phase 4 privacy suppression and weekly-summary closure are also complete; the Health feature flag must remain off until both phases are done.
5. Telephony integration comes only after the app-side Health source of truth is stable and privacy suppression reaches insights/weekly-summary paths.
6. Documents come after the core structured data because encrypted storage and decrypt-and-stream access are a self-contained security-heavy slice.
7. Observations come after telephony context wiring because they intentionally reuse the same compact-context path.
8. Final export/deletion/audit dataset hardening comes after the data model is complete so inclusion rules are implemented once, not repeatedly.
9. Launch cleanup and QA are a real phase, not a tail-end chore. Packaging mismatches and privacy regressions are launch blockers.

---

## 18. Implementation Freeze Governance

### Spec Freeze Criteria

- No unresolved privacy leak paths remain in-spec.
- No unresolved access-control contradictions remain in-spec.
- No unresolved schema or lifecycle contradictions remain in-spec.
- Every high-risk surface has an explicit implementation owner/task in this document, including owner-only access, reminder isolation, same-call suppression, export/download hardening, ownership transfer, document lifecycle, and runtime feature-flag gating.
- Open launch approvals (product/legal/privacy) remain tracked, but are not automatic implementation-freeze blockers.
- All remaining findings must fit into `Accepted v1 Tradeoffs`, `Non-blocking Cleanup`, or `External Operational Dependency`; only issues classified as `Blocker` in `Final Blocking Issues` can stop implementation freeze.

### Accepted v1 Tradeoffs

- 10-medication call-context cap.
- Health context fetch timeout is 3 seconds with at most one retry (fail-closed if unavailable).
- Document access token TTL is 5 minutes.
- Health-bearing export artifact TTL is 24 hours.
- Whole-call suppression is used for aggregated readers when per-concern provenance is unavailable.
- UTC fallback is used when line timezone is missing/invalid (observedDate and timesOfDay interpretation).
- No break-glass admin/support Health data access in v1.
- Session-local mid-call shutdown gating is authoritative; realtime prompt refresh is best-effort mitigation.
- Health-linked reminders are excluded from v1 Health export scope.
- No outside-Health reminder fallback in v1; only reminders born as Health-linked are managed by Health.
- Health-bearing exports use an owner-authenticated ZIP download path with a JSON manifest/original files model rather than persisted raw `download_url` access.
- The runtime kill switch is DB-first with env fallback and fails closed if neither source is available.
- Pre-created or previously blocked Health-linked reminders remain paused until explicit manual resume after the blocking condition is cleared.

### Known Residual Risks

- Runtime dependency risk if kill-switch DB source or fallback env configuration is misconfigured.
- Operational risk in ownership-backfill/remediation timing before rollout.
- Suppression/read-model coupling risk where non-Health aggregate readers must stay aligned with suppression semantics.

### Final Blocking Issues

- None remain in this spec revision; blocker categories are resolved in-spec and remaining items are operational launch dependencies or non-blocking cleanup.
- Current codebase gaps that review prompts may continue to rediscover are already assigned as implementation work in Sections 7.1B, 7.12, 7.14-7.16, 8.8, and Section 12 Phases 1.6, 3.3, 3.4, 4.4, 4.5, 5.2, 5.3, 7.1, and 7.2. They are implementation scope, not unresolved spec blockers.

### Review Triage Rule

- Future generic fact-check/review output is candidate input only.
- Every reported issue must be bucketed exactly into one of: `Blocker`, `Accepted v1 Tradeoff`, `Non-blocking Cleanup`, or `External Operational Dependency`.
- Treat a finding as `Blocker` only if it is a real privacy leak path, a real access-control contradiction, a real schema/lifecycle contradiction, a missing implementation owner for a live leak surface, a requirement ambiguity that would realistically cause two teams to build different behavior, or a codebase mismatch that makes this spec unsafe to implement as written.
- Do not classify wording improvements, style complaints, speculative future risks, governance commentary, or code gaps that are already explicitly assigned by this spec as `Blocker` unless they create one of the blocker conditions above.
