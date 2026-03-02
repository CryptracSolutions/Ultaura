# Ultaura 2FA System Upgrade - Implementation Specification

**Date:** 2026-03-02
**Status:** Final
**Revision Date:** 2026-03-02
**Author:** User

Ultaura's current two-factor authentication system supports only TOTP (authenticator app) codes via Supabase Auth's native MFA API. This specification details the upgrade to add SMS-based phone MFA, a setup nudge banner for users who haven't enabled 2FA, and a trusted-device mechanism that lets users skip MFA challenges on recognized devices for 30 days. It also addresses the user's request for email-based MFA, which Supabase does not support natively, and provides alternative recommendations.

---

## 1. Goal

Add SMS-based two-factor authentication as a second MFA method alongside TOTP, encourage all users to enable 2FA through a dismissible dashboard banner, and reduce login friction for returning users via a cryptographically signed trusted-device cookie that bypasses MFA challenges for 30 days. Together, these changes strengthen account security while keeping the experience smooth for families and caregivers.

---

## 2. Current State

The existing 2FA system is built entirely on Supabase Auth's native MFA API, supporting only TOTP (authenticator app) factors.

| Component           | File                                                                                                       | Purpose                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Enrollment modal    | `src/app/dashboard/(app)/settings/profile/components/MultiFactorAuthSetupModal.tsx`                        | QR code flow using `client.auth.mfa.enroll({ factorType: 'totp' })`                    |
| Login challenge     | `src/app/auth/components/MultiFactorChallengeContainer.tsx`                                                | Prompts user for TOTP code using `client.auth.mfa.challengeAndVerify()`                |
| Verify page wrapper | `src/app/auth/verify/components/VerifyFormContainer.tsx`                                                   | Wraps `MultiFactorChallengeContainer` for the `/auth/verify` route                     |
| Session guard       | `src/core/session/utils/check-requires-mfa.ts`                                                             | Checks AAL level (aal1 vs aal2) to determine if MFA is needed                          |
| Settings page       | `src/app/dashboard/(app)/settings/profile/authentication/components/MultiFactorAuthenticationSettings.tsx` | Lists enrolled factors, allows unenroll, triggers enrollment modal                     |
| Admin enforcement   | `src/middleware.ts` (lines 72-140)                                                                         | Checks `ADMIN_ENFORCE_MFA` env var and redirects admins to `/admin/mfa` if not at aal2 |
| Code input          | `src/app/auth/components/VerificationCodeInput.tsx`                                                        | 6-digit input component with auto-advance between fields                               |
| Factor list hook    | `src/core/hooks/use-fetch-factors.ts`                                                                      | SWR hook returning `{ all, totp, phone }` factor arrays from `mfa.listFactors()`       |
| Factor mutation key | `src/core/hooks/use-user-factors-mutation-key.ts`                                                          | SWR cache key for factor mutations                                                     |
| i18n strings        | `public/locales/en/profile.json`, `public/locales/en/auth.json`                                            | MFA-related translation keys                                                           |
| Supabase config     | `supabase/config.toml` (lines 83-92)                                                                       | MFA config: TOTP enabled, phone disabled, max 10 factors                               |

**What does NOT exist today:**

- No SMS/phone MFA support
- No recovery codes
- No trusted-device / remember-me mechanism
- No setup nudge or banner prompting users to enable 2FA
- No email-based MFA (and Supabase does not support it)

---

## 3. Features Overview

| #   | Feature                               | Status                                 | Notes                                                                                          |
| --- | ------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1   | SMS-Based 2FA (Phone MFA)             | **Build**                              | Supabase supports `factorType: 'phone'` -- requires package upgrade and config change          |
| 2   | Email-Based 2FA                       | **Cannot Build (Supabase Limitation)** | Supabase only supports `totp` and `phone` as MFA factor types. See Section 6                   |
| 3   | 2FA Setup Nudge Banner                | **Build**                              | Dismissible banner on dashboard home when user has zero MFA factors                            |
| 4   | Trusted Device / Remember This Device | **Build**                              | HMAC-signed cookie allowing MFA bypass for 30 days on recognized devices                       |

> **Important: Email MFA is not available.** Supabase Auth's MFA system only supports `totp` and `phone` factor types. There is no `email` factor type. Section 6 of this spec explains this limitation in detail and provides alternative recommendations. This is a platform constraint, not something that can be worked around with configuration.

---

## 4. Prerequisites

### 4.1 Package Upgrades

The current project uses `@supabase/supabase-js` v2.45.1, which bundles `@supabase/auth-js` v2.64.4. Phone MFA types (`factorType: 'phone'`) were added in `@supabase/auth-js` v2.65.0.

| Package                 | Current Version | Required Version | Location                           |
| ----------------------- | --------------- | ---------------- | ---------------------------------- |
| `@supabase/supabase-js` | 2.45.1          | >= 2.46.0        | `package.json` (line 61)           |
| `@supabase/supabase-js` | ^2.45.1         | >= ^2.46.0       | `telephony/package.json` (line 32) |

**Upgrade command:**

```bash
pnpm update @supabase/supabase-js@latest --filter ultaura --filter @ultaura/telephony
```

After upgrading, run `pnpm install` and verify `node_modules/@supabase/auth-js/package.json` shows version >= 2.65.0.

### 4.2 Supabase Configuration Changes

In `supabase/config.toml`, change lines 90-92:

```toml
# BEFORE:
[auth.mfa.phone]
enroll_enabled = false
verify_enabled = false

# AFTER:
[auth.mfa.phone]
enroll_enabled = true
verify_enabled = true
```

### 4.3 Supabase Dashboard Settings

In the Supabase Dashboard (not in code -- this is a manual step):

1. Go to **Authentication > Providers > Phone**
2. Enable the phone provider
3. Select **Twilio** as the SMS provider
4. Enter the Twilio credentials:
   - **Account SID** (from Twilio console)
   - **Auth Token** (from Twilio console)
   - **Message Service SID** or **Sender Phone Number**

> **Note:** This Twilio configuration is separate from the telephony backend's Twilio setup. The telephony backend uses its own Twilio credentials for voice calls. The Supabase phone MFA uses Twilio specifically for sending SMS OTP codes through Supabase's infrastructure.

### 4.4 Pricing Implications

Supabase Phone MFA has a separate pricing tier:

| Item                          | Cost                                                                              |
| ----------------------------- | --------------------------------------------------------------------------------- |
| Phone MFA base fee (Pro plan) | **$75/month**                                                                     |
| SMS messages                  | Billed per message by Twilio (rates vary by country, ~$0.0079/SMS for US numbers) |

This is an ongoing monthly cost on top of the existing Supabase Pro plan. Factor this into the business decision before enabling phone MFA in production.

### 4.5 New Environment Variable

Add to `.env.ultaura.example` and all deployment environments:

```
TRUSTED_DEVICE_SECRET=<random-64-char-hex-string>
```

Generate with: `openssl rand -hex 32`

---

## 5. Feature 1: SMS-Based 2FA (Phone MFA)

### 5.1 Overview

Allow users to enroll a phone number as an MFA factor. When they log in and MFA is required, they can choose to receive an SMS with a 6-digit OTP code instead of (or in addition to) using a TOTP authenticator app. This uses Supabase's native `factorType: 'phone'` MFA support.

### 5.2 Files to Create

| File                                                                         | Purpose                                                                                                                                    |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/dashboard/(app)/settings/profile/components/PhoneMfaSetupModal.tsx` | Modal for enrolling a phone number as an MFA factor. Contains phone number input, SMS verification code step, and enrollment confirmation. |
| `src/app/auth/components/PhoneMfaChallengeForm.tsx`                          | Form component shown during login when user selects a phone factor. Triggers SMS send and accepts 6-digit code input.                      |
| `src/core/ui/PhoneNumberInput.tsx`                                           | Reusable phone number input component with country code selector and E.164 formatting.                                                     |

> **Why `src/core/ui/`?** Generic reusable UI primitives in this codebase live in `src/core/ui/` (where Modal, Badge, TextField, Button, Alert, Select, etc. reside). `src/components/ui/` is a thin re-export layer following the shadcn/ui pattern. A phone number input with country code dropdown, E.164 formatting, and validation logic is a custom UI primitive and belongs in `src/core/ui/`.

### 5.3 Files to Modify

| File                                                                                                       | Change                                                                                                                                                                                                                                                               | Why                                                                   |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `supabase/config.toml` (lines 90-92)                                                                       | Set `enroll_enabled = true` and `verify_enabled = true` under `[auth.mfa.phone]`                                                                                                                                                                                     | Enable phone MFA at the Supabase level                                |
| `package.json` (line 61)                                                                                   | Upgrade `@supabase/supabase-js` to >= 2.46.0                                                                                                                                                                                                                         | Get TypeScript types for `factorType: 'phone'`                        |
| `telephony/package.json` (line 32)                                                                         | Upgrade `@supabase/supabase-js` to >= ^2.46.0                                                                                                                                                                                                                        | Keep telephony backend in sync                                        |
| `src/app/dashboard/(app)/settings/profile/authentication/components/MultiFactorAuthenticationSettings.tsx` | Add a second "Add phone number" button alongside the existing TOTP setup button. Show phone factors in the factors table with a "Phone" badge. When unenrolling a phone factor, also clear any trusted-device cookie referencing it.                                 | Users need a way to enroll and manage phone MFA factors from settings |
| `src/app/auth/components/MultiFactorChallengeContainer.tsx`                                                | Update `FactorsListContainer` to show both TOTP and phone factors. When a phone factor is selected, render `PhoneMfaChallengeForm` instead of the TOTP code input. Add logic to trigger `mfa.challenge({ factorId, channel: 'sms' })` before showing the code input. | The login challenge flow currently only handles TOTP factors          |
| `src/app/dashboard/(app)/settings/profile/components/MultiFactorAuthSetupModal.tsx`                        | No structural changes, but the modal heading should be updated from "New authentication method" to differentiate that this is specifically the authenticator app method (e.g., "Set up authenticator app")                                                           | Clarity when two enrollment options exist                             |
| `public/locales/en/profile.json`                                                                           | Add new i18n keys for phone MFA UI strings                                                                                                                                                                                                                           | All user-facing text must be translatable                             |
| `public/locales/en/auth.json`                                                                              | Add new i18n keys for phone MFA challenge flow                                                                                                                                                                                                                       | All user-facing text must be translatable                             |

### 5.4 Implementation Steps

#### Step 1: Upgrade Supabase packages

```bash
pnpm update @supabase/supabase-js@latest --filter ultaura --filter @ultaura/telephony
pnpm install
```

Verify the upgrade:

```bash
cat node_modules/@supabase/auth-js/package.json | grep version
```

Expected: version >= 2.65.0

#### Step 2: Update Supabase config

In `supabase/config.toml`, change:

```toml
[auth.mfa.phone]
enroll_enabled = true
verify_enabled = true
```

#### Step 3: Create the PhoneNumberInput component

Create `src/core/ui/PhoneNumberInput.tsx`:

This component needs:

- A country code dropdown (defaulting to US +1)
- A text input for the phone number digits
- Automatic formatting to E.164 format (e.g., `+14155551234`)
- Validation: must start with `+`, followed by country code, followed by digits, total 10-15 digits
- Use the existing `TextField.Input` from `~/core/ui/TextField` for the input field
- Use a `<select>` or the existing UI Select component for country codes

**TypeScript interface:**

```typescript
interface PhoneNumberInputProps {
  value: string; // E.164 formatted string, e.g. "+14155551234"
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
}
```

**Supported country codes (minimum):**

```typescript
const COUNTRY_CODES = [
  { code: '+1', country: 'US', label: 'United States (+1)' },
  { code: '+1', country: 'CA', label: 'Canada (+1)' },
  { code: '+44', country: 'GB', label: 'United Kingdom (+44)' },
  { code: '+61', country: 'AU', label: 'Australia (+61)' },
  { code: '+33', country: 'FR', label: 'France (+33)' },
  { code: '+49', country: 'DE', label: 'Germany (+49)' },
  { code: '+91', country: 'IN', label: 'India (+91)' },
  { code: '+81', country: 'JP', label: 'Japan (+81)' },
  { code: '+52', country: 'MX', label: 'Mexico (+52)' },
  { code: '+55', country: 'BR', label: 'Brazil (+55)' },
] as const;
```

**E.164 validation regex:**

```typescript
const E164_REGEX = /^\+[1-9]\d{6,14}$/;
```

#### Step 4: Create the PhoneMfaSetupModal

Create `src/app/dashboard/(app)/settings/profile/components/PhoneMfaSetupModal.tsx`:

This modal has two internal steps:

**Step A -- Name + Phone number (combined):**

- Render a friendly name input (reuse the `FactorNameForm` pattern from the existing TOTP modal). The friendly name can default to the last 4 digits of the phone number (e.g., "Phone \*\*\*1234") if the user doesn't provide one.
- Render the `PhoneNumberInput` component below the name input
- "Send verification code" button
- On submit: call `client.auth.mfa.enroll({ factorType: 'phone', phone: phoneNumber, friendlyName })` where `friendlyName` is user-provided or auto-generated
- Store the returned `factorId` in state

> **Important:** Unlike what you might expect, `mfa.enroll({ factorType: 'phone' })` does NOT automatically send an SMS. After enrollment, you must explicitly call `mfa.challenge({ factorId, channel: 'sms' })` to trigger the SMS delivery. Only then can the user enter the code and call `mfa.verify()`.

**Step B -- Enter verification code:**

- After successful enrollment, immediately call `mfa.challenge({ factorId, channel: 'sms' })` to send the SMS OTP
- Render the existing `VerificationCodeInput` component (from `src/app/auth/components/VerificationCodeInput.tsx`)
- Display "We sent a code to +1\*\*\*1234" (mask middle digits)
- "Resend code" link (calls `mfa.challenge({ factorId, channel: 'sms' })` again)
- On code complete: call `mfa.verify({ factorId, challengeId, code })` using the `challengeId` from the challenge response
- On success: close modal, show toast via `sonner`

This 2-step flow (name+phone, then code) matches the TOTP enrollment flow's step count (name+QR, then code) and reduces friction compared to a 3-step approach.

**Supabase API calls used:**

```typescript
// Step 1: Enroll the phone factor (does NOT send SMS)
const { data: enrollData, error: enrollError } = await client.auth.mfa.enroll({
  factorType: 'phone',
  phone: '+14155551234', // E.164 format
  friendlyName: 'My Phone', // User-provided name
});
// enrollData.id is the factorId
// NOTE: No SMS is sent at this point!

// Step 2: Send the SMS challenge (this actually sends the SMS)
const { data: challengeData, error: challengeError } =
  await client.auth.mfa.challenge({
    factorId: enrollData.id,
    channel: 'sms',
  });
// challengeData.id is the challengeId

// Step 3: Verify the code
const { data: verifyData, error: verifyError } = await client.auth.mfa.verify({
  factorId: enrollData.id,
  challengeId: challengeData.id,
  code: '123456', // User-entered 6-digit code
});
```

**Component structure:**

```
PhoneMfaSetupModal
  Modal (from ~/core/ui/Modal)
    PhoneMfaSetupForm
      Step 1: FactorNameForm (reuse pattern) + PhoneNumberInput (combined in one view)
      Step 2: VerificationCodeInput + "Resend code" link
```

#### Step 5: Create the PhoneMfaChallengeForm

Create `src/app/auth/components/PhoneMfaChallengeForm.tsx`:

This component is rendered during login when the user selects a phone factor from the factor list. It:

1. Immediately calls `mfa.challenge({ factorId, channel: 'sms' })` on mount to send the SMS
2. Shows "We sent a code to your phone" message
3. Renders `VerificationCodeInput`
4. On code entry: calls `mfa.verify({ factorId, challengeId, code })`
5. On success: calls `onSuccess()` callback (same as TOTP flow)
6. Shows "Resend code" link with a 60-second cooldown timer
7. Shows error state if verification fails

**TypeScript interface:**

```typescript
interface PhoneMfaChallengeFormProps {
  factorId: string;
  onSuccess: () => void;
  onBack: () => void; // Navigate back to factor selection
  onTrustDevice?: (factorId: string) => void; // For trusted device feature (Feature 4)
}
```

#### Step 6: Update MultiFactorChallengeContainer

Modify `src/app/auth/components/MultiFactorChallengeContainer.tsx`:

**Change 1 -- FactorsListContainer (lines 116-196):**

Currently the component only checks `factors.totp` (line 131) and renders only TOTP factors (line 172). Update to:

```typescript
// Replace line 131:
// if (isSuccess && !factors.totp.length) {
// With:
if (isSuccess && !factors.totp.length && !factors.phone.length) {

// Replace line 145:
// if (isSuccess && factors.totp.length === 1) {
// With:
const allVerifiedFactors = [...(factors?.totp ?? []), ...(factors?.phone ?? [])];
if (isSuccess && allVerifiedFactors.length === 1) {

// Replace line 172:
// const verifiedFactors = factors?.totp ?? [];
// With:
const verifiedFactors = [...(factors?.totp ?? []), ...(factors?.phone ?? [])];
```

**Change 2 -- Main component (lines 17-80):**

Add state to track the selected factor's type:

```typescript
const [factorId, setFactorId] = useState('');
const [factorType, setFactorType] = useState<'totp' | 'phone'>('totp');
```

When a factor is selected, also set its type. Then conditionally render either the existing TOTP form or the new `PhoneMfaChallengeForm`:

```typescript
if (factorType === 'phone') {
  return (
    <PhoneMfaChallengeForm
      factorId={factorId}
      onSuccess={onSuccess}
      onBack={() => { setFactorId(''); setFactorType('totp'); }}
    />
  );
}

// ... existing TOTP form below
```

**Change 3 -- Factor list rendering (line 182-193):**

Add a visual indicator showing factor type (phone vs authenticator app icon) next to each factor button:

```typescript
{verifiedFactors.map((factor) => (
  <div key={factor.id}>
    <Button
      block
      variant={'outline'}
      className={'border-gray-50'}
      onClick={() => {
        onSelect(factor.id);
        onSelectType(factor.factor_type as 'totp' | 'phone');
      }}
    >
      {factor.factor_type === 'phone' ? <Smartphone className="h-4 w-4 mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
      {factor.friendly_name}
    </Button>
  </div>
))}
```

#### Step 7: Update MultiFactorAuthenticationSettings

Modify `src/app/dashboard/(app)/settings/profile/authentication/components/MultiFactorAuthenticationSettings.tsx`:

**Change 1:** Add a second modal state for phone MFA:

```typescript
const [isMfaModalOpen, setIsMfaModalOpen] = useState(false);
const [isPhoneMfaModalOpen, setIsPhoneMfaModalOpen] = useState(false);
```

**Change 2:** Render both modals:

```typescript
<MultiFactorAuthSetupModal isOpen={isMfaModalOpen} setIsOpen={setIsMfaModalOpen} />
<PhoneMfaSetupModal isOpen={isPhoneMfaModalOpen} setIsOpen={setIsPhoneMfaModalOpen} />
```

**Change 3:** Update `SetupMfaButton` or replace with two separate buttons:

```typescript
<div className="flex flex-col gap-2 sm:flex-row">
  <Button variant="default" onClick={() => setIsMfaModalOpen(true)} className="w-full sm:w-auto">
    <Shield className="h-4 w-4 mr-2" />
    <Trans i18nKey={'profile:setupTotpButtonLabel'} />
  </Button>
  <Button variant="outline" onClick={() => setIsPhoneMfaModalOpen(true)} className="w-full sm:w-auto">
    <Smartphone className="h-4 w-4 mr-2" />
    <Trans i18nKey={'profile:setupPhoneMfaButtonLabel'} />
  </Button>
</div>
```

**Change 4:** In the `FactorsTable` component, the factor type badge (line 243-245) already displays `factor.factor_type` which will show "phone" for phone factors. No change needed there, but consider capitalizing:

```typescript
<Badge size={'small'} className={'inline-flex uppercase'}>
  {factor.factor_type === 'phone' ? 'SMS' : 'TOTP'}
</Badge>
```

#### Step 8: Update existing TOTP modal heading

In `src/app/dashboard/(app)/settings/profile/components/MultiFactorAuthSetupModal.tsx`, line 36:

```typescript
// BEFORE:
heading="New authentication method"
description="Scan the QR code and confirm your authenticator app."

// AFTER (use i18n keys):
heading={<Trans i18nKey={'profile:setupTotpModalHeading'} />}
description={<Trans i18nKey={'profile:setupTotpModalDescription'} />}
```

### 5.5 Phone Number Input

The `PhoneNumberInput` component (created in Step 3 at `src/core/ui/PhoneNumberInput.tsx`) handles:

- **Country code selection:** Dropdown defaulting to US (+1). Shows country name and code.
- **Number input:** Accepts digits only. Auto-strips non-numeric characters.
- **E.164 output:** Combines country code + digits into E.164 format (e.g., `+14155551234`).
- **Validation:** Checks against `^\+[1-9]\d{6,14}$`. Shows inline error if invalid.
- **Accessibility:** Label text, `aria-describedby` for errors, keyboard navigable dropdown.

Layout: Country code dropdown (120px) + phone number text input (flex-1) in a horizontal row. Match the existing `TextField.Input` styling.

### 5.6 Enrollment Flow (Step by Step)

1. User navigates to **Settings > Profile > Authentication** (`/dashboard/settings/profile/authentication`)
2. User sees their enrolled factors (if any) and two buttons: "Set up authenticator app" and "Add phone number"
3. User clicks **"Add phone number"** -- `PhoneMfaSetupModal` opens
4. **Step 1 -- Name + Phone number (combined):** User enters a friendly name (e.g., "My iPhone") and selects country code, enters phone number. The friendly name defaults to "Phone \*\*\*1234" (last 4 digits) if left blank. Component validates E.164 format.
5. User clicks **"Send verification code"**
6. Behind the scenes: `client.auth.mfa.enroll({ factorType: 'phone', phone, friendlyName })` is called. Supabase stores the factor and returns the `factorId`. No SMS is sent at this point.
7. Immediately after successful enrollment, the UI calls `client.auth.mfa.challenge({ factorId, channel: 'sms' })` to send the SMS OTP code to the user's phone. The response includes a `challengeId` needed for verification.
8. **Step 2 -- Verify:** User sees the `VerificationCodeInput` 6-digit input. Message says "We sent a verification code to +1\*\*\*1234."
9. User enters the 6-digit code from the SMS
10. Behind the scenes: `client.auth.mfa.verify({ factorId, challengeId, code })` is called using the `challengeId` from step 7
11. On success: modal closes, toast shows "Phone number successfully enrolled", factor list refreshes (SWR mutation key triggers revalidation)
12. The factors table now shows the new phone factor with type "SMS" and status "verified"

### 5.7 Challenge Flow at Login

1. User signs in with email + password
2. Supabase session is created at AAL1 (assurance level 1)
3. `check-requires-mfa.ts` detects `nextLevel === 'aal2'` and `currentLevel !== 'aal2'` -- MFA is required
4. User is redirected to `/auth/verify`
5. `VerifyFormContainer.tsx` renders `MultiFactorChallengeContainer`
6. `MultiFactorChallengeContainer` calls `useFetchAuthFactors()` which returns `{ totp: [...], phone: [...] }`
7. **If only one factor exists (any type):** auto-selects it
   - If TOTP: shows TOTP code input (existing behavior)
   - If phone: immediately sends SMS via `mfa.challenge({ factorId, channel: 'sms' })`, then shows `PhoneMfaChallengeForm`
8. **If multiple factors exist:** shows factor selection list with type icons (Shield for TOTP, Smartphone for phone)
9. User selects a factor:
   - **TOTP selected:** existing flow -- user opens authenticator app and enters code
   - **Phone selected:** `PhoneMfaChallengeForm` mounts, triggers SMS send on mount, shows 6-digit input
10. User enters the 6-digit code
11. Code is verified via `mfa.verify()` -- session is elevated to AAL2
12. User is redirected to dashboard home (`configuration.paths.appHome`)

### 5.8 Error Handling

| Error                                 | How to Handle                                                                                                                                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Invalid phone number** (enrollment) | Validate E.164 format client-side before calling `mfa.enroll()`. Show inline error on the phone input: "Please enter a valid phone number including country code."                                        |
| **Phone number already enrolled**     | Supabase returns error if same phone is enrolled twice. Show error: "This phone number is already enrolled as a factor."                                                                                  |
| **SMS delivery failure**              | Supabase returns an error from the `mfa.challenge()` call. Show Alert component (error type): "We couldn't send the verification code. Please check your phone number and try again." Add a retry button. |
| **Code expired**                      | Supabase OTP codes expire after 5 minutes. Show error: "This code has expired. Click 'Resend code' to get a new one."                                                                                     |
| **Invalid code**                      | `mfa.verify()` returns error. Show inline error: "Invalid verification code. Please try again." Keep the code input active so user can retry.                                                             |
| **Rate limiting**                     | Supabase rate-limits SMS sends. If `mfa.challenge()` returns 429, show: "Too many attempts. Please wait a moment before requesting a new code." Disable the "Resend code" link for 60 seconds.            |
| **Max factors reached**               | If user already has 10 factors (the max per `supabase/config.toml` line 84), hide the "Add phone number" button and show a note: "You've reached the maximum number of authentication methods (10)."      |
| **Network error**                     | Generic catch: "Something went wrong. Please check your connection and try again."                                                                                                                        |

### 5.9 i18n Keys

New keys to add to `public/locales/en/profile.json`:

| Key                                  | Value                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| `profile:setupTotpButtonLabel`       | `"Set up authenticator app"`                                                              |
| `profile:setupPhoneMfaButtonLabel`   | `"Add phone number"`                                                                      |
| `profile:setupTotpModalHeading`      | `"Set up authenticator app"`                                                              |
| `profile:setupTotpModalDescription`  | `"Scan the QR code with your authenticator app and confirm."`                             |
| `profile:phoneMfaModalHeading`       | `"Add phone number for verification"`                                                     |
| `profile:phoneMfaModalDescription`   | `"We'll send a verification code via SMS when you sign in."`                              |
| `profile:phoneNumberLabel`           | `"Phone Number"`                                                                          |
| `profile:phoneNumberPlaceholder`     | `"(555) 123-4567"`                                                                        |
| `profile:sendVerificationCodeButton` | `"Send verification code"`                                                                |
| `profile:smsSentMessage`             | `"We sent a verification code to {{phone}}"`                                              |
| `profile:resendCode`                 | `"Resend code"`                                                                           |
| `profile:resendCodeCooldown`         | `"Resend code in {{seconds}}s"`                                                           |
| `profile:phoneMfaSetupSuccess`       | `"Phone number successfully enrolled"`                                                    |
| `profile:phoneMfaSetupError`         | `"Sorry, there was an error enrolling your phone number. Please try again."`              |
| `profile:invalidPhoneNumber`         | `"Please enter a valid phone number including country code."`                             |
| `profile:phoneAlreadyEnrolled`       | `"This phone number is already enrolled as a factor."`                                    |
| `profile:smsDeliveryError`           | `"We couldn't send the verification code. Please check your phone number and try again."` |
| `profile:codeExpired`                | `"This code has expired. Click 'Resend code' to get a new one."`                          |
| `profile:tooManyAttempts`            | `"Too many attempts. Please wait before requesting a new code."`                          |
| `profile:maxFactorsReached`          | `"Maximum authentication methods reached (10)."`                                          |
| `profile:factorTypeSms`              | `"SMS"`                                                                                   |
| `profile:factorTypeTotp`             | `"Authenticator App"`                                                                     |

New keys to add to `public/locales/en/auth.json`:

| Key                                 | Value                                            |
| ----------------------------------- | ------------------------------------------------ |
| `auth:phoneMfaChallengeHeading`     | `"Enter verification code"`                      |
| `auth:phoneMfaChallengeDescription` | `"We sent a 6-digit code to your phone number."` |
| `auth:phoneMfaResendCode`           | `"Resend code"`                                  |
| `auth:phoneMfaResendCooldown`       | `"Resend in {{seconds}}s"`                       |
| `auth:phoneMfaVerifyError`          | `"Invalid code. Please try again."`              |
| `auth:phoneMfaSendError`            | `"Failed to send code. Please try again."`       |
| `auth:selectFactorHeading`          | `"Choose a verification method"`                 |

---

## 6. Feature 2: Email-Based 2FA

### 6.1 Supabase Limitation

**Supabase Auth does NOT support `email` as an MFA factor type.** The MFA system only accepts two factor types:

- `totp` -- Time-based one-time password (authenticator apps)
- `phone` -- SMS-based one-time password

Attempting to call `client.auth.mfa.enroll({ factorType: 'email' })` will return a type error at compile time and an API error at runtime. This is a fundamental platform constraint documented in the Supabase Auth MFA API.

There is no configuration flag, feature gate, or workaround within Supabase's MFA system to enable email as a factor type.

---

## 7. Feature 3: 2FA Setup Nudge Banner

### 7.1 Overview

A dismissible banner displayed on the dashboard home page that encourages users who have not yet enrolled any MFA factors to set up two-factor authentication. The banner appears after the `TrialExpiredBanner` but before the alerts section. It can be dismissed, and once dismissed, it won't reappear for 30 days.

### 7.2 Files to Create

| File                                              | Purpose                                                                                                                                      |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/ultaura/MfaNudgeBanner.tsx`       | Server component that checks whether the user has MFA factors and whether the dismiss cookie is set. Renders the nudge banner conditionally. |
| `src/components/ultaura/MfaNudgeBannerClient.tsx` | Client component wrapping the banner UI with dismiss button functionality. Sets the dismiss cookie on click.                                 |

### 7.3 Files to Modify

| File                                           | Change                                                                                 | Why                                                         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `src/app/dashboard/(app)/page.tsx` (~line 267) | Import and render `MfaNudgeBanner` between `TrialExpiredBanner` and the alerts section | Place the banner in the correct position in the page layout |
| `public/locales/en/profile.json`               | Add i18n keys for banner text                                                          | Translatable strings                                        |

### 7.4 Banner Design

The banner follows the design language of `TrialExpiredBanner` (`src/components/ultaura/TrialExpiredBanner.tsx`) but uses an info/primary color scheme instead of destructive:

```
+------------------------------------------------------------------+
| [Shield icon]  Secure your account                    [X dismiss] |
|                                                                    |
|  Add two-factor authentication for extra security.                |
|  It only takes a minute.                                          |
|                                                   [Set up 2FA ->] |
+------------------------------------------------------------------+
```

**Visual specifications:**

- **Container:** `rounded-xl border border-primary/30 bg-primary/10 p-4` (matches the pattern of `TrialExpiredBanner` but uses `primary` instead of `destructive`)
- **Icon:** `ShieldCheck` from `lucide-react`, wrapped in `rounded-full bg-primary/20 p-2 text-primary`
- **Heading:** `"Secure your account"` -- `font-medium text-foreground`
- **Description:** `"Add two-factor authentication for extra security. It only takes a minute."` -- `text-sm text-muted-foreground`
- **CTA button:** Link to `/dashboard/settings/profile/authentication` -- same style as TrialExpiredBanner's CTA: `inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors`
- **Dismiss button:** `X` icon button in the top-right area, `text-muted-foreground hover:text-foreground`
- **Layout:** Flexbox -- icon + text on left, CTA on right (desktop). Stacked on mobile.
- **Mobile responsive:** On screens < 640px (`sm`), stack vertically: icon+text, then CTA button (full width), with dismiss button in top-right corner.

### 7.5 Display Logic

The banner displays when ALL of these are true:

1. User has **zero** MFA factors enrolled (neither TOTP nor phone)
2. The `mfa-nudge-dismissed` cookie is **not set**, OR it was set **more than 30 days ago**

The banner hides when ANY of these are true:

1. User has >= 1 MFA factor enrolled (any type)
2. The `mfa-nudge-dismissed` cookie is set and less than 30 days old

**Server-side check (in `MfaNudgeBanner.tsx`):**

```typescript
// 1. Check MFA factors
const supabase = getSupabaseServerComponentClient();
const { data: factors } = await supabase.auth.mfa.listFactors();
const hasFactors = (factors?.totp?.length ?? 0) + (factors?.phone?.length ?? 0) > 0;

if (hasFactors) return null;

// 2. Check dismiss cookie
const dismissedAt = cookies().get('mfa-nudge-dismissed')?.value;
if (dismissedAt) {
  const dismissedDate = new Date(dismissedAt);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (dismissedDate > thirtyDaysAgo) return null;
}

// 3. Render banner
return <MfaNudgeBannerClient />;
```

### 7.6 Dismiss Mechanism

| Property        | Value                                                              |
| --------------- | ------------------------------------------------------------------ |
| Cookie name     | `mfa-nudge-dismissed`                                              |
| Cookie value    | ISO 8601 timestamp of dismissal (e.g., `2026-03-01T12:00:00.000Z`) |
| Cookie expiry   | 30 days from when set                                              |
| Cookie path     | `/dashboard`                                                       |
| Cookie SameSite | `lax`                                                              |
| Cookie HttpOnly | `false` (needs to be set from client-side JavaScript)              |

> **Note on Secure flag:** The `setCookie` utility at `src/core/generic/cookies.ts` does not currently support the `Secure` flag. Since this is a non-sensitive UI preference cookie (it only controls whether a banner is visible), the `Secure` flag is not required. If cookie security for UI preferences becomes a concern in the future, either extend the `setCookie` utility or set this cookie via a server action.

**On dismiss (client-side in `MfaNudgeBannerClient.tsx`):**

```typescript
import { setCookie } from '~/core/generic/cookies';

function handleDismiss() {
  const now = new Date();
  setCookie('mfa-nudge-dismissed', now.toISOString(), {
    path: '/dashboard',
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    sameSite: 'lax',
  });
  setVisible(false); // local state to immediately hide
}
```

**On page load (server-side):** The server component reads the cookie via `cookies().get('mfa-nudge-dismissed')` and conditionally renders the banner (see Section 7.5).

### 7.7 Implementation Steps

#### Step 1: Create MfaNudgeBannerClient

Create `src/components/ultaura/MfaNudgeBannerClient.tsx`:

```typescript
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, X } from 'lucide-react';
import { setCookie } from '~/core/generic/cookies';
import Trans from '~/core/ui/Trans';

export function MfaNudgeBannerClient() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const handleDismiss = () => {
    const now = new Date();
    setCookie('mfa-nudge-dismissed', now.toISOString(), {
      path: '/dashboard',
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      sameSite: 'lax',
    });
    setVisible(false);
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-primary/20 p-2 text-primary">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <div className="font-medium text-foreground">
              <Trans i18nKey={'profile:mfaNudgeHeading'} />
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              <Trans i18nKey={'profile:mfaNudgeDescription'} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/settings/profile/authentication"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Trans i18nKey={'profile:mfaNudgeCta'} />
          </Link>

          <button
            onClick={handleDismiss}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### Step 2: Create MfaNudgeBanner (server component)

Create `src/components/ultaura/MfaNudgeBanner.tsx`:

```typescript
import { cookies } from 'next/headers';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import { MfaNudgeBannerClient } from './MfaNudgeBannerClient';

export async function MfaNudgeBanner() {
  // Check dismiss cookie
  const dismissedAt = cookies().get('mfa-nudge-dismissed')?.value;
  if (dismissedAt) {
    const dismissedDate = new Date(dismissedAt);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (dismissedDate > thirtyDaysAgo) return null;
  }

  // Check if user has any MFA factors
  const client = getSupabaseServerComponentClient();
  const { data: factors } = await client.auth.mfa.listFactors();
  const totpCount = factors?.totp?.length ?? 0;
  const phoneCount = factors?.phone?.length ?? 0;

  if (totpCount + phoneCount > 0) return null;

  return <MfaNudgeBannerClient />;
}
```

#### Step 3: Add banner to dashboard home page

In `src/app/dashboard/(app)/page.tsx`, around line 267:

```typescript
// BEFORE (current line 267):
{isTrialExpired ? <TrialExpiredBanner trialPlanName={trialPlanName} /> : null}

// AFTER:
{isTrialExpired ? <TrialExpiredBanner trialPlanName={trialPlanName} /> : null}

<MfaNudgeBanner />
```

Add the import at the top of the file:

```typescript
import { MfaNudgeBanner } from '~/components/ultaura/MfaNudgeBanner';
```

The `MfaNudgeBanner` is a server component (using `async` function and `cookies()`), which is compatible with the dashboard home page since it is also a server component.

#### Step 4: Add i18n keys

See Section 7.8 below.

### 7.8 i18n Keys

New keys to add to `public/locales/en/profile.json`:

| Key                           | Value                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------- |
| `profile:mfaNudgeHeading`     | `"Secure your account"`                                                       |
| `profile:mfaNudgeDescription` | `"Add two-factor authentication for extra security. It only takes a minute."` |
| `profile:mfaNudgeCta`         | `"Set up 2FA"`                                                                |

---

## 8. Feature 4: Trusted Device / Remember This Device

### 8.1 Overview

After successfully completing an MFA challenge, the user can check a "Trust this device for 30 days" checkbox. If checked, a cryptographically signed cookie is stored on their device. On subsequent logins from the same device, the system detects the trusted-device cookie and skips the MFA challenge, immediately granting AAL2-equivalent access.

### 8.2 How It Works (High Level)

1. User logs in with email + password -- session is at AAL1
2. MFA challenge screen appears (TOTP or phone)
3. User enters MFA code successfully
4. **New:** Below the code input, a checkbox reads "Trust this device for 30 days"
5. If checked, after successful MFA verification, the server creates a signed token and sets it as an `HttpOnly` cookie
6. On next login: after password auth succeeds, `check-requires-mfa.ts` checks for a valid trusted-device cookie before requiring MFA
7. If the cookie is valid (correct signature, not expired, matches user), the MFA step is skipped

### 8.3 Security Design

| Property            | Value                                                     |
| ------------------- | --------------------------------------------------------- |
| **Cookie name**     | `trusted-device`                                          |
| **Cookie value**    | Base64-encoded JSON string signed with HMAC-SHA256        |
| **Signing secret**  | `TRUSTED_DEVICE_SECRET` env var (new, 256-bit random hex) |
| **Cookie HttpOnly** | `true` (cannot be read by client-side JavaScript)         |
| **Cookie Secure**   | `true` in production                                      |
| **Cookie SameSite** | `Lax`                                                     |
| **Cookie Path**     | `/`                                                       |
| **Cookie expiry**   | 30 days                                                   |

**Token payload structure:**

```typescript
interface TrustedDevicePayload {
  /** The Supabase user ID */
  userId: string;
  /** The factor ID that was used for the MFA challenge */
  factorId: string;
  /** Unix timestamp (ms) when the device was trusted */
  trustedAt: number;
  /** Unix timestamp (ms) when this token expires (trustedAt + 30 days) */
  expiresAt: number;
  /** A random nonce to prevent replay across different trust events */
  nonce: string;
}
```

**Token format:**

```
base64url(JSON.stringify(payload)) + "." + base64url(hmacSha256(payload, secret))
```

This is similar to a JWT but simpler -- no header, just payload + signature.

**Validation rules:**

When checking a trusted-device cookie, ALL of the following must pass:

1. Cookie exists and is non-empty
2. Cookie can be split into `payload.signature` format
3. HMAC-SHA256 of the payload matches the signature (integrity check, using timing-safe comparison)
4. `expiresAt` is in the future (not expired)
5. `userId` matches the currently authenticated user's ID
6. `factorId` still exists in the user's enrolled factors (wasn't unenrolled)

If any check fails, the cookie is silently deleted and MFA proceeds normally.

### 8.4 Files to Create

| File                                              | Purpose                                                                                                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/server/cookies/trusted-device.cookie.ts` | Server-side functions: `setTrustedDeviceCookie()`, `getTrustedDeviceCookie()`, `clearTrustedDeviceCookie()`, `isTrustedDevice()`                                                |
| `src/lib/server/trusted-device.ts`                | Crypto functions: `generateTrustedDeviceToken()`, `verifyTrustedDeviceToken()` -- HMAC-SHA256 signing and verification with timing-safe comparison                              |
| `src/lib/ultaura/trusted-device-actions.ts`       | Server actions for setting/clearing the trusted-device cookie after MFA verification. Called by the client after successful MFA challenge when user checks "Trust this device." |
| `src/lib/ultaura/auth-actions.ts`                 | Server action for sign-out that clears the trusted-device cookie (HttpOnly) server-side, since client-side JS cannot clear HttpOnly cookies.                                    |

> **File location convention:** Server action files in this codebase live in `src/lib/ultaura/` (domain-specific actions) or `src/lib/{domain}/actions.ts`. The `src/lib/server/` directory is reserved for non-action server utilities (cookies, loaders, queries). All new server actions follow the `src/lib/ultaura/` pattern.

### 8.5 Files to Modify

| File                                                                          | Change                                                                                                                                                                                                                     | Why                                                    |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `src/core/session/utils/check-requires-mfa.ts`                                | Before returning `true` (MFA required), check if a valid trusted-device cookie exists for the current user. If valid, return `false` (skip MFA). Accept optional `userId`/`factorIds` params to avoid duplicate API calls. | Core of the trusted device bypass                      |
| `src/app/auth/verify/components/VerifyFormContainer.tsx`                      | Add "Trust this device for 30 days" checkbox. After successful MFA verification and if checkbox is checked, call the `setTrustedDeviceAction` server action before redirecting.                                            | User opts in to trusted device                         |
| `src/app/auth/components/MultiFactorChallengeContainer.tsx`                   | Accept an `onTrustDevice` callback prop. After successful `challengeAndVerify()`, if trust was requested, call the callback with the `factorId`.                                                                           | Pass trust preference through the MFA flow             |
| `src/app/auth/components/PhoneMfaChallengeForm.tsx` (new file from Feature 1) | Accept `onTrustDevice` callback. Same pattern as TOTP.                                                                                                                                                                     | Trusted device works for both TOTP and phone MFA       |
| `src/core/hooks/use-sign-out.ts`                                              | Update to call the `signOutAction` server action so the HttpOnly trusted-device cookie is cleared server-side on sign-out, while preserving `client.auth.signOut()` for the `AuthChangeListener`.                          | HttpOnly cookies cannot be cleared from client-side JS |
| `.env.ultaura.example`                                                        | Add `TRUSTED_DEVICE_SECRET` with description                                                                                                                                                                               | Developers need to know about the new env var          |
| `public/locales/en/auth.json`                                                 | Add i18n keys for trusted device UI                                                                                                                                                                                        | Translatable strings                                   |

### 8.6 Implementation Steps

#### Step 1: Create the crypto module

Create `src/lib/server/trusted-device.ts`:

```typescript
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface TrustedDevicePayload {
  userId: string;
  factorId: string;
  trustedAt: number;
  expiresAt: number;
  nonce: string;
}

/**
 * Signs a trusted device payload using HMAC-SHA256.
 * Returns a string in the format: base64url(payload).base64url(signature)
 */
export function generateTrustedDeviceToken(
  userId: string,
  factorId: string,
): string {
  const secret = getTrustedDeviceSecret();
  const now = Date.now();

  const payload: TrustedDevicePayload = {
    userId,
    factorId,
    trustedAt: now,
    expiresAt: now + THIRTY_DAYS_MS,
    nonce: randomBytes(16).toString('hex'),
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret)
    .update(payloadStr)
    .digest('base64url');

  return `${payloadStr}.${signature}`;
}

/**
 * Verifies and decodes a trusted device token.
 * Returns the payload if valid, or null if invalid/expired/tampered.
 * Uses timing-safe comparison to prevent timing attacks on the HMAC signature.
 *
 * The entire function body is wrapped in a try-catch so that any failure
 * (missing secret, malformed token, corrupted data, invalid Buffer/base64,
 * JSON parse error) returns null. The caller treats null as "not trusted"
 * and falls through to normal MFA verification.
 */
export function verifyTrustedDeviceToken(
  token: string,
  expectedUserId: string,
): TrustedDevicePayload | null {
  try {
    const secret = getTrustedDeviceSecret();
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadStr, signature] = parts;

    const expectedSignature = createHmac('sha256', secret)
      .update(payloadStr)
      .digest('base64url');

    const expectedBuf = Buffer.from(expectedSignature, 'base64url');
    const actualBuf = Buffer.from(signature, 'base64url');
    if (
      expectedBuf.length !== actualBuf.length ||
      !timingSafeEqual(expectedBuf, actualBuf)
    ) {
      return null;
    }

    const payload: TrustedDevicePayload = JSON.parse(
      Buffer.from(payloadStr, 'base64url').toString(),
    );

    if (payload.userId !== expectedUserId) return null;
    if (Date.now() > payload.expiresAt) return null;

    return payload;
  } catch {
    // If anything fails (missing secret, malformed token, corrupted data),
    // return null. The caller treats this as "not trusted" and falls through
    // to normal MFA verification.
    return null;
  }
}

function getTrustedDeviceSecret(): string {
  const secret = process.env.TRUSTED_DEVICE_SECRET;
  if (!secret) {
    throw new Error(
      'TRUSTED_DEVICE_SECRET environment variable is not set. ' +
        'Generate one with: openssl rand -hex 32',
    );
  }
  return secret;
}
```

#### Step 2: Create the cookie module

Create `src/lib/server/cookies/trusted-device.cookie.ts`:

> **Important:** The `Secure` flag on the trusted-device cookie depends on `process.env.ENVIRONMENT === 'production'`. This env var is set in `.env.production` but must also be configured in your hosting environment. See Section 13 for details.

```typescript
import { cookies } from 'next/headers';
import {
  verifyTrustedDeviceToken,
  type TrustedDevicePayload,
} from '~/lib/server/trusted-device';

const COOKIE_NAME = 'trusted-device';
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

/**
 * Sets the trusted-device cookie with the given token string.
 */
export function setTrustedDeviceCookie(token: string) {
  const secure = process.env.ENVIRONMENT === 'production';

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: THIRTY_DAYS_SECONDS,
  });
}

/**
 * Validates the trusted-device cookie for the given user.
 * Returns the payload if valid, null otherwise.
 * If invalid, the cookie is automatically deleted.
 */
export async function validateTrustedDevice(
  userId: string,
): Promise<TrustedDevicePayload | null> {
  const cookie = cookies().get(COOKIE_NAME);
  if (!cookie?.value) return null;

  const payload = verifyTrustedDeviceToken(cookie.value, userId);

  if (!payload) {
    // Invalid cookie -- clear it
    clearTrustedDeviceCookie();
    return null;
  }

  return payload;
}

/**
 * Clears the trusted-device cookie.
 */
export function clearTrustedDeviceCookie() {
  cookies().delete(COOKIE_NAME);
}

/**
 * Checks if the current user has a valid trusted device.
 * Also verifies the factor still exists.
 */
export async function isTrustedDevice(
  userId: string,
  enrolledFactorIds: string[],
): Promise<boolean> {
  const payload = await validateTrustedDevice(userId);
  if (!payload) return false;

  // Verify the factor referenced in the cookie still exists
  if (!enrolledFactorIds.includes(payload.factorId)) {
    clearTrustedDeviceCookie();
    return false;
  }

  return true;
}
```

#### Step 3: Create the trusted-device server actions

Create `src/lib/ultaura/trusted-device-actions.ts`:

> **Import convention:** All `'use server'` files in this codebase use `getSupabaseServerActionClient` (default export from `~/core/supabase/action-client`). This is the established pattern across 30+ existing server action files. Do NOT use `getSupabaseServerClient` or `getSupabaseServerComponentClient` — those are for different contexts.

```typescript
'use server';

import getSupabaseServerActionClient from '~/core/supabase/action-client';
import {
  setTrustedDeviceCookie,
  clearTrustedDeviceCookie,
} from '~/lib/server/cookies/trusted-device.cookie';
import { generateTrustedDeviceToken } from '~/lib/server/trusted-device';

export async function setTrustedDeviceAction(factorId: string) {
  const client = getSupabaseServerActionClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Verify user is at AAL2 (already completed MFA)
  const { data: assurance } =
    await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== 'aal2') throw new Error('MFA not verified');

  // Verify the factorId belongs to this user
  const { data: factors } = await client.auth.mfa.listFactors();
  const allFactors = [...(factors?.totp ?? []), ...(factors?.phone ?? [])];
  if (!allFactors.some((f) => f.id === factorId))
    throw new Error('Invalid factor');

  const token = generateTrustedDeviceToken(user.id, factorId);
  setTrustedDeviceCookie(token);
  return { success: true };
}

export async function clearTrustedDeviceAction() {
  clearTrustedDeviceCookie();
  return { success: true };
}
```

**Benefits of server action over API route:**

- CSRF protection is handled automatically by Next.js for server actions
- No need to set up fetch headers or worry about CSRF tokens
- Simpler client-side code (just call the action directly)
- Follows Next.js App Router best practices

#### Step 4: Create the sign-out server action

Create `src/lib/ultaura/auth-actions.ts`:

> **Import convention:** All `'use server'` files in this codebase use `getSupabaseServerActionClient` (default export from `~/core/supabase/action-client`). This is the established pattern across 30+ existing server action files. Do NOT use `getSupabaseServerClient` or `getSupabaseServerComponentClient` — those are for different contexts.

```typescript
'use server';

import getSupabaseServerActionClient from '~/core/supabase/action-client';
import { clearTrustedDeviceCookie } from '~/lib/server/cookies/trusted-device.cookie';

export async function signOutAction() {
  const client = getSupabaseServerActionClient();
  clearTrustedDeviceCookie();
  await client.auth.signOut();
  return { success: true };
}
```

This ensures the trusted-device cookie (HttpOnly) is cleared server-side when the user logs out. Client-side JavaScript cannot clear HttpOnly cookies, so this server action is required.

#### Step 5: Update check-requires-mfa.ts

Modify `src/core/session/utils/check-requires-mfa.ts`:

The current function only checks Supabase AAL levels. Add a trusted-device check with optional parameters to avoid duplicate API calls:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import { isTrustedDevice } from '~/lib/server/cookies/trusted-device.cookie';

const ASSURANCE_LEVEL_2 = 'aal2';

async function checkSessionRequiresMultiFactorAuthentication(
  client: SupabaseClient,
  options?: { userId?: string; factorIds?: string[] },
) {
  // @ts-expect-error: suppressGetSessionWarning is not part of the public API
  client.auth.suppressGetSessionWarning = true;

  const assuranceLevel = await client.auth.mfa.getAuthenticatorAssuranceLevel();

  // @ts-expect-error: suppressGetSessionWarning is not part of the public API
  client.auth.suppressGetSessionWarning = false;

  if (assuranceLevel.error) {
    throw new Error(assuranceLevel.error.message);
  }

  const { nextLevel, currentLevel } = assuranceLevel.data;
  const mfaRequired =
    nextLevel === ASSURANCE_LEVEL_2 && nextLevel !== currentLevel;

  if (!mfaRequired) {
    return false;
  }

  // Check for trusted device before requiring MFA
  // Only fetch userId/factorIds if not provided by caller
  let userId = options?.userId;
  let factorIds = options?.factorIds;

  if (!userId || !factorIds) {
    const {
      data: { user },
    } = await client.auth.getUser();
    userId = user?.id;
    if (userId && !factorIds) {
      const { data: factors } = await client.auth.mfa.listFactors();
      factorIds = [...(factors?.totp ?? []), ...(factors?.phone ?? [])].map(
        (f) => f.id,
      );
    }
  }

  if (userId && factorIds?.length) {
    try {
      const trusted = await isTrustedDevice(userId, factorIds);
      if (trusted) return false;
    } catch {
      // If trusted device check fails (missing env var, corrupted cookie, etc.),
      // fall through to require normal MFA. Never block login due to trust check failure.
    }
  }

  return true;
}

export default checkSessionRequiresMultiFactorAuthentication;
```

Then update `require-session.ts` to let the function handle userId resolution internally:

```typescript
// Option B (recommended): Let the function fetch its own userId when needed (simpler, avoids coupling)
const requiresMfa = await verifyRequiresMfa(client);
// The function will only call getUser() internally if MFA is required AND a trusted-device cookie exists
```

> **Why Option B?** At the point where `verifyRequiresMfa` is called in `require-session.ts` (line 28), there is no `user` variable available — the user data is fetched later at line 37. Rather than coupling the caller to the function's internal implementation by extracting `data.session?.user?.id`, the simpler approach is to omit the options parameter entirely. The function's internal fallback calls `getUser()` only on the MFA-required path (when it also needs to check trusted-device status), so the performance impact is negligible.
>
> For performance-conscious implementations, Option A is available:
>
> ```typescript
> const requiresMfa = await verifyRequiresMfa(client, {
>   userId: data.session?.user?.id,
> });
> ```

> **Important note:** The `isTrustedDevice` function uses `cookies()` from `next/headers`, which only works in Server Components, Route Handlers, and Server Actions. The `check-requires-mfa.ts` function is currently called from server-side contexts, so this is compatible. If it's ever called from a client component, the trusted-device check must be moved to a server action or API route.

#### Step 6: Update VerifyFormContainer

Modify `src/app/auth/verify/components/VerifyFormContainer.tsx`:

```typescript
'use client';

import { useCallback, useState } from 'react';
import configuration from '~/configuration';
import MultiFactorChallengeContainer from '~/app/auth/components/MultiFactorChallengeContainer';
import Trans from '~/core/ui/Trans';
import { setTrustedDeviceAction } from '~/lib/ultaura/trusted-device-actions';

function VerifyFormContainer() {
  const [trustDevice, setTrustDevice] = useState(false);

  const onSuccess = useCallback(async () => {
    // Redirect happens after optional trust-device call
    window.location.assign(configuration.paths.appHome);
  }, []);

  const onTrustDevice = useCallback(async (factorId: string) => {
    try {
      await setTrustedDeviceAction(factorId);
    } catch {
      // Trust device is best-effort -- don't block login if it fails
    }
  }, []);

  return (
    <div className="flex flex-col space-y-4">
      <MultiFactorChallengeContainer
        onSuccess={onSuccess}
        onTrustDevice={trustDevice ? onTrustDevice : undefined}
      />

      <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={trustDevice}
          onChange={(e) => setTrustDevice(e.target.checked)}
          className="rounded border-input"
        />
        <Trans i18nKey={'auth:trustDeviceLabel'} />
      </label>
    </div>
  );
}

export default VerifyFormContainer;
```

#### Step 7: Update MultiFactorChallengeContainer

Modify `src/app/auth/components/MultiFactorChallengeContainer.tsx`:

Add `onTrustDevice` to the props:

```typescript
function MultiFactorChallengeContainer({
  onSuccess,
  onTrustDevice,
}: React.PropsWithChildren<{
  onSuccess: () => void;
  onTrustDevice?: (factorId: string) => Promise<void>;
}>) {
```

In the `onSubmitClicked` handler, after successful verification:

```typescript
const onSubmitClicked: FormEventHandler<HTMLFormElement> = useCallback(
  async (event) => {
    event.preventDefault();

    if (!factorId || !verifyCode) {
      return;
    }

    await mutation.trigger({
      factorId,
      verifyCode,
    });

    // Trust device if user opted in
    if (onTrustDevice) {
      await onTrustDevice(factorId);
    }

    onSuccess();
  },
  [factorId, mutation, onSuccess, onTrustDevice, verifyCode],
);
```

Pass `onTrustDevice` through to `PhoneMfaChallengeForm` when rendering phone factors.

#### Step 8: Middleware — No Changes Required

The trusted-device check lives in `check-requires-mfa.ts`, which runs in Node.js server component context where `crypto.createHmac()` is available. Next.js middleware runs on Edge Runtime where Node.js `crypto` is not available — HMAC verification would require the Web Crypto API (`crypto.subtle`), which has a completely different async API.

**Do NOT add trusted-device bypass logic to middleware.** Admin users should always complete full MFA verification. The middleware's existing AAL2 check for admins remains unchanged.

#### Step 9: Update .env.ultaura.example

Add:

```
# Trusted Device: HMAC secret for signing trusted-device cookies (256-bit hex)
# Generate with: openssl rand -hex 32
TRUSTED_DEVICE_SECRET=
```

#### Step 10: Update use-sign-out hook

Modify `src/core/hooks/use-sign-out.ts`:

```typescript
import { signOutAction } from '~/lib/ultaura/auth-actions';

function useSignOut() {
  const client = useSupabase();
  return useCallback(async () => {
    await signOutAction(); // Clears HttpOnly trusted-device cookie + server-side session
    await client.auth.signOut(); // Fires client-side SIGNED_OUT event for AuthChangeListener
  }, [client.auth]);
}
```

> **Why both calls?** The server action clears the HttpOnly trusted-device cookie (which client-side JS cannot access) and signs out the server-side session. The client-side `signOut()` fires the Supabase `onAuthStateChange` event, which the `AuthChangeListener` component (`src/app/dashboard/(app)/components/OrganizationScopeLayout.tsx`) listens for to clear client-side state and redirect the user. Removing either call would break part of the sign-out flow.

### 8.7 Revocation

Trusted devices must be revoked under certain security-sensitive events:

| Event                                 | Action                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **User changes password**             | Clear the trusted-device cookie for the current session. For other devices: the simplest approach is to rotate `TRUSTED_DEVICE_SECRET`, which invalidates ALL trusted devices for ALL users. For per-user revocation, store trusted device nonces in a database table and check against it (future enhancement).                                            |
| **User unenrolls an MFA factor**      | In `MultiFactorAuthenticationSettings.tsx`, after successful unenroll, call `clearTrustedDeviceAction()` to clear the cookie. The `isTrustedDevice()` function also checks if the `factorId` in the cookie still exists in enrolled factors, so even without explicit revocation, an unenrolled factor's trusted device will fail validation on next check. |
| **User explicitly logs out**          | The `signOutAction()` server action (in `src/lib/ultaura/auth-actions.ts`) clears the trusted-device cookie and signs out the Supabase session. The `useSignOut` hook calls this action, then also calls `client.auth.signOut()` to fire the client-side `SIGNED_OUT` event for the `AuthChangeListener`.                                                   |
| **Admin revokes all trusted devices** | Rotate `TRUSTED_DEVICE_SECRET`. All existing tokens become invalid. This is a nuclear option that affects all users. Per-user revocation via a database table is a future enhancement.                                                                                                                                                                      |

**Implementation for logout revocation:**

Handled by `signOutAction()` in `src/lib/ultaura/auth-actions.ts` (see Step 4 above). The `useSignOut` hook in `src/core/hooks/use-sign-out.ts` calls this server action, then calls `client.auth.signOut()` for client-side event propagation.

**Implementation for factor unenroll revocation:**

In `MultiFactorAuthenticationSettings.tsx`, after the `useUnenrollFactor()` mutation succeeds, call the server action:

```typescript
import { clearTrustedDeviceAction } from '~/lib/ultaura/trusted-device-actions';

// After successful unenroll:
await clearTrustedDeviceAction();
```

### 8.8 Edge Cases

| Edge Case                                              | Handling                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Multiple devices per user**                          | Each device has its own cookie. The token includes a unique `nonce`, so each device's token is independent. Trusting one device does not affect others.                                                                                                                                                                       |
| **User enrolls new factor after trusting a device**    | The existing trusted-device cookie remains valid because it references the old factor ID. The user can trust the new device/factor separately after their next MFA challenge.                                                                                                                                                 |
| **User unenrolls the factor referenced in the cookie** | `isTrustedDevice()` checks that `factorId` still exists in enrolled factors. If the factor was unenrolled, the check fails, cookie is cleared, and MFA proceeds normally.                                                                                                                                                     |
| **Cookie tampering**                                   | HMAC-SHA256 signature verification fails (using timing-safe comparison). Cookie is silently deleted. MFA proceeds normally.                                                                                                                                                                                                   |
| **Clock skew**                                         | The `expiresAt` timestamp uses the server's clock at token creation time. The validation also uses the server's clock. Since both are on the same server (or close enough in a distributed setup), clock skew is not a practical concern. For extra safety, add a 5-minute grace period to the expiry check if needed.        |
| **Secret rotation**                                    | When `TRUSTED_DEVICE_SECRET` is rotated, all existing tokens fail signature verification. This is by design -- it's the "revoke all" mechanism. Users simply re-authenticate with MFA and re-trust their devices.                                                                                                             |
| **Missing env var**                                    | `getTrustedDeviceSecret()` throws if `TRUSTED_DEVICE_SECRET` is not set. The `verifyTrustedDeviceToken()` function catches all errors internally and returns `null`, falling back to normal MFA. Additionally, `check-requires-mfa.ts` wraps the `isTrustedDevice()` call in try-catch as a second safety net. No crash path. |

#### 8.8.5 Rate Limiting

The `setTrustedDeviceAction` server action requires AAL2 authentication, which limits abuse. However, consider adding rate limiting via Upstash Redis (matching the pattern in `telephony/src/routes/verify.ts`) if cookie creation becomes a concern. For the initial implementation, the AAL2 requirement is sufficient — an attacker would need to complete MFA to call this action, at which point they already have access.

---

## 9. Migration & Database Changes

**No database migrations are required for any of the four features.**

- **Phone MFA** is fully managed by Supabase Auth's built-in MFA system (factors stored in `auth.mfa_factors`)
- **MFA Nudge Banner** uses only a client-side cookie and a Supabase Auth API call
- **Trusted Device** uses a signed cookie (stateless) -- no database storage
- **Email MFA** is not being implemented

If per-user trusted device revocation is added in the future, a migration would be needed to create a `trusted_device_tokens` table. That is out of scope for this spec.

---

## 10. Testing Plan

### 10.1 Feature 1: SMS-Based 2FA

**Manual QA:**

1. Enroll a phone number via Settings > Authentication > "Add phone number"
2. Verify SMS is received with 6-digit code
3. Enter the code, confirm enrollment
4. Sign out and sign back in -- confirm phone factor appears in factor selection
5. Select phone factor, receive SMS, enter code, verify login succeeds
6. Test with invalid code -- verify error message
7. Test resend code functionality
8. Test rate limiting (try sending 5+ codes rapidly)
9. Unenroll the phone factor from settings
10. Verify factor no longer appears at login

**Unit tests to add/modify:**

- `src/lib/ultaura/__tests__/admin-auth.test.ts` -- add tests for phone factor handling in admin MFA checks
- Create `src/app/auth/components/__tests__/PhoneMfaChallengeForm.test.ts` -- test challenge send, verify, error states

### 10.2 Feature 3: 2FA Setup Nudge Banner

**Manual QA:**

1. Create a user with no MFA factors -- verify banner appears on dashboard home
2. Click dismiss (X button) -- verify banner disappears immediately
3. Refresh page -- verify banner stays hidden
4. Check cookies -- verify `mfa-nudge-dismissed` cookie is set with correct expiry
5. Delete the cookie manually -- refresh page -- verify banner reappears
6. Enroll any MFA factor -- verify banner no longer appears (even without dismiss cookie)
7. Click "Set up 2FA" CTA -- verify navigation to `/dashboard/settings/profile/authentication`

**Unit tests:**

- Create `src/components/ultaura/__tests__/MfaNudgeBanner.test.ts` -- mock Supabase factors response and cookies, verify render/no-render logic

### 10.3 Feature 4: Trusted Device

**Manual QA:**

1. Enable MFA (TOTP or phone), sign out, sign in
2. At MFA challenge, check "Trust this device for 30 days"
3. Complete MFA -- verify redirect to dashboard
4. Check cookies -- verify `trusted-device` cookie exists with HttpOnly flag
5. Sign out and sign in again -- verify MFA is skipped
6. Unenroll the MFA factor -- sign out -- sign in -- verify MFA behavior is correct
7. Manually delete the `trusted-device` cookie -- sign in -- verify MFA is required again
8. Tamper with the cookie value -- sign in -- verify MFA is required (tampering detected)

**Unit tests:**

- Create `src/lib/server/__tests__/trusted-device.test.ts` -- test `generateTrustedDeviceToken()` and `verifyTrustedDeviceToken()` with valid tokens, expired tokens, tampered tokens, wrong user ID
- Create `src/lib/server/cookies/__tests__/trusted-device.cookie.test.ts` -- test `isTrustedDevice()` with mock cookies and factors

**Server action tests:**

- Test `setTrustedDeviceAction`:
  - Returns error when user is not authenticated
  - Returns error when user is not at AAL2
  - Returns error when factorId doesn't belong to user
  - Sets cookie on success with valid token
- Test `clearTrustedDeviceAction`:
  - Clears the trusted-device cookie
- Test `signOutAction`:
  - Calls `client.auth.signOut()`
  - Clears the trusted-device cookie

### 10.4 Existing Tests to Update

- `src/lib/ultaura/__tests__/admin-auth.test.ts` -- the admin MFA tests may need updating if `check-requires-mfa.ts` behavior changes. Verify existing tests still pass after the trusted-device addition. May also need updates for the new `check-requires-mfa` function signature (optional `options` parameter).

---

## 11. Rollout Plan

### Suggested Implementation Order

| Phase | Feature                                         | Estimated Effort | Dependency                                        |
| ----- | ----------------------------------------------- | ---------------- | ------------------------------------------------- |
| **1** | Prerequisites (package upgrade, config changes) | 1-2 hours        | None                                              |
| **2** | Feature 3: 2FA Setup Nudge Banner               | 3-4 hours        | Phase 1 (needs factor check API)                  |
| **3** | Feature 1: SMS-Based 2FA                        | 1-2 days         | Phase 1 (needs `@supabase/supabase-js` >= 2.46.0) |
| **4** | Feature 4: Trusted Device                       | 1 day            | Phase 3 (needs MFA challenge flow to be updated)  |

**Rationale for this order:**

1. Prerequisites must come first (no phone MFA without the package upgrade)
2. Nudge banner is the simplest feature and independent -- can be shipped quickly to start driving MFA adoption
3. Phone MFA is the largest feature and the core of this upgrade
4. Trusted device depends on the MFA challenge flow being finalized (TOTP + phone) before adding the trust checkbox

### Feature Flags

No feature flags are strictly necessary since:

- Phone MFA enrollment is opt-in (users choose to add it)
- The nudge banner is dismissible
- Trusted device is opt-in (checkbox)

However, if desired, a feature flag could gate the nudge banner:

```typescript
// In MfaNudgeBanner.tsx:
const ENABLE_MFA_NUDGE = process.env.NEXT_PUBLIC_ENABLE_MFA_NUDGE !== 'false';
```

### Monitoring After Rollout

1. Monitor Supabase Auth logs for phone MFA errors (failed enrollments, failed challenges)
2. Track SMS costs via Twilio dashboard
3. Monitor the trusted-device server action for error rates
4. Check Sentry for any new errors in the MFA flow
5. After 30 days, check: what percentage of users who saw the nudge banner ended up enabling MFA?

---

## 12. Full File Index

### Files to Create

| #   | File Path                                                                    | Feature        | Purpose                                                   |
| --- | ---------------------------------------------------------------------------- | -------------- | --------------------------------------------------------- |
| 1   | `src/core/ui/PhoneNumberInput.tsx`                                           | Phone MFA      | Reusable phone number input with country code selector    |
| 2   | `src/app/dashboard/(app)/settings/profile/components/PhoneMfaSetupModal.tsx` | Phone MFA      | Modal for enrolling a phone number as MFA factor          |
| 3   | `src/app/auth/components/PhoneMfaChallengeForm.tsx`                          | Phone MFA      | Login challenge form for phone MFA factors                |
| 4   | `src/components/ultaura/MfaNudgeBanner.tsx`                                  | Nudge Banner   | Server component that conditionally renders the banner    |
| 5   | `src/components/ultaura/MfaNudgeBannerClient.tsx`                            | Nudge Banner   | Client component with banner UI and dismiss logic         |
| 6   | `src/lib/server/trusted-device.ts`                                           | Trusted Device | HMAC-SHA256 token signing and verification (timing-safe)  |
| 7   | `src/lib/server/cookies/trusted-device.cookie.ts`                            | Trusted Device | Server-side cookie read/write/validate/clear              |
| 8   | `src/lib/ultaura/trusted-device-actions.ts`                                  | Trusted Device | Server actions for setting/clearing trusted-device cookie |
| 9   | `src/lib/ultaura/auth-actions.ts`                                            | Trusted Device | Server action for sign-out (clears HttpOnly cookie)       |

### Files to Modify

| #   | File Path                                                                                                  | Feature(s)                | Summary of Changes                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `package.json`                                                                                             | Prerequisites             | Upgrade `@supabase/supabase-js` to >= 2.46.0                                                                                      |
| 2   | `telephony/package.json`                                                                                   | Prerequisites             | Upgrade `@supabase/supabase-js` to >= ^2.46.0                                                                                     |
| 3   | `supabase/config.toml`                                                                                     | Prerequisites             | Enable phone MFA (`enroll_enabled = true`, `verify_enabled = true`)                                                               |
| 4   | `.env.ultaura.example`                                                                                     | Trusted Device            | Add `TRUSTED_DEVICE_SECRET`                                                                                                       |
| 5   | `src/app/dashboard/(app)/settings/profile/authentication/components/MultiFactorAuthenticationSettings.tsx` | Phone MFA, Trusted Device | Add phone MFA setup button, import `PhoneMfaSetupModal`, update factor type badges, call `clearTrustedDeviceAction()` on unenroll |
| 6   | `src/app/dashboard/(app)/settings/profile/components/MultiFactorAuthSetupModal.tsx`                        | Phone MFA                 | Update modal heading to clarify TOTP-specific context                                                                             |
| 7   | `src/app/auth/components/MultiFactorChallengeContainer.tsx`                                                | Phone MFA, Trusted Device | Support phone factors in selection list, render `PhoneMfaChallengeForm` for phone factors, accept `onTrustDevice` callback        |
| 8   | `src/app/auth/verify/components/VerifyFormContainer.tsx`                                                   | Trusted Device            | Add "Trust this device" checkbox, call `setTrustedDeviceAction` server action on success                                          |
| 9   | `src/core/session/utils/check-requires-mfa.ts`                                                             | Trusted Device            | Add trusted-device cookie check before requiring MFA, accept optional `userId`/`factorIds` params                                 |
| 10  | `src/app/dashboard/(app)/page.tsx`                                                                         | Nudge Banner              | Import and render `MfaNudgeBanner` after `TrialExpiredBanner`                                                                     |
| 11  | `public/locales/en/profile.json`                                                                           | Phone MFA, Nudge Banner   | Add new i18n keys for phone MFA and nudge banner                                                                                  |
| 12  | `public/locales/en/auth.json`                                                                              | Phone MFA, Trusted Device | Add new i18n keys for phone challenge flow and trusted device                                                                     |
| 13  | `src/core/hooks/use-sign-out.ts`                                                                           | Trusted Device            | Call `signOutAction` server action to clear HttpOnly trusted-device cookie, then `client.auth.signOut()` for AuthChangeListener   |
| 14  | `src/lib/user/require-session.ts`                                                                          | Trusted Device            | Update `verifyRequiresMfa()` call — use internal fallback (no options parameter) or pass `data.session?.user?.id`                 |
| 15  | `src/lib/ultaura/__tests__/admin-auth.test.ts`                                                             | Trusted Device            | May need updates for new `check-requires-mfa` optional `options` parameter signature                                              |

### Test Files

| #   | File Path                                                         | Feature        | Purpose                                        |
| --- | ----------------------------------------------------------------- | -------------- | ---------------------------------------------- |
| T1  | `src/app/auth/components/__tests__/PhoneMfaChallengeForm.test.ts` | Phone MFA      | Unit tests for phone challenge form            |
| T2  | `src/components/ultaura/__tests__/MfaNudgeBanner.test.ts`         | Nudge Banner   | Unit tests for banner display/dismiss logic    |
| T3  | `src/lib/server/__tests__/trusted-device.test.ts`                 | Trusted Device | Unit tests for crypto (generate/verify tokens) |
| T4  | `src/lib/server/cookies/__tests__/trusted-device.cookie.test.ts`  | Trusted Device | Unit tests for cookie read/write/clear         |

---

## 13. Environment Variables

| Variable                | Required By                                     | Description                                                                                                                                                                                                                                                                                                                                                                       | Example Value                         |
| ----------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `TRUSTED_DEVICE_SECRET` | Feature 4 (Trusted Device)                      | 256-bit hex secret used to HMAC-sign trusted device tokens. Generate with `openssl rand -hex 32`. Must be the same across all instances of the Next.js app. Rotating this value invalidates all existing trusted devices.                                                                                                                                                         | `a1b2c3d4e5f6...` (64 hex characters) |
| `ADMIN_ENFORCE_MFA`     | Existing (unchanged)                            | Whether to enforce MFA for admin users. Already exists. No changes needed.                                                                                                                                                                                                                                                                                                        | `true`                                |
| `ENVIRONMENT`           | Feature 4 (Trusted Device), server-side cookies | Controls `Secure` flag on server-side cookies (`trusted-device`, `organization`). Must be set to `production` in production deployments. Set automatically in `.env.production` but must be configured in hosting environments (Vercel, etc.). This is separate from `NODE_ENV` — the codebase uses `ENVIRONMENT` specifically for cookie security in server-side cookie modules. | `production`                          |

**Supabase Dashboard settings (not env vars, configured via Supabase UI):**

| Setting                    | Location                 | Value               |
| -------------------------- | ------------------------ | ------------------- |
| Phone provider enabled     | Auth > Providers > Phone | `true`              |
| Twilio Account SID         | Auth > Providers > Phone | From Twilio console |
| Twilio Auth Token          | Auth > Providers > Phone | From Twilio console |
| Twilio Message Service SID | Auth > Providers > Phone | From Twilio console |

---

## 14. i18n Complete Key List

All new translation keys across all features, organized by locale file:

### `public/locales/en/profile.json`

| Key                          | Value                                                                                     | Feature      |
| ---------------------------- | ----------------------------------------------------------------------------------------- | ------------ |
| `setupTotpButtonLabel`       | `"Set up authenticator app"`                                                              | Phone MFA    |
| `setupPhoneMfaButtonLabel`   | `"Add phone number"`                                                                      | Phone MFA    |
| `setupTotpModalHeading`      | `"Set up authenticator app"`                                                              | Phone MFA    |
| `setupTotpModalDescription`  | `"Scan the QR code with your authenticator app and confirm."`                             | Phone MFA    |
| `phoneMfaModalHeading`       | `"Add phone number for verification"`                                                     | Phone MFA    |
| `phoneMfaModalDescription`   | `"We'll send a verification code via SMS when you sign in."`                              | Phone MFA    |
| `phoneNumberLabel`           | `"Phone Number"`                                                                          | Phone MFA    |
| `phoneNumberPlaceholder`     | `"(555) 123-4567"`                                                                        | Phone MFA    |
| `sendVerificationCodeButton` | `"Send verification code"`                                                                | Phone MFA    |
| `smsSentMessage`             | `"We sent a verification code to {{phone}}"`                                              | Phone MFA    |
| `resendCode`                 | `"Resend code"`                                                                           | Phone MFA    |
| `resendCodeCooldown`         | `"Resend code in {{seconds}}s"`                                                           | Phone MFA    |
| `phoneMfaSetupSuccess`       | `"Phone number successfully enrolled"`                                                    | Phone MFA    |
| `phoneMfaSetupError`         | `"Sorry, there was an error enrolling your phone number. Please try again."`              | Phone MFA    |
| `invalidPhoneNumber`         | `"Please enter a valid phone number including country code."`                             | Phone MFA    |
| `phoneAlreadyEnrolled`       | `"This phone number is already enrolled as a factor."`                                    | Phone MFA    |
| `smsDeliveryError`           | `"We couldn't send the verification code. Please check your phone number and try again."` | Phone MFA    |
| `codeExpired`                | `"This code has expired. Click 'Resend code' to get a new one."`                          | Phone MFA    |
| `tooManyAttempts`            | `"Too many attempts. Please wait before requesting a new code."`                          | Phone MFA    |
| `maxFactorsReached`          | `"Maximum authentication methods reached (10)."`                                          | Phone MFA    |
| `factorTypeSms`              | `"SMS"`                                                                                   | Phone MFA    |
| `factorTypeTotp`             | `"Authenticator App"`                                                                     | Phone MFA    |
| `mfaNudgeHeading`            | `"Secure your account"`                                                                   | Nudge Banner |
| `mfaNudgeDescription`        | `"Add two-factor authentication for extra security. It only takes a minute."`             | Nudge Banner |
| `mfaNudgeCta`                | `"Set up 2FA"`                                                                            | Nudge Banner |

### `public/locales/en/auth.json`

| Key                            | Value                                                                | Feature        |
| ------------------------------ | -------------------------------------------------------------------- | -------------- |
| `phoneMfaChallengeHeading`     | `"Enter verification code"`                                          | Phone MFA      |
| `phoneMfaChallengeDescription` | `"We sent a 6-digit code to your phone number."`                     | Phone MFA      |
| `phoneMfaResendCode`           | `"Resend code"`                                                      | Phone MFA      |
| `phoneMfaResendCooldown`       | `"Resend in {{seconds}}s"`                                           | Phone MFA      |
| `phoneMfaVerifyError`          | `"Invalid code. Please try again."`                                  | Phone MFA      |
| `phoneMfaSendError`            | `"Failed to send code. Please try again."`                           | Phone MFA      |
| `selectFactorHeading`          | `"Choose a verification method"`                                     | Phone MFA      |
| `trustDeviceLabel`             | `"Trust this device for 30 days"`                                    | Trusted Device |
| `trustDeviceDescription`       | `"Skip the verification step next time you sign in on this device."` | Trusted Device |

---

## 15. Out of Scope

The following items are explicitly excluded from this spec. They may be addressed in future work.

| Item                                                | Rationale                                                                                                                                                                                                                 | Lockout Recovery Path                                                                                                                                                                                                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Recovery codes**                                  | Recovery codes (one-time backup codes) are an important MFA safety net but add significant implementation scope (generation, storage, hashing, UI for display/download, verification flow). Deferred to a follow-up spec. | If a user loses access to all their MFA factors (phone lost, authenticator app deleted), an Ultaura admin can manually remove their MFA factors via the Supabase Dashboard: Authentication > Users > select user > MFA Factors > delete. The user can then log in and re-enroll. |
| **WhatsApp as SMS channel**                         | Supabase supports `channel: 'whatsapp'` for phone MFA challenges. Not included in initial rollout but trivial to add (single parameter change).                                                                           | N/A                                                                                                                                                                                                                                                                              |
| **Voice call OTP delivery**                         | Supabase does not support voice calls for MFA OTP delivery. Would require a custom implementation via the telephony backend.                                                                                              | N/A                                                                                                                                                                                                                                                                              |
| **Per-user trusted device revocation via database** | The current spec uses stateless HMAC cookies. A database-backed approach (storing device tokens per user) would enable granular revocation but requires a new table and migration.                                        | N/A                                                                                                                                                                                                                                                                              |
| **Admin panel for managing user MFA**               | No admin UI for viewing/managing individual user MFA enrollments. Currently requires Supabase Dashboard access.                                                                                                           | N/A                                                                                                                                                                                                                                                                              |
| **MFA analytics dashboard**                         | No metrics on MFA adoption rate, challenge success/failure rates, or trusted device usage.                                                                                                                                | N/A                                                                                                                                                                                                                                                                              |
| **Mandatory MFA enforcement for regular users**     | MFA remains opt-in for non-admin users. Family-enforced MFA (account owner requires MFA for all members) is a separate feature.                                                                                           | N/A                                                                                                                                                                                                                                                                              |
