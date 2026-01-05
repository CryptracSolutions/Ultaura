# Security Specification: /tools Endpoint Authentication

## Overview

**Issue**: The `/tools` endpoints in the telephony server are effectively unauthenticated, creating a critical security vulnerability.

**Impact**: Catastrophic - enables data tampering, memory deletion, schedule creation, safety SMS spam, and cost abuse.

**Likelihood**: High - the telephony server is public (Twilio must reach it), and scanners will discover `/tools/*` endpoints.

**Symptoms**: Unexpected schedules/reminders, unexplained SMS sends, memory changes, or DB writes not tied to legitimate call sessions.

---

## Current State Analysis

### The Problem

1. **No router-level authentication**: `telephony/src/server.ts` mounts the tools router without middleware:
   ```typescript
   app.use('/tools', toolsRouter);  // Line 121 - NO AUTH!
   ```

2. **Tools router has no auth check**: `telephony/src/routes/tools/index.ts` mounts 16 tool routes without any central authentication.

3. **Grok bridge sends headers correctly**: `telephony/src/websocket/grok-bridge.ts` (line 731) already sends `X-Webhook-Secret` header when calling tools - but tools don't validate it!

4. **Two critical endpoints have no session validation**:
   - `forget-memory.ts` - Only requires `lineId` and `accountId` (no `callSessionId`)
   - `mark-private.ts` - Only requires `lineId` and `accountId` (no `callSessionId`)

### Affected Tool Endpoints (16 total)

| Endpoint | Current Auth | Risk Level |
|----------|-------------|-----------|
| `/tools/set_reminder` | callSessionId only | High |
| `/tools/list_reminders` | callSessionId only | High |
| `/tools/edit_reminder` | callSessionId only | Critical |
| `/tools/pause_reminder` | callSessionId only | Critical |
| `/tools/resume_reminder` | callSessionId only | Critical |
| `/tools/snooze_reminder` | callSessionId only | Critical |
| `/tools/cancel_reminder` | callSessionId only | Critical |
| `/tools/schedule_call` | callSessionId only | Critical |
| `/tools/opt_out` | callSessionId only | Critical |
| `/tools/safety_event` | implicit only | Critical |
| `/tools/store_memory` | callSessionId only | High |
| `/tools/update_memory` | callSessionId only | High |
| `/tools/forget_memory` | **NONE** (lineId/accountId only) | **CRITICAL** |
| `/tools/mark_private` | **NONE** (lineId/accountId only) | **CRITICAL** |
| `/tools/overage_action` | callSessionId only | High |
| `/tools/request_upgrade` | callSessionId only | High |

### Existing Pattern to Follow

The `/calls` router correctly implements authentication in `telephony/src/routes/calls.ts`:

```typescript
function verifyInternalAccess(req: Request, res: Response, next: () => void) {
  const secret = req.headers['x-webhook-secret'];
  let expectedSecret: string;

  try {
    expectedSecret = getInternalApiSecret();
  } catch (error) {
    logger.error({ error }, 'Internal API secret missing');
    res.status(500).json({ error: 'Server misconfigured' });
    return;
  }

  if (secret !== expectedSecret) {
    logger.warn('Invalid internal API secret');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

// Applied to entire router:
callsRouter.use(verifyInternalAccess);
```

---

## Requirements

### Functional Requirements

1. **Add X-Webhook-Secret validation to /tools router**
   - Validate `X-Webhook-Secret` header against `ULTAURA_INTERNAL_API_SECRET` environment variable
   - Apply at router level (single enforcement point)
   - Return 401 for invalid/missing secret
   - Return 500 if server is misconfigured (missing env var)

2. **Use constant-time comparison**
   - Use `crypto.timingSafeEqual()` to prevent timing attacks
   - Convert strings to Buffers for comparison

3. **Fix forget-memory and mark-private endpoints**
   - Add `callSessionId` as required parameter
   - Validate session exists before performing operations

4. **Add rate limiting**
   - Limit: 100 requests per minute per IP address
   - Return 429 Too Many Requests with `Retry-After` header when exceeded
   - Use in-memory storage (consistent with existing codebase)
   - Add TODO comment for Redis upgrade

5. **Create shared middleware file**
   - New file: `telephony/src/middleware/auth.ts`
   - Export reusable middleware functions
   - Both `/calls` and `/tools` routers should use shared middleware

### Non-Functional Requirements

1. **Security**
   - Minimal error responses: `{ error: 'Unauthorized' }` - no details about what failed
   - Log warnings for authentication failures (include IP, path)
   - No grace period - enforce immediately

2. **Logging**
   - Warn level for invalid secret attempts
   - Include request IP and path in log message
   - Do not log the actual secret value (either provided or expected)

3. **Backward Compatibility**
   - None required - Grok bridge already sends the header correctly
   - All legitimate tool calls will continue to work

---

## Implementation Approach

### File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `telephony/src/middleware/auth.ts` | **CREATE** | New shared authentication middleware |
| `telephony/src/routes/tools/index.ts` | MODIFY | Add middleware at router level |
| `telephony/src/routes/tools/forget-memory.ts` | MODIFY | Add callSessionId validation |
| `telephony/src/routes/tools/mark-private.ts` | MODIFY | Add callSessionId validation |
| `telephony/src/routes/calls.ts` | MODIFY | Import shared middleware instead of local function |

### Step 1: Create Shared Middleware File

**File**: `telephony/src/middleware/auth.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getInternalApiSecret } from '../utils/env';
import { logger } from '../utils/logger';

/**
 * Validates X-Webhook-Secret header using constant-time comparison.
 * Returns 401 if invalid, 500 if server misconfigured.
 */
export function requireInternalSecret(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const providedSecret = req.headers['x-webhook-secret'];

  // Get expected secret
  let expectedSecret: string;
  try {
    expectedSecret = getInternalApiSecret();
  } catch (error) {
    logger.error({ error }, 'Internal API secret missing');
    res.status(500).json({ error: 'Server misconfigured' });
    return;
  }

  // Validate secret exists
  if (!providedSecret || typeof providedSecret !== 'string') {
    logger.warn(
      { ip: req.ip, path: req.path },
      'Missing X-Webhook-Secret header'
    );
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Constant-time comparison to prevent timing attacks
  const providedBuffer = Buffer.from(providedSecret, 'utf8');
  const expectedBuffer = Buffer.from(expectedSecret, 'utf8');

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    logger.warn(
      { ip: req.ip, path: req.path },
      'Invalid X-Webhook-Secret header'
    );
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

/**
 * In-memory rate limiter.
 * MVP implementation - replace with Redis for horizontal scaling.
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100; // requests per window
const RATE_WINDOW_MS = 60 * 1000; // 1 minute

// Cleanup stale entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (value.resetAt < now) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Rate limiting middleware.
 * Limits requests per IP to prevent abuse.
 * Returns 429 with Retry-After header when exceeded.
 */
export function rateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // TODO: Replace with Redis for production horizontal scaling
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  let entry = rateLimitMap.get(ip);

  // Reset if window expired
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateLimitMap.set(ip, entry);
  }

  entry.count++;

  if (entry.count > RATE_LIMIT) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    logger.warn(
      { ip, path: req.path, count: entry.count },
      'Rate limit exceeded for /tools endpoint'
    );
    res.setHeader('Retry-After', retryAfter.toString());
    res.status(429).json({ error: 'Unauthorized' });
    return;
  }

  next();
}
```

### Step 2: Update Tools Router

**File**: `telephony/src/routes/tools/index.ts`

Add at the top of the router, before individual tool routes are mounted:

```typescript
import { Router } from 'express';
import { requireInternalSecret, rateLimit } from '../../middleware/auth';

// ... existing imports for tool routes ...

export const toolsRouter = Router();

// Authentication and rate limiting for ALL tool endpoints
toolsRouter.use(rateLimit);
toolsRouter.use(requireInternalSecret);

// ... existing route mounts remain unchanged ...
toolsRouter.use('/set_reminder', setReminderRouter);
// etc.
```

### Step 3: Fix forget-memory.ts

**File**: `telephony/src/routes/tools/forget-memory.ts`

Current (vulnerable):
```typescript
const { lineId, accountId } = req.body;
// Directly performs delete without session validation
```

Fixed:
```typescript
const { callSessionId, lineId, accountId } = req.body;

// Validate required fields
if (!callSessionId || !lineId) {
  res.status(400).json({ error: 'Missing required fields: callSessionId, lineId' });
  return;
}

// Validate session exists
const session = await getCallSession(callSessionId);
if (!session) {
  res.status(404).json({ error: 'Call session not found' });
  return;
}

// Use account_id from session (not from request body for security)
const validatedAccountId = session.account_id;

// Proceed with memory deletion using validated identifiers
```

### Step 4: Fix mark-private.ts

**File**: `telephony/src/routes/tools/mark-private.ts`

Apply the same fix as forget-memory.ts:
- Add `callSessionId` as required parameter
- Validate session exists via `getCallSession()`
- Use `session.account_id` instead of request body `accountId`

### Step 5: Update calls.ts to Use Shared Middleware

**File**: `telephony/src/routes/calls.ts`

Replace the local `verifyInternalAccess` function:

```typescript
// Before:
function verifyInternalAccess(req: Request, res: Response, next: () => void) {
  // ... local implementation ...
}

callsRouter.use(verifyInternalAccess);

// After:
import { requireInternalSecret } from '../middleware/auth';

callsRouter.use(requireInternalSecret);
```

---

## Testing Plan

### Manual Verification Steps

1. **Test authentication enforcement**:
   ```bash
   # Should return 401 (no header)
   curl -X POST http://localhost:3001/tools/list_reminders \
     -H "Content-Type: application/json" \
     -d '{"callSessionId": "test", "lineId": "test"}'

   # Should return 401 (wrong secret)
   curl -X POST http://localhost:3001/tools/list_reminders \
     -H "Content-Type: application/json" \
     -H "X-Webhook-Secret: wrong-secret" \
     -d '{"callSessionId": "test", "lineId": "test"}'

   # Should return 400/404 (correct secret, but invalid session)
   curl -X POST http://localhost:3001/tools/list_reminders \
     -H "Content-Type: application/json" \
     -H "X-Webhook-Secret: YOUR_ACTUAL_SECRET" \
     -d '{"callSessionId": "invalid-uuid", "lineId": "test"}'
   ```

2. **Test rate limiting**:
   ```bash
   # Run 101+ requests in quick succession
   for i in {1..105}; do
     curl -s -o /dev/null -w "%{http_code}\n" \
       -X POST http://localhost:3001/tools/list_reminders \
       -H "Content-Type: application/json" \
       -d '{"callSessionId": "test"}'
   done
   # First 100 should return 401, remaining should return 429
   ```

3. **Test forget-memory now requires callSessionId**:
   ```bash
   # Should return 400 (missing callSessionId)
   curl -X POST http://localhost:3001/tools/forget_memory \
     -H "Content-Type: application/json" \
     -H "X-Webhook-Secret: YOUR_ACTUAL_SECRET" \
     -d '{"lineId": "test", "accountId": "test"}'
   ```

4. **Verify existing calls still work**:
   - Initiate a real test call via the dashboard
   - Verify Grok tools are invoked successfully during the call
   - Check telephony logs for any auth failures

### Verification Checklist

- [ ] All 16 tool endpoints return 401 without X-Webhook-Secret header
- [ ] All 16 tool endpoints return 401 with incorrect X-Webhook-Secret header
- [ ] All 16 tool endpoints work correctly with valid X-Webhook-Secret header
- [ ] Rate limiter returns 429 after 100 requests/minute from same IP
- [ ] Rate limiter includes Retry-After header in 429 response
- [ ] forget-memory returns 400 without callSessionId
- [ ] mark-private returns 400 without callSessionId
- [ ] Real calls via Grok bridge continue to work (end-to-end test)
- [ ] /calls/outbound still works with shared middleware
- [ ] Logs show warnings for authentication failures

---

## Edge Cases and Error Handling

### Edge Cases

1. **Array header value**: Express can receive array headers. Middleware should handle `typeof providedSecret !== 'string'`.

2. **Empty string secret**: Should be rejected (falsy check handles this).

3. **Unicode in secret**: Buffer comparison handles UTF-8 correctly.

4. **Missing environment variable**: Returns 500 (server misconfigured) not 401.

5. **Rate limit map memory growth**: Cleanup interval prevents unbounded growth.

6. **IP address behind proxy**: Uses `req.ip` which respects `trust proxy` setting.

### Error Responses

| Scenario | Status | Response |
|----------|--------|----------|
| Missing X-Webhook-Secret header | 401 | `{ error: 'Unauthorized' }` |
| Invalid X-Webhook-Secret header | 401 | `{ error: 'Unauthorized' }` |
| Rate limit exceeded | 429 | `{ error: 'Unauthorized' }` + `Retry-After` header |
| Missing ULTAURA_INTERNAL_API_SECRET env | 500 | `{ error: 'Server misconfigured' }` |
| Missing callSessionId (forget-memory, mark-private) | 400 | `{ error: 'Missing required fields: callSessionId, lineId' }` |
| Invalid callSessionId | 404 | `{ error: 'Call session not found' }` |

---

## Dependencies

### Existing (no new dependencies)

- `express` - Already used for routing
- `crypto` - Node.js built-in module (for `timingSafeEqual`)
- `../utils/env` - Existing utility for `getInternalApiSecret()`
- `../utils/logger` - Existing pino logger
- `../services/call-session` - Existing for `getCallSession()`

### Environment Variables

- `ULTAURA_INTERNAL_API_SECRET` - Already required, minimum 32 characters

---

## Security Considerations

1. **Timing Attack Prevention**: Using `crypto.timingSafeEqual()` prevents attackers from inferring secret characters based on comparison timing.

2. **Minimal Information Disclosure**: All auth failures return identical `{ error: 'Unauthorized' }` response.

3. **Rate Limiting**: Prevents brute force attacks and abuse even if an attacker somehow obtains the secret.

4. **Session Validation**: Fixing forget-memory and mark-private ensures these sensitive operations can only occur during legitimate calls.

5. **Logging**: Warnings capture IP and path for security monitoring without exposing secrets.

---

## Assumptions

1. The Grok bridge (`grok-bridge.ts`) correctly sends the `X-Webhook-Secret` header on all tool calls (verified in investigation).

2. The `ULTAURA_INTERNAL_API_SECRET` environment variable is properly configured in all deployment environments.

3. Single-server deployment (in-memory rate limiting is acceptable).

4. Express `trust proxy` is configured correctly if behind a reverse proxy.

---

## Out of Scope

The following items are explicitly NOT part of this implementation:

1. Redis-based rate limiting (future enhancement)
2. Active session status validation (`status === 'in_progress'`)
3. Session age validation
4. Per-callSessionId rate limiting
5. Request signing/HMAC
6. JWT or OAuth authentication
7. Unit tests (manual verification only)

---

## Rollback Plan

If issues are discovered after deployment:

1. **Quick rollback**: Remove the middleware lines from `tools/index.ts`:
   ```typescript
   // Comment out these lines:
   // toolsRouter.use(rateLimit);
   // toolsRouter.use(requireInternalSecret);
   ```

2. **Redeploy** the previous version of the telephony server.

3. **Monitor** logs for the root cause.

Note: This will re-expose the vulnerability, so use only as a temporary measure while fixing the underlying issue.

---

## Implementation Sequence

1. Create `telephony/src/middleware/auth.ts` with both middleware functions
2. Update `telephony/src/routes/tools/index.ts` to use the middleware
3. Update `telephony/src/routes/tools/forget-memory.ts` to require callSessionId
4. Update `telephony/src/routes/tools/mark-private.ts` to require callSessionId
5. Update `telephony/src/routes/calls.ts` to use shared middleware
6. Test manually per the testing plan
7. Deploy to staging and verify with real calls
8. Deploy to production
