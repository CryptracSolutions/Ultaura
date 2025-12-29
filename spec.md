# Spec: Change Trial from 20 Minutes to 3 Days of Chosen Plan

## Summary

Transform Ultaura's trial system from a minute-based free trial (20 minutes on generic `free_trial` plan) to a time-based trial (3 days on any chosen paid plan with full features).

---

## Requirements

| Requirement | Value |
|-------------|-------|
| Plan Selection | During signup/onboarding flow |
| Trial Plans Available | Care, Comfort, Family, PAYG (all paid plans) |
| Trial Duration | 3 days from plan selection |
| Trial Access Level | Full plan features (all minutes + all lines of chosen plan) |
| PAYG Trial | Uncapped minutes (understand the risk) |
| Credit Card | NOT required upfront |
| After Trial Expires | Hard paywall - require payment to continue |
| Post-Trial Dashboard | Read-only (view history/settings, cannot make calls or add lines) |
| Billing Period Selection | Only when converting to paid (not during trial signup) |
| Existing User Migration | None needed (no active users) |

---

## Current State

### Trial System
- `free_trial` plan: 20 minutes, 1 line, 30-day window, hard stop
- Account starts with `status: 'trial'`, `plan_id: 'free_trial'`
- Minute limits enforced in telephony service (`line-lookup.ts`)
- Constants: `TRIAL_MINUTES: 20`, `TRIAL_DURATION_DAYS: 30`

### Signup Flow
1. User signs up at `/auth/sign-up` (Supabase auth)
2. Redirects to `/auth/callback` → `/onboarding`
3. Onboarding steps: **OrganizationInfoStep** → [OrganizationInvitesStep] → **CompleteOnboardingStep**
4. Creates organization, redirects to dashboard
5. **Ultaura account is NOT created during signup** - happens lazily later

---

## Implementation Plan

### Phase 1: Database Schema Changes

**New Migration File:** `/supabase/migrations/YYYYMMDD000001_trial_plan_system.sql`

Add columns to `ultaura_accounts`:
```sql
ALTER TABLE ultaura_accounts
ADD COLUMN trial_plan_id text,
ADD COLUMN trial_starts_at timestamptz,
ADD COLUMN trial_ends_at timestamptz;

CREATE INDEX idx_ultaura_accounts_trial_ends
ON ultaura_accounts(trial_ends_at)
WHERE status = 'trial' AND trial_ends_at IS NOT NULL;
```

Add helper functions:
```sql
-- Check if trial is active
CREATE FUNCTION is_ultaura_trial_active(p_account_id uuid) RETURNS boolean

-- Get effective plan (trial or actual)
CREATE FUNCTION get_effective_ultaura_plan(p_account_id uuid) RETURNS text
```

**Update:** `/src/lib/ultaura/constants.ts`
- Change `TRIAL_DURATION_DAYS: 30` to `TRIAL_DURATION_DAYS: 3`
- Remove `TRIAL_MINUTES: 20`
- Add `TRIAL_ELIGIBLE_PLANS: ['care', 'comfort', 'family', 'payg']`

**Update:** `/src/lib/ultaura/types.ts`
- Add to `UltauraAccount` and `UltauraAccountRow`:
  - `trialPlanId: PlanId | null`
  - `trialStartsAt: string | null`
  - `trialEndsAt: string | null`

---

### Phase 2: Onboarding Flow Changes

**Create:** `/src/app/onboarding/components/PlanSelectionStep.tsx`

New component for plan selection during onboarding:
- Display all trial-eligible plans (Care, Comfort, Family, PAYG)
- Show plan features, pricing info (for after trial)
- "3-day free trial" messaging
- "No credit card required" messaging
- Store selected `planId` in form state

Pattern to follow: `OrganizationInfoStep.tsx` for form structure, `PricingTable.tsx` for plan display.

**Update:** `/src/app/onboarding/components/OnboardingContainer.tsx`

```typescript
// Update STEPS array
const STEPS: Array<string> = enableTeamAccounts
  ? ['onboarding:info', 'onboarding:plan', 'onboarding:invites', 'onboarding:complete']
  : ['onboarding:info', 'onboarding:plan', 'onboarding:complete'];

// Update form defaultValues
defaultValues: {
  data: {
    organization: '',
    selectedPlanId: 'comfort' as PlanId, // Default to most popular
    invites: [] as Invite[],
  },
  currentStep: 0,
}

// Add handler
const onPlanStepSubmitted = useCallback(
  (planId: PlanId) => {
    form.setValue('data.selectedPlanId', planId);
    nextStep();
  },
  [form, nextStep],
);

// Add step rendering
<If condition={isStep(1)}>
  <PlanSelectionStep onSubmit={onPlanStepSubmitted} />
</If>
```

**Update:** `/src/app/onboarding/complete/route.ts`

```typescript
// Update schema
function getOnboardingBodySchema() {
  return z.object({
    organization: z.string().trim().min(1),
    selectedPlanId: z.enum(['care', 'comfort', 'family', 'payg']),
    invites: z.array(...),
  });
}

// After organization creation, create Ultaura account with trial
const now = new Date();
const trialEnds = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days
const plan = PLANS[body.selectedPlanId];

await client.from('ultaura_accounts').insert({
  organization_id: organizationId,
  name: organizationName,
  billing_email: session.user.email,
  created_by_user_id: userId,
  status: 'trial',
  plan_id: body.selectedPlanId,
  trial_plan_id: body.selectedPlanId,
  trial_starts_at: now.toISOString(),
  trial_ends_at: trialEnds.toISOString(),
  minutes_included: plan.minutesIncluded,
  cycle_start: now.toISOString(),
  cycle_end: trialEnds.toISOString(),
});
```

---

### Phase 3: Trial Enforcement Logic

**Update:** `/telephony/src/services/line-lookup.ts`

Replace minute-based trial check with time-based:

```typescript
// OLD (around line 114-117):
if (account.status === 'trial' && minutesRemaining <= 0) {
  return { allowed: true, minutesRemaining: 0 };
}

// NEW:
if (account.status === 'trial') {
  const trialExpired = account.trial_ends_at && new Date(account.trial_ends_at) < new Date();
  if (trialExpired) {
    return { allowed: false, reason: 'trial_expired' };
  }
  // Trial active - allow call (no minute cap during trial)
  return { allowed: true };
}
```

Add `'trial_expired'` to `LineAccessCheck.reason` type.

**Update:** `/telephony/src/services/metering.ts`

```typescript
// In determineBillableType function:
if (account.status === 'trial') {
  const trialActive = account.trial_ends_at && new Date(account.trial_ends_at) > new Date();
  if (trialActive) {
    return 'trial'; // No charge during trial
  }
}
// ... rest of existing logic
```

**Update:** `/telephony/src/routes/twilio-inbound.ts`

Add message for trial expired:
```typescript
const MESSAGES = {
  // ... existing
  TRIAL_EXPIRED: "Hello, your free trial has ended. To continue using Ultaura, please ask your family member to subscribe to a plan. Goodbye.",
};

// In rejection handler:
case 'trial_expired':
  message = MESSAGES.TRIAL_EXPIRED;
  break;
```

---

### Phase 4: Server Actions

**Update:** `/src/lib/ultaura/actions.ts`

Add new helper functions:

```typescript
// Check if trial is expired
export async function isTrialExpired(accountId: string): Promise<boolean>

// Get trial info for display
export async function getTrialInfo(accountId: string): Promise<{
  isOnTrial: boolean;
  trialPlanId: PlanId | null;
  trialEndsAt: string | null;
  daysRemaining: number;
} | null>

// Get effective plan (considers trial)
export async function getEffectivePlan(accountId: string): Promise<{
  planId: PlanId;
  minutesIncluded: number;
  linesIncluded: number;
  isTrialPlan: boolean;
}>
```

Update `createLine` to use effective plan for line limit checking.

---

### Phase 5: Post-Trial Read-Only Mode

**Create:** `/src/components/ultaura/TrialExpiredBanner.tsx`

```typescript
export function TrialExpiredBanner({ trialPlanName, organizationUid }) {
  // Red/warning banner with:
  // - "Your {plan} trial has ended"
  // - "Subscribe to continue making calls"
  // - "Choose a Plan" button → /dashboard/settings/subscription
}
```

**Create:** `/src/lib/hooks/useTrialStatus.ts`

```typescript
export function useTrialStatus(account) {
  // Returns: { isOnTrial, isExpired, daysRemaining, trialPlanId }
}
```

**Update dashboard pages for read-only mode:**

Files to update:
- `/src/app/dashboard/(app)/lines/page.tsx`
- `/src/app/dashboard/(app)/lines/components/LinesPageClient.tsx`
- `/src/app/dashboard/(app)/lines/[lineId]/page.tsx`

Changes:
1. Fetch trial status with account data
2. Show `TrialExpiredBanner` when trial expired
3. Pass `disabled={isTrialExpired}` prop to action components
4. Disable: "Add Line", "Test Call", schedule editing, reminder creation
5. Keep enabled: Call history viewing, line settings (view only), usage stats

---

### Phase 6: UI Updates

**Update:** `/src/components/ultaura/PricingTable.tsx`

```typescript
// Change trial banner (around line 259):
<span className="text-sm font-medium">
  3-day free trial on any plan - No credit card required
</span>

// Update button text from "Start for free" to "Start 3-day trial"
```

**Create:** `/src/components/ultaura/TrialStatusBadge.tsx`

Badge component showing trial status in dashboard header:
```typescript
export function TrialStatusBadge({ daysRemaining, planName }) {
  // Shows: "{Plan} trial - X days left"
  // Yellow/orange when <= 1 day remaining
}
```

**Update:** `/public/locales/en/onboarding.json`

Add translation keys:
```json
{
  "selectPlan": "Choose Your Plan",
  "selectPlanDescription": "Start with a 3-day free trial. No credit card required.",
  "plan": "Plan"
}
```

---

## Files to Modify (Summary)

### Database
- `supabase/migrations/YYYYMMDD000001_trial_plan_system.sql` (CREATE)

### Types & Constants
- `src/lib/ultaura/constants.ts` (MODIFY)
- `src/lib/ultaura/types.ts` (MODIFY)

### Onboarding
- `src/app/onboarding/components/PlanSelectionStep.tsx` (CREATE)
- `src/app/onboarding/components/OnboardingContainer.tsx` (MODIFY)
- `src/app/onboarding/complete/route.ts` (MODIFY)

### Telephony Enforcement
- `telephony/src/services/line-lookup.ts` (MODIFY)
- `telephony/src/services/metering.ts` (MODIFY)
- `telephony/src/routes/twilio-inbound.ts` (MODIFY)

### Server Actions
- `src/lib/ultaura/actions.ts` (MODIFY)

### UI Components
- `src/components/ultaura/TrialExpiredBanner.tsx` (CREATE)
- `src/components/ultaura/TrialStatusBadge.tsx` (CREATE)
- `src/components/ultaura/PricingTable.tsx` (MODIFY)
- `src/lib/hooks/useTrialStatus.ts` (CREATE)

### Dashboard Pages
- `src/app/dashboard/(app)/lines/page.tsx` (MODIFY)
- `src/app/dashboard/(app)/lines/components/LinesPageClient.tsx` (MODIFY)
- `src/app/dashboard/(app)/lines/[lineId]/page.tsx` (MODIFY)

### i18n
- `public/locales/en/onboarding.json` (MODIFY)

---

## Implementation Order

1. Database migration (schema changes)
2. Types and constants updates
3. PlanSelectionStep component (new)
4. OnboardingContainer updates (add step)
5. Onboarding complete route (create trial account)
6. Telephony enforcement (line-lookup.ts, metering.ts, twilio-inbound.ts)
7. Trial helper actions (actions.ts)
8. TrialExpiredBanner + useTrialStatus hook (new)
9. Dashboard pages (read-only mode)
10. PricingTable + TrialStatusBadge (UI updates)
11. i18n translations

---

## Testing Checklist

- [ ] New user signup → plan selection step appears
- [ ] Account created with `trial_plan_id`, `trial_ends_at` set correctly (3 days)
- [ ] During trial: calls work, no minute limits, full plan line limits apply
- [ ] Trial countdown badge shows in dashboard
- [ ] After 3 days: calls rejected with "trial_expired" reason
- [ ] Post-trial: dashboard shows banner, action buttons disabled
- [ ] Post-trial: can still view call history, settings (read-only)
- [ ] Upgrade flow: pricing page works, checkout creates subscription
- [ ] PAYG trial: verify uncapped minutes work
