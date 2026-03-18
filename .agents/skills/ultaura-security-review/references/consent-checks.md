# Consent Checks

## What to Look For

### 1. Health Consent Gate
- ALL health data access must verify `health_consent === 'granted'`
- Central access functions:
  - `requireHealthLineAccess(lineId)` — combines: auth + ownership + feature flag + plan eligibility + consent
  - `requireHealthOwner(accountId)` — ownership + feature flag + plan eligibility
- **Reference**: `src/lib/ultaura/health/access.ts`
- **Pattern to flag**: Health data queries that bypass `requireHealthLineAccess()` or `requireHealthOwner()`

### 2. Four-State Machine
Valid states and transitions:
- `not_requested` → `granted` (self-managed) or `denied` / `granted` (family-managed)
- `granted` → `revoked` (by the senior themselves)
- `denied` → `granted` (after re-prompt, family-managed only)
- `revoked` → never transitions back automatically

DB enum enforces valid values. The trigger `enforce_health_consent_line_type_rules()` prevents:
- Self-managed lines from having `denied` status (they can only grant or revoke)

### 3. Audit Trail
- Every consent mutation must write to `ultaura_health_consent_history`
- Audit entries are encrypted (using the same encryption pattern)
- **Pattern to flag**: Consent state changes without audit entry, or unencrypted audit entries

### 4. Re-Prompt Cooldown
- Family-managed accounts: 30-day cooldown between consent re-prompts
- Enforced in application code: `requestHealthConsentRePrompt()`
- **Pattern to flag**: Re-prompt logic without cooldown check

### 5. Entitlement Gate
- Feature flag in DB: `ultaura_runtime_feature_flags` table, seeded as `false` (fail-closed)
- Plan eligibility: only `comfort`, `family`, `payg` plans qualify; trials are ineligible
- **Reference**: `src/lib/ultaura/health/entitlements.ts`
- **Pattern to flag**: Health features accessible without entitlement check, or new plans added without updating eligibility

### 6. Sharing Gate Exclusion
- Health profile data is explicitly EXCLUDED from the sharing gate (`src/lib/ultaura/sharing-gate.ts`)
- Health data has its own consent mechanism — it does not flow through sharing tiers
- **Pattern to flag**: Health data being checked against sharing tiers instead of health consent

## Common Violations

| Violation | Example | Fix |
|-----------|---------|-----|
| Bypassed consent | Direct DB query for health data without `requireHealthLineAccess()` | Use the access gate function |
| Missing audit | `updateConsent(lineId, 'granted')` without history entry | Add audit write in same transaction |
| No cooldown | Re-prompt logic without checking last prompt date | Add 30-day cooldown check |
| Wrong gate | Health data checked via `sharingGate.canView()` | Use health consent check instead |
