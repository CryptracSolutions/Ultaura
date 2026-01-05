# Environment Variable Alignment Specification

## Objective

Eliminate environment variable mismatches that cause production failures by:
1. Standardizing all Ultaura-specific variable names with `ULTAURA_` prefix
2. Aligning documentation with actual code usage
3. Implementing startup validation with format checking
4. Making undocumented configurable features actually configurable

## Scope

### In Scope
- Rename inconsistent environment variables to use `ULTAURA_` prefix
- Align code, `.env.ultaura.example`, `CLAUDE.md`, and `AGENTS.md`
- Add startup validation for critical variables
- Implement previously documented but unused variables
- Remove legacy/deprecated variable names
- Standardize key formats (hex for encryption)

### Out of Scope
- MakerKit/Next.js standard variables (`NEXT_PUBLIC_*`, `SUPABASE_*`, `STRIPE_SECRET_KEY`, etc.)
- Email configuration variables
- Chatbot plugin variables

---

## Variable Renaming Summary

| Current Name | New Name | Format | Required |
|--------------|----------|--------|----------|
| `MEMORY_ENCRYPTION_KEY` | `ULTAURA_ENCRYPTION_KEY` | 64 hex chars | Yes |
| `TELEPHONY_WEBHOOK_SECRET` | `ULTAURA_INTERNAL_API_SECRET` | Random string (32+ chars) | Yes |
| `TELEPHONY_BACKEND_URL` | `ULTAURA_BACKEND_URL` | HTTP(S) URL | Yes |
| `TELEPHONY_PUBLIC_URL` | `ULTAURA_PUBLIC_URL` | HTTPS URL | Yes |
| `TELEPHONY_WEBSOCKET_URL` | `ULTAURA_WEBSOCKET_URL` | WSS URL | Yes |
| `TELEPHONY_PORT` | `PORT` | Number | No (default: 3001) |
| `TELEPHONY_DEBUG` | `ULTAURA_DEBUG` | Boolean | No (default: false) |
| `DEFAULT_TIMEZONE` | `ULTAURA_DEFAULT_TIMEZONE` | IANA timezone | No (default: America/Los_Angeles) |
| `ENABLE_CALL_RECORDING` | `ULTAURA_ENABLE_RECORDING` | Boolean | No (default: false) |

### Variables to Remove
| Variable | Reason |
|----------|--------|
| `MAX_CALL_DURATION_SECONDS` | Business decision: calls should have no duration limit |
| `ULTAURA_KEK_BASE64` | Incorrect name in CLAUDE.md; replaced by `ULTAURA_ENCRYPTION_KEY` |
| `STRIPE_PRICE_CARE_MONTHLY` | Legacy fallback; use `STRIPE_ULTAURA_CARE_MONTHLY_PRICE_ID` |
| `STRIPE_PRICE_CARE_ANNUAL` | Legacy fallback; use `STRIPE_ULTAURA_CARE_ANNUAL_PRICE_ID` |
| `STRIPE_PRICE_COMFORT_MONTHLY` | Legacy fallback; use `STRIPE_ULTAURA_COMFORT_MONTHLY_PRICE_ID` |
| `STRIPE_PRICE_COMFORT_ANNUAL` | Legacy fallback; use `STRIPE_ULTAURA_COMFORT_ANNUAL_PRICE_ID` |
| `STRIPE_PRICE_FAMILY_MONTHLY` | Legacy fallback; use `STRIPE_ULTAURA_FAMILY_MONTHLY_PRICE_ID` |
| `STRIPE_PRICE_FAMILY_ANNUAL` | Legacy fallback; use `STRIPE_ULTAURA_FAMILY_ANNUAL_PRICE_ID` |
| `STRIPE_PRICE_PAYG_METERED` | Legacy fallback; use `STRIPE_ULTAURA_PAYG_PRICE_ID` |

### Variables Unchanged (Already Correct)
| Variable | Notes |
|----------|-------|
| `TWILIO_ACCOUNT_SID` | Twilio-prefixed, standard |
| `TWILIO_AUTH_TOKEN` | Twilio-prefixed, standard |
| `TWILIO_PHONE_NUMBER` | Twilio-prefixed, standard |
| `TWILIO_VERIFY_SERVICE_SID` | Twilio-prefixed, standard |
| `TWILIO_AMD_ENABLED` | Twilio-prefixed, standard |
| `XAI_API_KEY` | xAI-prefixed, standard |
| `XAI_GROK_MODEL` | xAI-prefixed, standard |
| `ULTAURA_APP_URL` | Already has ULTAURA_ prefix |
| `STRIPE_ULTAURA_*_PRICE_ID` | Already correct naming |

---

## Technical Requirements

### 1. Encryption Key (`ULTAURA_ENCRYPTION_KEY`)

**Current State:**
- Code: `telephony/src/utils/encryption.ts:14` reads `MEMORY_ENCRYPTION_KEY`
- Docs: CLAUDE.md incorrectly says `ULTAURA_KEK_BASE64` (base64 format)
- Example: `.env.ultaura.example` says `MEMORY_ENCRYPTION_KEY` (hex format)

**Target State:**
```
Variable: ULTAURA_ENCRYPTION_KEY
Format: 64 hexadecimal characters (256 bits)
Generation: openssl rand -hex 32
Validation: Must be exactly 64 characters, all hex digits [0-9a-fA-F]
```

**Code Changes:**
```typescript
// telephony/src/utils/encryption.ts
// Change line 14 from:
const kekHex = process.env.MEMORY_ENCRYPTION_KEY;
// To:
const kekHex = process.env.ULTAURA_ENCRYPTION_KEY;

// Update error message to reference new variable name
```

---

### 2. Internal API Secret (`ULTAURA_INTERNAL_API_SECRET`)

**Current State:**
- Code: Uses `TELEPHONY_WEBHOOK_SECRET` in 8 files
- Docs: `.env.ultaura.example` documents both names inconsistently

**Target State:**
```
Variable: ULTAURA_INTERNAL_API_SECRET
Format: Random string, minimum 32 characters
Generation: openssl rand -hex 32
Purpose: Service-to-service authentication between Next.js and telephony backend
```

**Files to Update:**
| File | Line(s) |
|------|---------|
| `src/lib/ultaura/actions.ts` | 502, 562, 1088 |
| `src/app/api/telephony/upgrade/route.ts` | 39, 171 |
| `telephony/src/routes/calls.ts` | 14 |
| `telephony/src/routes/internal/sms.ts` | 13 |
| `telephony/src/routes/tools/overage-action.ts` | 75 |
| `telephony/src/routes/tools/request-upgrade.ts` | 117 |
| `telephony/src/scheduler/call-scheduler.ts` | 299, 505 |
| `telephony/src/websocket/grok-bridge.ts` | 728 |

---

### 3. Backend URL (`ULTAURA_BACKEND_URL`)

**Current State:**
- Code: Uses `TELEPHONY_BACKEND_URL` with fallback to `http://localhost:${PORT || 3001}`

**Target State:**
```
Variable: ULTAURA_BACKEND_URL
Format: HTTP(S) URL (e.g., http://localhost:3001)
Required: Yes (no implicit fallback in production)
Example: http://localhost:3001 (dev), https://telephony.ultaura.com (prod)
```

**Files to Update:**
| File | Line(s) |
|------|---------|
| `src/lib/ultaura/constants.ts` | 308 |
| `src/lib/ultaura/actions.ts` | 495, 555, 1066 |
| `telephony/src/routes/calls.ts` | 109, 185 |
| `telephony/src/scheduler/call-scheduler.ts` | 293, 499 |
| `telephony/src/websocket/grok-bridge.ts` | 331, 483 |

---

### 4. Public URL (`ULTAURA_PUBLIC_URL`)

**Current State:**
- Documented as `TELEPHONY_PUBLIC_URL` but primarily used for Twilio webhook configuration

**Target State:**
```
Variable: ULTAURA_PUBLIC_URL
Format: HTTPS URL (must be publicly accessible)
Required: Yes
Example: https://api.ultaura.com
Purpose: Public URL for Twilio webhooks (voice, status callbacks)
```

---

### 5. WebSocket URL (`ULTAURA_WEBSOCKET_URL`)

**Current State:**
- Code: Uses `TELEPHONY_WEBSOCKET_URL` with fallback `wss://${req.headers.host}/twilio/media`
- CLAUDE.md: Lists it as required
- `.env.ultaura.example`: NOT present

**Target State:**
```
Variable: ULTAURA_WEBSOCKET_URL
Format: WSS URL (e.g., wss://api.ultaura.com/twilio/media)
Required: Yes (remove fallback behavior)
Purpose: WebSocket endpoint for Twilio Media Streams
```

**Files to Update:**
| File | Line(s) |
|------|---------|
| `telephony/src/routes/twilio-inbound.ts` | 129 |
| `telephony/src/routes/twilio-outbound.ts` | 168 |

**Code Change:**
```typescript
// Remove fallback, require explicit configuration
const websocketUrl = process.env.ULTAURA_WEBSOCKET_URL;
if (!websocketUrl) {
  throw new Error('Missing ULTAURA_WEBSOCKET_URL environment variable');
}
```

---

### 6. xAI Realtime URL (`XAI_REALTIME_URL`)

**Current State:**
- Code: Hardcoded as `wss://api.x.ai/v1/realtime` in `grok-bridge.ts:22`
- Docs: Listed in `.env.ultaura.example`

**Target State:**
```
Variable: XAI_REALTIME_URL
Format: WSS URL
Required: No (default: wss://api.x.ai/v1/realtime)
Purpose: xAI Grok Voice Agent WebSocket endpoint
```

**Code Change:**
```typescript
// telephony/src/websocket/grok-bridge.ts
// Change from hardcoded:
const GROK_REALTIME_URL = 'wss://api.x.ai/v1/realtime';
// To:
const GROK_REALTIME_URL = process.env.XAI_REALTIME_URL || 'wss://api.x.ai/v1/realtime';
```

---

### 7. Port Variable (`PORT`)

**Current State:**
- Code: Uses `PORT` with default `3001`
- Docs: Documents `TELEPHONY_PORT`

**Target State:**
```
Variable: PORT
Format: Number
Required: No (default: 3001)
Rationale: Standard Node.js convention; works automatically with hosting platforms
```

**Documentation Change:**
- Remove references to `TELEPHONY_PORT` in docs
- Document as `PORT` with note about Node.js convention

---

### 8. Debug Mode (`ULTAURA_DEBUG`)

**Current State:**
- Documented as `TELEPHONY_DEBUG` in `.env.ultaura.example`
- NOT implemented in code

**Target State:**
```
Variable: ULTAURA_DEBUG
Format: Boolean (true/false)
Required: No (default: false)
Purpose: Enable verbose debug logging in telephony backend
```

**Implementation:**
```typescript
// telephony/src/utils/logger.ts
const isDebug = process.env.ULTAURA_DEBUG === 'true';

// Use isDebug to:
// 1. Set log level to 'debug' when enabled
// 2. Log additional call session details
// 3. Log Grok API request/response payloads (redacted for sensitive data)
// 4. Log WebSocket message flow
```

---

### 9. Default Timezone (`ULTAURA_DEFAULT_TIMEZONE`)

**Current State:**
- Documented as `DEFAULT_TIMEZONE` in `.env.ultaura.example`
- Hardcoded as `'America/Los_Angeles'` in `constants.ts:124`
- NOT read from environment

**Target State:**
```
Variable: ULTAURA_DEFAULT_TIMEZONE
Format: IANA timezone string (e.g., America/New_York)
Required: No (default: America/Los_Angeles)
Purpose: Default timezone for new lines/schedules
```

**Implementation:**
```typescript
// src/lib/ultaura/constants.ts
DEFAULT_TIMEZONE: process.env.ULTAURA_DEFAULT_TIMEZONE || 'America/Los_Angeles',
```

---

### 10. Call Recording (`ULTAURA_ENABLE_RECORDING`)

**Current State:**
- Documented as `ENABLE_CALL_RECORDING` in `.env.ultaura.example`
- NOT implemented in code

**Target State:**
```
Variable: ULTAURA_ENABLE_RECORDING
Format: Boolean (true/false)
Required: No (default: false)
Purpose: Enable call recording via Twilio
```

**Implementation:**
```typescript
// telephony/src/routes/calls.ts (in makeOutboundCall)
const enableRecording = process.env.ULTAURA_ENABLE_RECORDING === 'true';

const twiml = new VoiceResponse();
const connect = twiml.connect();
connect.stream({
  url: websocketUrl,
  track: 'both_tracks',
});

// Add recording if enabled
if (enableRecording) {
  connect.record({
    recordingStatusCallback: `${baseUrl}/twilio/recording-status`,
    recordingStatusCallbackEvent: ['completed'],
  });
}
```

---

## Startup Validation

### Implementation

Create a new validation module that runs at server startup:

```typescript
// telephony/src/utils/env-validator.ts

interface EnvVariable {
  name: string;
  required: boolean;
  format?: 'hex64' | 'url' | 'wss' | 'boolean' | 'number' | 'timezone';
  default?: string;
}

const ULTAURA_ENV_VARS: EnvVariable[] = [
  // Required - Critical
  { name: 'ULTAURA_ENCRYPTION_KEY', required: true, format: 'hex64' },
  { name: 'ULTAURA_INTERNAL_API_SECRET', required: true },
  { name: 'ULTAURA_BACKEND_URL', required: true, format: 'url' },
  { name: 'ULTAURA_PUBLIC_URL', required: true, format: 'url' },
  { name: 'ULTAURA_WEBSOCKET_URL', required: true, format: 'wss' },

  // Required - External Services
  { name: 'XAI_API_KEY', required: true },
  { name: 'TWILIO_ACCOUNT_SID', required: true },
  { name: 'TWILIO_AUTH_TOKEN', required: true },
  { name: 'TWILIO_PHONE_NUMBER', required: true },
  { name: 'SUPABASE_URL', required: true, format: 'url' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', required: true },

  // Optional with defaults
  { name: 'PORT', required: false, format: 'number', default: '3001' },
  { name: 'ULTAURA_DEBUG', required: false, format: 'boolean', default: 'false' },
  { name: 'ULTAURA_DEFAULT_TIMEZONE', required: false, format: 'timezone', default: 'America/Los_Angeles' },
  { name: 'ULTAURA_ENABLE_RECORDING', required: false, format: 'boolean', default: 'false' },
  { name: 'XAI_REALTIME_URL', required: false, format: 'wss', default: 'wss://api.x.ai/v1/realtime' },
  { name: 'TWILIO_AMD_ENABLED', required: false, format: 'boolean', default: 'true' },
];

function validateEnvVariables(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const variable of ULTAURA_ENV_VARS) {
    const value = process.env[variable.name];

    // Check required
    if (variable.required && !value) {
      errors.push(`Missing required environment variable: ${variable.name}`);
      continue;
    }

    // Skip format validation if not set and not required
    if (!value) continue;

    // Format validation
    if (variable.format) {
      const formatError = validateFormat(variable.name, value, variable.format);
      if (formatError) {
        errors.push(formatError);
      }
    }
  }

  if (errors.length > 0) {
    console.error('\n========================================');
    console.error('ENVIRONMENT VALIDATION FAILED');
    console.error('========================================\n');
    errors.forEach(err => console.error(`  - ${err}`));
    console.error('\n');
    process.exit(1);
  }

  if (warnings.length > 0) {
    warnings.forEach(warn => console.warn(`[ENV WARNING] ${warn}`));
  }
}

function validateFormat(name: string, value: string, format: string): string | null {
  switch (format) {
    case 'hex64':
      if (!/^[0-9a-fA-F]{64}$/.test(value)) {
        return `${name} must be exactly 64 hexadecimal characters. Got ${value.length} chars.`;
      }
      break;
    case 'url':
      if (!/^https?:\/\/.+/.test(value)) {
        return `${name} must be a valid HTTP(S) URL. Got: ${value}`;
      }
      break;
    case 'wss':
      if (!/^wss?:\/\/.+/.test(value)) {
        return `${name} must be a valid WebSocket URL (ws:// or wss://). Got: ${value}`;
      }
      break;
    case 'boolean':
      if (!['true', 'false'].includes(value.toLowerCase())) {
        return `${name} must be 'true' or 'false'. Got: ${value}`;
      }
      break;
    case 'number':
      if (!/^\d+$/.test(value)) {
        return `${name} must be a number. Got: ${value}`;
      }
      break;
    case 'timezone':
      // Basic IANA timezone validation
      if (!/^[A-Za-z_]+\/[A-Za-z_]+$/.test(value)) {
        return `${name} must be a valid IANA timezone (e.g., America/New_York). Got: ${value}`;
      }
      break;
  }
  return null;
}

export { validateEnvVariables };
```

### Integration

```typescript
// telephony/src/server.ts (at the top, before any other initialization)
import { validateEnvVariables } from './utils/env-validator';

// Validate environment before starting server
validateEnvVariables();

// ... rest of server initialization
```

---

## Documentation Updates

### Files to Update

1. **`.env.ultaura.example`** - Primary example file
2. **`CLAUDE.md`** - Project documentation
3. **`AGENTS.md`** (if exists) - Agent documentation

### Updated `.env.ultaura.example` Template

```bash
# ============================================
# ULTAURA ENVIRONMENT CONFIGURATION
# ============================================
# Copy this file to .env.local and fill in your values
# All ULTAURA_* variables are specific to the Ultaura application
# ============================================

# ============================================
# ULTAURA CORE CONFIGURATION (Required)
# ============================================

# Encryption key for memory storage (AES-256-GCM)
# Generate with: openssl rand -hex 32
# MUST be exactly 64 hexadecimal characters
ULTAURA_ENCRYPTION_KEY=

# Internal API authentication between Next.js and telephony backend
# Generate with: openssl rand -hex 32
ULTAURA_INTERNAL_API_SECRET=

# Telephony backend URLs
# ULTAURA_BACKEND_URL: Internal URL (used by Next.js to call telephony)
# ULTAURA_PUBLIC_URL: Public URL (used by Twilio webhooks)
# ULTAURA_WEBSOCKET_URL: WebSocket URL for Twilio Media Streams
ULTAURA_BACKEND_URL=http://localhost:3001
ULTAURA_PUBLIC_URL=https://your-telephony-server.com
ULTAURA_WEBSOCKET_URL=wss://your-telephony-server.com/twilio/media

# Web app URL (defaults to NEXT_PUBLIC_SITE_URL if unset)
ULTAURA_APP_URL=http://localhost:3000

# ============================================
# TWILIO CONFIGURATION (Required)
# ============================================
# Get these from https://console.twilio.com

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Answering Machine Detection (optional, default: true)
TWILIO_AMD_ENABLED=true

# Skip signature validation in development only (default: false)
# SKIP_TWILIO_SIGNATURE_VALIDATION=false

# ============================================
# XAI GROK VOICE AGENT (Required)
# ============================================
# Get API key from https://console.x.ai

XAI_API_KEY=xai-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
XAI_GROK_MODEL=grok-3-fast

# xAI Realtime WebSocket URL (optional, has default)
# XAI_REALTIME_URL=wss://api.x.ai/v1/realtime

# ============================================
# STRIPE BILLING (Required for paid features)
# ============================================
# Price IDs from your Stripe Dashboard

STRIPE_ULTAURA_CARE_MONTHLY_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_ULTAURA_CARE_ANNUAL_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_ULTAURA_COMFORT_MONTHLY_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_ULTAURA_COMFORT_ANNUAL_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_ULTAURA_FAMILY_MONTHLY_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_ULTAURA_FAMILY_ANNUAL_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_ULTAURA_PAYG_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_ULTAURA_OVERAGE_PRICE_ID=price_xxxxxxxxxxxxx

# ============================================
# OPTIONAL CONFIGURATION
# ============================================

# Server port (standard Node.js convention)
# PORT=3001

# Enable debug logging (default: false)
# ULTAURA_DEBUG=false

# Default timezone for new lines (IANA format)
# ULTAURA_DEFAULT_TIMEZONE=America/Los_Angeles

# Enable call recording via Twilio (default: false)
# ULTAURA_ENABLE_RECORDING=false

# CORS allowed origins (comma-separated)
# ALLOWED_ORIGINS=http://localhost:3000,https://your-app.vercel.app
```

### CLAUDE.md Updates

Update the Environment Configuration section to match the new variable names:

```markdown
### 1. Environment Configuration

\`\`\`bash
cp .env.ultaura.example .env.local
\`\`\`

**Required Environment Variables:**

\`\`\`bash
# Ultaura Core
ULTAURA_ENCRYPTION_KEY=        # 64 hex chars (openssl rand -hex 32)
ULTAURA_INTERNAL_API_SECRET=   # API auth secret
ULTAURA_BACKEND_URL=           # http://localhost:3001
ULTAURA_PUBLIC_URL=            # Public URL for Twilio webhooks
ULTAURA_WEBSOCKET_URL=         # WSS URL for Twilio Media Streams

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=           # E.164 format
TWILIO_VERIFY_SERVICE_SID=
TWILIO_AMD_ENABLED=true        # Answering machine detection

# xAI Grok
XAI_API_KEY=
XAI_GROK_MODEL=grok-3-fast

# Stripe (8 price IDs)
STRIPE_ULTAURA_CARE_MONTHLY_PRICE_ID=
STRIPE_ULTAURA_CARE_ANNUAL_PRICE_ID=
STRIPE_ULTAURA_COMFORT_MONTHLY_PRICE_ID=
STRIPE_ULTAURA_COMFORT_ANNUAL_PRICE_ID=
STRIPE_ULTAURA_FAMILY_MONTHLY_PRICE_ID=
STRIPE_ULTAURA_FAMILY_ANNUAL_PRICE_ID=
STRIPE_ULTAURA_PAYG_PRICE_ID=
STRIPE_ULTAURA_OVERAGE_PRICE_ID=
\`\`\`
```

---

## Implementation Approach

### Phase 1: Create Validation Module
1. Create `telephony/src/utils/env-validator.ts` with format validation
2. Integrate into `telephony/src/server.ts` startup
3. Test validation catches missing/malformed variables

### Phase 2: Rename Variables in Code
Update each file to use new variable names:

| Priority | File | Changes |
|----------|------|---------|
| 1 | `telephony/src/utils/encryption.ts` | `MEMORY_ENCRYPTION_KEY` → `ULTAURA_ENCRYPTION_KEY` |
| 2 | `telephony/src/routes/calls.ts` | Multiple: `TELEPHONY_WEBHOOK_SECRET`, `TELEPHONY_BACKEND_URL` |
| 3 | `telephony/src/routes/twilio-inbound.ts` | `TELEPHONY_WEBSOCKET_URL` → `ULTAURA_WEBSOCKET_URL` |
| 4 | `telephony/src/routes/twilio-outbound.ts` | `TELEPHONY_WEBSOCKET_URL` → `ULTAURA_WEBSOCKET_URL` |
| 5 | `telephony/src/scheduler/call-scheduler.ts` | `TELEPHONY_WEBHOOK_SECRET`, `TELEPHONY_BACKEND_URL` |
| 6 | `telephony/src/websocket/grok-bridge.ts` | `TELEPHONY_WEBHOOK_SECRET`, `TELEPHONY_BACKEND_URL`, make `XAI_REALTIME_URL` configurable |
| 7 | `telephony/src/routes/internal/sms.ts` | `TELEPHONY_WEBHOOK_SECRET` |
| 8 | `telephony/src/routes/tools/overage-action.ts` | `TELEPHONY_WEBHOOK_SECRET` |
| 9 | `telephony/src/routes/tools/request-upgrade.ts` | `TELEPHONY_WEBHOOK_SECRET` |
| 10 | `src/lib/ultaura/actions.ts` | `TELEPHONY_WEBHOOK_SECRET`, `TELEPHONY_BACKEND_URL` |
| 11 | `src/lib/ultaura/constants.ts` | `TELEPHONY_BACKEND_URL`, remove legacy Stripe fallbacks, make `DEFAULT_TIMEZONE` configurable |
| 12 | `src/app/api/telephony/upgrade/route.ts` | `TELEPHONY_WEBHOOK_SECRET` |
| 13 | `telephony/src/utils/logger.ts` | Implement `ULTAURA_DEBUG` |

### Phase 3: Implement New Features
1. **ULTAURA_DEBUG**: Update logger to check env and enable debug mode
2. **ULTAURA_DEFAULT_TIMEZONE**: Update constants.ts to read from env
3. **ULTAURA_ENABLE_RECORDING**: Add recording logic to call routes

### Phase 4: Update Documentation
1. Update `.env.ultaura.example` with new template
2. Update `CLAUDE.md` Environment Configuration section
3. Update `AGENTS.md` if it contains env documentation
4. Search for any README files that reference old variable names

### Phase 5: Remove Deprecated Code
1. Remove legacy Stripe fallbacks from `constants.ts` (lines 65-71)
2. Remove `MAX_CALL_DURATION_SECONDS` from constants and docs
3. Remove any remaining references to old variable names

---

## Testing Considerations

### Manual Testing Checklist
- [ ] Server fails to start when `ULTAURA_ENCRYPTION_KEY` is missing
- [ ] Server fails to start when `ULTAURA_ENCRYPTION_KEY` is wrong length
- [ ] Server fails to start when `ULTAURA_ENCRYPTION_KEY` contains non-hex chars
- [ ] Server fails to start when `ULTAURA_INTERNAL_API_SECRET` is missing
- [ ] Server fails to start when `ULTAURA_WEBSOCKET_URL` is missing
- [ ] Server starts successfully when all required vars are present
- [ ] Debug logging works when `ULTAURA_DEBUG=true`
- [ ] Recording works when `ULTAURA_ENABLE_RECORDING=true`
- [ ] Timezone override works with `ULTAURA_DEFAULT_TIMEZONE`
- [ ] Existing calls/memories continue to decrypt (encryption key value unchanged, just variable name)

### Integration Testing
- [ ] Twilio webhooks receive calls at `ULTAURA_PUBLIC_URL`
- [ ] WebSocket connections work at `ULTAURA_WEBSOCKET_URL`
- [ ] Next.js can call telephony backend at `ULTAURA_BACKEND_URL`
- [ ] Internal API auth works with `ULTAURA_INTERNAL_API_SECRET`

---

## Edge Cases and Error Handling

### Encryption Key Migration
- **No data migration needed**: Only the variable name changes, not the value
- Existing encrypted data will continue to decrypt as long as the same key value is used
- **Warning**: Changing the key value (not just the name) will make existing memories undecryptable

### Startup Failure Messages
Validation errors should be clear and actionable:
```
========================================
ENVIRONMENT VALIDATION FAILED
========================================

  - Missing required environment variable: ULTAURA_ENCRYPTION_KEY
  - ULTAURA_WEBSOCKET_URL must be a valid WebSocket URL (ws:// or wss://). Got: https://example.com
  - Missing required environment variable: ULTAURA_INTERNAL_API_SECRET
```

### Partial Configuration
- If any required variable is missing, server should NOT start
- This prevents partial functionality that could cause silent failures

---

## Dependencies and Integrations

### External Services Affected
- **Twilio**: Webhook URLs must be updated in Twilio console if `ULTAURA_PUBLIC_URL` value changes
- **Stripe**: No changes needed (price ID variable names unchanged)
- **xAI**: No changes needed (API key variable name unchanged)
- **Supabase**: No changes needed

### Internal Components Affected
- **Telephony Backend**: All route handlers, scheduler, WebSocket bridge
- **Next.js App**: Server actions, API routes
- **Constants/Config**: Pricing, timezone defaults

---

## Assumptions

1. **Breaking change accepted**: No backwards compatibility with old variable names needed
2. **Encryption key value unchanged**: Only the variable name changes; the actual key value stays the same
3. **Single deployment environment**: No need to support multiple env var naming schemes simultaneously
4. **Telephony and Next.js share `.env.local`**: Both services read from the same environment file (or CI/CD provides both)

---

## Rollback Plan

If issues arise after deployment:

1. **Immediate**: Revert variable names in code back to old names
2. **Update `.env` files**: Restore old variable names
3. **Restart services**: Both Next.js and telephony backend

Since this is a breaking change with no backwards compatibility, rollback requires:
- Code revert
- Environment variable revert
- Service restart

---

## Success Criteria

1. All environment variables follow `ULTAURA_` prefix convention for Ultaura-specific vars
2. `.env.ultaura.example`, `CLAUDE.md`, and code are fully aligned
3. Server fails fast on startup if any required variable is missing or malformed
4. All previously documented but unused variables are now functional
5. No legacy/deprecated variable names remain in codebase
6. Existing encrypted memories continue to work (same key value, new variable name)
