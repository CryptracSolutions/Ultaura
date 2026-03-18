---
name: ultaura-security-review
description: |
  Ultaura-specific security review for backend changes. Grounded in
  OWASP Top 10, SOC 2 controls, and HIPAA considerations. Produces
  risk-rated findings (Critical/High/Medium/Low).

  Use this skill when:
  - Reviewing new or modified API routes
  - Reviewing database migrations or RLS policy changes
  - Reviewing auth changes or permission modifications
  - Any backend change during the delegation workflow

  Does NOT cover: Safety system integrity (AI classifier, heuristics,
  keyword scanning, verification gate) — that is governed separately
  by the non-negotiable principles in CLAUDE.md.
---

## 1. Scope

**This skill covers:**
- API route security (authentication, authorization, input validation)
- Database migration review (RLS, encryption, naming, rollback safety)
- Encryption compliance (AES-256-GCM, two-layer key hierarchy, AAD binding)
- Privacy controls (consent verification, existence disclosure, token management)
- Input validation (MIME types, magic bytes, UUID validation, timing-safe comparisons)
- Compliance mapping (OWASP Top 10, SOC 2, HIPAA)

**This skill does NOT cover:**
- Safety system integrity (AI classifier + heuristics + keyword scanning + verification gate)
- Frontend-only changes with no backend impact
- Infrastructure/deployment configuration
- Third-party service configuration (Stripe, Twilio, xAI)

---

## 2. When to Run

Only during the delegation workflow for backend changes. Specifically:
- New or modified API routes (`src/app/api/` or telephony routes)
- New or modified database migrations (`supabase/migrations/`)
- Changes to auth logic, RLS policies, or permission checks
- Changes to encryption utilities (`src/lib/ultaura/crypto-*.ts`)
- Changes to consent or privacy logic (`src/lib/ultaura/health/consent.ts`, `src/lib/ultaura/sharing-gate.ts`)
- New input paths that accept user data

---

## 3. Review Checklist

Work through all seven categories. Each has a detailed reference file.

### Category 1: Encryption
Full checks: [references/encryption-checks.md](references/encryption-checks.md)

- All sensitive data uses AES-256-GCM via `crypto-dek.ts` — never inline `crypto.createCipheriv()`
- Two-layer key hierarchy: KEK wraps DEK. Account-level and line-level DEKs.
- AAD binds ciphertext to `account_id` + `line_id` + `type`
- Health data uses line DEK only — no account DEK fallback
- `import 'server-only'` on all files in `src/lib/ultaura/`
- Fresh random 12-byte IV per encryption call

### Category 2: RLS (Row-Level Security)
Full checks: [references/rls-checks.md](references/rls-checks.md)

- Every new table: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- At least one RLS policy scoped to account ownership
- Policies use `(select auth.uid())` not bare `auth.uid()` (Supabase lint 0003)
- All `SECURITY DEFINER` functions have `SET search_path = public`
- Use helpers `is_ultaura_account_owner()` and `can_access_ultaura_health_line()`
- Health tables have `enforce_health_account_line_consistency()` trigger

### Category 3: API Authentication
Full checks: [references/api-auth-checks.md](references/api-auth-checks.md)

- Browser routes: `supabase.auth.getUser()` first (not `getSession()`)
- Application-level ownership: `created_by_user_id === userId`
- Internal/telephony routes: `validateWebhookSecret()` with `crypto.timingSafeEqual`
- Admin routes: JWT `app_metadata.role === 'super-admin'`
- Server-side only: `getSupabaseRouteHandlerClient()` from `src/lib/server/`

### Category 4: Input Validation
Full checks: [references/input-validation-checks.md](references/input-validation-checks.md)

- File uploads: MIME allowlist + extension match + magic bytes + size cap + rate limit
- UUID params: validate with `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`
- Secret/token comparisons: `crypto.timingSafeEqual` (not `===`)
- AI-generated content: `sanitizeSummaryParaphrase()` from `src/lib/ultaura/health/sanitize.ts`
- No `dangerouslySetInnerHTML` without sanitization

### Category 5: Privacy
Full checks: [references/privacy-checks.md](references/privacy-checks.md)

- Sensitive routes return 404 (not 403) to prevent existence disclosure
- Document tokens: 5-minute TTL, single-use, stored as SHA-256 hash, 30/hour rate limit
- Privacy export: owner-only access, generic error messages
- Redirect URLs validated as `https:` before issuing
- No PII in error messages, logs, or client-side state

### Category 6: Consent
Full checks: [references/consent-checks.md](references/consent-checks.md)

- Health data only flows when `health_consent === 'granted'`
- `requireHealthLineAccess()` and `requireHealthOwner()` are the central gates
- Every consent mutation writes audit entry to `ultaura_health_consent_history` (encrypted)
- Re-prompt cooldown: 30 days for family-managed accounts
- Entitlement gate: feature flag (fail-closed) + plan eligibility check
- Health data excluded from sharing gate — uses its own consent mechanism

### Category 7: Database Migration
Full checks: [references/db-migration-checks.md](references/db-migration-checks.md)

- Naming: `YYYYMMDDHHMMSS_snake_case_description.sql`
- Every new table: `ENABLE ROW LEVEL SECURITY` + at least one policy
- Sensitive columns: `encrypted_data` + `encrypted_data_key` (or health-specific payload columns)
- Migrations are idempotent (`IF NOT EXISTS`) and have a safe rollback path
- No destructive operations without explicit user confirmation
- `SET search_path = public` on all `SECURITY DEFINER` functions

---

## 4. Output Format

```
## Security Review: [area/file(s) reviewed]

### Findings

| # | Severity | Category | Finding | File:Line | Recommendation |
|---|----------|----------|---------|-----------|----------------|
| 1 | CRITICAL | Encryption | Inline crypto.createCipheriv() instead of using crypto-dek.ts | src/lib/foo.ts:42 | Use encryptPayload() from crypto-dek.ts |
| 2 | HIGH | RLS | New table missing RLS policy | migrations/20260317_foo.sql:15 | Add owner-scoped SELECT policy |
| 3 | MEDIUM | API Auth | Using getSession() instead of getUser() | src/app/api/foo/route.ts:8 | Switch to getUser() for server-side verification |
| 4 | LOW | Input | Missing length cap on user-provided string | src/app/api/foo/route.ts:25 | Add maxLength validation |

### Severity Definitions

- **CRITICAL**: Exploitable now — data exposure, auth bypass, or encryption failure. Must fix before merge.
- **HIGH**: Likely exploitable under specific conditions — missing RLS, weak auth, timing attack vector. Must fix before merge.
- **MEDIUM**: Defense-in-depth gap — not directly exploitable but weakens security posture. Should fix.
- **LOW**: Best practice deviation — minimal immediate risk but worth addressing. Consider fixing.

### Summary

- **Total findings**: N
- **Critical**: N | **High**: N | **Medium**: N | **Low**: N
- **Recommendation**: PASS / PASS WITH CONDITIONS / FAIL

PASS = No Critical or High findings
PASS WITH CONDITIONS = No Critical, but High findings exist with documented mitigation plan
FAIL = Any Critical finding, or 3+ unmitigated High findings
```

---

## 5. OWASP Top 10 Mapping

| Ultaura Check Category | OWASP Category |
|------------------------|----------------|
| RLS, API Auth, Consent | **A01:2021 — Broken Access Control** |
| Encryption | **A02:2021 — Cryptographic Failures** |
| Input Validation | **A03:2021 — Injection** |
| Privacy, Consent, DB Migration | **A04:2021 — Insecure Design** |
| API Auth | **A07:2021 — Identification and Authentication Failures** |
| DB Migration | **A08:2021 — Software and Data Integrity Failures** |

---

## 6. SOC 2 Controls Mapping

| SOC 2 Control | Ultaura Check Categories |
|---------------|-------------------------|
| **CC6.1** — Logical Access Security | RLS, API Auth, Consent |
| **CC6.6** — System Boundaries | API Auth, Input Validation |
| **CC6.7** — Data Transmission/Movement | Encryption, Privacy |
| **CC7.2** — System Monitoring | Consent audit trail, access token logging |

---

## 7. HIPAA Considerations

Ultaura handles health-related data for seniors. Even if not yet a HIPAA covered entity, these controls align with HIPAA requirements:

| HIPAA Requirement | Ultaura Implementation |
|-------------------|----------------------|
| **Encryption at rest** (§164.312(a)(2)(iv)) | AES-256-GCM with per-line DEKs, two-layer key hierarchy |
| **Minimum necessary access** (§164.502(b)) | RLS policies scoped to account ownership, `requireHealthLineAccess()` gate |
| **Audit logging** (§164.312(b)) | Consent history table with encrypted audit entries |
| **Access controls** (§164.312(a)(1)) | Multi-layer auth: Supabase Auth → application ownership → RLS → consent gate → entitlement check |
| **Consent verification** (§164.508) | Four-state consent machine, DB-enforced state transitions, 30-day re-prompt cooldown |
