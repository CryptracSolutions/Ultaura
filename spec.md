# Specification: Rate Limiting & Abuse Prevention for Verification and Tool Endpoints

## Overview

This specification addresses cost-abuse vulnerabilities in the Ultaura telephony backend, specifically targeting verification endpoints and tool endpoints that incur external costs (Twilio Verify SMS, notification SMS).

### Problem Statement

**Impact**: Medium/High (Twilio Verify costs, SMS costs, abuse potential)
**Likelihood**: Medium/High
**Symptoms**: Spikes in verify sends, SMS, reminder creations

**Current Vulnerabilities Identified**:
1. `/verify/send` and `/verify/check` endpoints are **completely unauthenticated** (no `requireInternalSecret` middleware)
2. In-memory rate limiting only on `/verify/send` (not distributed, lost on restart)
3. No rate limiting on `/verify/check` (brute force vulnerability)
4. No IP-based rate limiting
5. No account-level throttling
6. Tool endpoints that send SMS have no rate limiting
7. `set_reminder` tool allows unbounded reminder creation
8. No anomaly detection or alerting
9. Memory leak in current rate limiter (expired entries never cleaned)

---

## Objectives

1. **Secure verification endpoints** with internal API secret authentication
2. **Implement distributed rate limiting** using Redis (Upstash) across multiple dimensions:
   - Per phone number
   - Per IP address
   - Per account
3. **Add rate limiting to tool endpoints** that incur costs
4. **Implement anomaly detection** with email alerts
5. **Create audit logging** for all rate limit events
6. **Add emergency kill switch** for verification endpoints
7. **Ensure graceful degradation** if Redis is unavailable

---

## Technical Requirements

### 1. Authentication for Verification Endpoints

**Requirement**: Apply `requireInternalSecret` middleware to all `/verify/*` routes.

**Location**: `telephony/src/routes/verify.ts`

**Implementation**:
```typescript
// Add at top of router (similar to calls.ts line 13)
verifyRouter.use(requireInternalSecret);
```

**Rationale**: Currently, anyone with network access can call these endpoints. By requiring the internal secret, only the Next.js app server can initiate verification requests.

---

### 2. Redis Infrastructure (Upstash)

**Provider**: Upstash (serverless Redis)

**New Dependencies** (add to `telephony/package.json`):
```json
{
  "@upstash/redis": "^1.28.0",
  "@upstash/ratelimit": "^1.0.0"
}
```

**Environment Variables** (add to `.env.local` and `.env.ultaura.example`):
```bash
# Upstash Redis Configuration
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

**Redis Client Setup** (new file: `telephony/src/services/redis.ts`):
```typescript
import { Redis } from '@upstash/redis';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  return redisClient;
}

export function isRedisAvailable(): boolean {
  return redisClient !== null;
}
```

---

### 3. Rate Limiting Configuration

#### 3.1 Verification Endpoints

| Dimension | Limit | Window | Applies To |
|-----------|-------|--------|------------|
| Phone Number | 5 sends | 1 hour | `/verify/send` |
| Phone Number | 10 checks | 1 hour | `/verify/check` |
| IP Address | 20 requests | 1 hour | Both endpoints |
| Account | 10 requests | 1 hour | Both endpoints |

**Key Format in Redis**:
```
ratelimit:verify:phone:{e164_number}:send
ratelimit:verify:phone:{e164_number}:check
ratelimit:verify:ip:{ip_address}
ratelimit:verify:account:{account_id}
```

#### 3.2 Tool Endpoints

| Tool | Limit | Window | Dimension |
|------|-------|--------|-----------|
| `safety_event` (SMS) | 15 SMS | 24 hours | Per account |
| `request_upgrade` (SMS) | 15 SMS | 24 hours | Per account (shared with safety_event) |
| `set_reminder` | 5 reminders | Per call session | Per call session |

**Key Format in Redis**:
```
ratelimit:sms:account:{account_id}
ratelimit:reminders:session:{call_session_id}
```

---

### 4. Rate Limiter Service

**New File**: `telephony/src/services/rate-limiter.ts`

**Interface**:
```typescript
interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;  // Unix timestamp
  retryAfter: number;  // Seconds until reset
  limitType: 'phone' | 'ip' | 'account' | 'session';
}

interface RateLimitCheck {
  phoneNumber?: string;
  ipAddress?: string;
  accountId?: string;
  callSessionId?: string;
  action: 'verify_send' | 'verify_check' | 'sms' | 'set_reminder';
}

async function checkRateLimit(check: RateLimitCheck): Promise<RateLimitResult>;
async function incrementCounter(check: RateLimitCheck): Promise<void>;
```

**Graceful Degradation**:
- If Redis is unavailable, allow the request but log the event
- Log format: `{ event: 'rate_limit_bypass', reason: 'redis_unavailable', ...check }`

**Localhost Bypass**:
- Skip rate limiting for requests from `127.0.0.1` or `::1`
- Only in non-production (`NODE_ENV !== 'production'`)

---

### 5. Rate Limiter Middleware

**New File**: `telephony/src/middleware/rate-limiter.ts`

**For Verification Routes**:
```typescript
export function verifyRateLimiter(action: 'send' | 'check') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const phoneNumber = req.body.phoneNumber;
    const accountId = req.body.accountId; // Must be added to verify request body

    // Check kill switch first
    if (await isVerificationDisabled()) {
      return res.status(503).json({
        error: 'Verification temporarily disabled',
        code: 'VERIFICATION_DISABLED'
      });
    }

    const result = await checkRateLimit({
      phoneNumber,
      ipAddress: ip,
      accountId,
      action: action === 'send' ? 'verify_send' : 'verify_check'
    });

    if (!result.allowed) {
      await logRateLimitEvent({...}); // Audit logging
      await checkAnomalyThresholds({...}); // Anomaly detection

      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: result.retryAfter,
        limitType: result.limitType
      }).set('Retry-After', String(result.retryAfter));
    }

    next();
  };
}
```

**For Tool Routes**:
```typescript
export function toolRateLimiter(toolName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { callSessionId, accountId } = req.body;

    if (toolName === 'set_reminder') {
      const result = await checkRateLimit({
        callSessionId,
        action: 'set_reminder'
      });
      // ... handle result
    }

    if (toolName === 'safety_event' || toolName === 'request_upgrade') {
      const result = await checkRateLimit({
        accountId,
        action: 'sms'
      });
      // ... handle result
    }

    next();
  };
}
```

---

### 6. Emergency Kill Switch

**Database Table**: Add column to `ultaura_system_settings` (new table if doesn't exist)

**Migration**: `supabase/migrations/YYYYMMDD_add_system_settings.sql`
```sql
CREATE TABLE IF NOT EXISTS ultaura_system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

INSERT INTO ultaura_system_settings (key, value)
VALUES ('verification_disabled', '{"enabled": false, "reason": null, "disabled_at": null}');
```

**Check Function** (in rate-limiter.ts):
```typescript
async function isVerificationDisabled(): Promise<boolean> {
  const { data } = await supabase
    .from('ultaura_system_settings')
    .select('value')
    .eq('key', 'verification_disabled')
    .single();

  return data?.value?.enabled === true;
}
```

---

### 7. Anomaly Detection & Alerts

**Alert Triggers**:
1. **Repeated hits**: 3+ rate limit violations in 5 minutes from same source (IP or phone)
2. **Cost threshold**: Daily Twilio Verify spend estimate exceeds $10 (calculated as: send_count × $0.05)
3. **IP blocked**: Any single IP hits its rate limit
4. **Enumeration attack**: 10+ unique phone numbers attempted from same IP in 1 hour

**Tracking in Redis**:
```
anomaly:hits:{ip_or_phone}:{5min_bucket}  -- increment on each violation
anomaly:daily_spend:{date}  -- increment by 0.05 on each send
anomaly:ip_phones:{ip}:{hour_bucket}  -- SADD phone numbers
```

**Alert Service** (new file: `telephony/src/services/anomaly-alerts.ts`):
```typescript
interface AnomalyEvent {
  type: 'repeated_hits' | 'cost_threshold' | 'ip_blocked' | 'enumeration';
  source: string;  // IP or phone
  details: Record<string, unknown>;
  timestamp: Date;
}

async function checkAnomalyThresholds(event: RateLimitEvent): Promise<void>;
async function sendAnomalyAlert(anomaly: AnomalyEvent): Promise<void>;
```

**Email Configuration**:
- Use existing billing email from account's Stripe customer
- Email sent via existing nodemailer configuration
- Subject: `[Ultaura Security Alert] ${anomaly.type}`
- Include: timestamp, source, details, recommended actions

---

### 8. Audit Logging

**New Database Table**: `ultaura_rate_limit_events`

**Migration**: `supabase/migrations/YYYYMMDD_add_rate_limit_events.sql`
```sql
CREATE TABLE ultaura_rate_limit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  event_type TEXT NOT NULL,  -- 'allowed', 'blocked', 'anomaly'
  action TEXT NOT NULL,  -- 'verify_send', 'verify_check', 'sms', 'set_reminder'
  ip_address TEXT,
  phone_number TEXT,  -- E.164 format, for audit only
  account_id UUID,
  call_session_id UUID,
  limit_type TEXT,  -- 'phone', 'ip', 'account', 'session'
  remaining INTEGER,
  was_allowed BOOLEAN NOT NULL,
  redis_available BOOLEAN DEFAULT TRUE,
  metadata JSONB
);

-- Index for querying recent events
CREATE INDEX idx_rate_limit_events_created ON ultaura_rate_limit_events(created_at DESC);
CREATE INDEX idx_rate_limit_events_ip ON ultaura_rate_limit_events(ip_address, created_at DESC);
CREATE INDEX idx_rate_limit_events_account ON ultaura_rate_limit_events(account_id, created_at DESC);

-- Auto-cleanup after 30 days
CREATE OR REPLACE FUNCTION cleanup_old_rate_limit_events()
RETURNS void AS $$
BEGIN
  DELETE FROM ultaura_rate_limit_events
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
```

**Logging Function**:
```typescript
async function logRateLimitEvent(event: {
  eventType: 'allowed' | 'blocked' | 'anomaly';
  action: string;
  ipAddress?: string;
  phoneNumber?: string;
  accountId?: string;
  callSessionId?: string;
  limitType?: string;
  remaining?: number;
  wasAllowed: boolean;
  redisAvailable: boolean;
  metadata?: Record<string, unknown>;
}): Promise<void>;
```

---

### 9. Verification Endpoint Updates

**File**: `telephony/src/routes/verify.ts`

**Changes Required**:

1. Add `requireInternalSecret` middleware at router level
2. Add `accountId` to request body validation (for account-level throttling)
3. Apply `verifyRateLimiter('send')` to `/verify/send`
4. Apply `verifyRateLimiter('check')` to `/verify/check`
5. Remove old in-memory `verificationAttempts` Map and related code
6. Add kill switch check before processing

**Updated Request Body for `/verify/send`**:
```typescript
interface VerifySendRequest {
  lineId: string;
  phoneNumber: string;  // E.164 format
  channel: 'sms' | 'call';
  accountId: string;  // NEW: Required for account-level throttling
}
```

**Updated Request Body for `/verify/check`**:
```typescript
interface VerifyCheckRequest {
  phoneNumber: string;
  code: string;
  accountId: string;  // NEW: Required for account-level throttling
}
```

---

### 10. Tool Endpoint Updates

#### 10.1 `set_reminder` Rate Limiting

**File**: `telephony/src/routes/tools/set-reminder.ts`

**Changes**:
- Add check for reminder count per session before creating
- Query existing reminders created in current session
- Return error if limit (5) exceeded

```typescript
// At start of handler, after validation
const { count } = await supabase
  .from('ultaura_reminders')
  .select('id', { count: 'exact', head: true })
  .eq('created_in_session', callSessionId);

if (count >= 5) {
  return res.status(429).json({
    error: 'Maximum reminders per call reached',
    limit: 5,
    suggestion: 'You can set more reminders in your next call'
  });
}
```

**Database Change**: Add `created_in_session` column to `ultaura_reminders` table.

#### 10.2 SMS-Sending Tools Rate Limiting

**Files**:
- `telephony/src/routes/tools/safety-event.ts`
- `telephony/src/routes/tools/request-upgrade.ts`

**Changes**:
- Add rate limit check before sending SMS
- Share counter between both tools (both count toward 15/day limit)
- If limit exceeded, log event and skip SMS (but don't fail the tool call entirely for safety events)

```typescript
// For safety_event: still log the event, just skip SMS
if (smsLimitExceeded) {
  logger.warn({ accountId, limit: 15 }, 'SMS rate limit exceeded, skipping notification');
  // Continue with safety event logging, just don't send SMS
}

// For request_upgrade: return error since SMS is the main purpose
if (smsLimitExceeded) {
  return res.status(429).json({
    error: 'Daily notification limit reached',
    retryAfter: secondsUntilMidnight
  });
}
```

---

### 11. Frontend Changes

**File**: `src/lib/ultaura/actions.ts`

**Update `startPhoneVerification`**:
- Include `accountId` in request body

```typescript
// In startPhoneVerification function
const response = await fetch(`${telephonyUrl}/verify/send`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-Secret': getInternalApiSecret(),
  },
  body: JSON.stringify({
    lineId,
    phoneNumber: line.phone_e164,
    channel,
    accountId: account.id,  // NEW: Add account ID
  }),
});
```

**Update `checkPhoneVerification`**:
- Include `accountId` in request body

---

## File Structure

New and modified files:

```
telephony/
├── src/
│   ├── services/
│   │   ├── redis.ts                    # NEW: Redis client setup
│   │   ├── rate-limiter.ts             # NEW: Rate limiting logic
│   │   └── anomaly-alerts.ts           # NEW: Anomaly detection & alerts
│   ├── middleware/
│   │   ├── auth.ts                     # EXISTING (no changes)
│   │   └── rate-limiter.ts             # NEW: Rate limiter middleware
│   └── routes/
│       ├── verify.ts                   # MODIFY: Add auth + rate limiting
│       └── tools/
│           ├── set-reminder.ts         # MODIFY: Add session limit
│           ├── safety-event.ts         # MODIFY: Add SMS rate limiting
│           └── request-upgrade.ts      # MODIFY: Add SMS rate limiting
├── package.json                        # MODIFY: Add @upstash/redis

supabase/migrations/
├── YYYYMMDD_add_system_settings.sql    # NEW: Kill switch table
├── YYYYMMDD_add_rate_limit_events.sql  # NEW: Audit logging table
└── YYYYMMDD_add_reminder_session.sql   # NEW: created_in_session column

src/lib/ultaura/
└── actions.ts                          # MODIFY: Add accountId to verify calls

.env.ultaura.example                    # MODIFY: Add Redis config vars
```

---

## Implementation Sequence

### Phase 1: Infrastructure Setup
1. Set up Upstash Redis account and get credentials
2. Add environment variables to `.env.local`
3. Create Redis client service (`telephony/src/services/redis.ts`)
4. Add `@upstash/redis` and `@upstash/ratelimit` dependencies

### Phase 2: Database Migrations
1. Create `ultaura_system_settings` table (kill switch)
2. Create `ultaura_rate_limit_events` table (audit logging)
3. Add `created_in_session` column to `ultaura_reminders`
4. Run migrations: `npx supabase migration up`

### Phase 3: Rate Limiting Core
1. Implement rate limiter service (`telephony/src/services/rate-limiter.ts`)
2. Implement rate limiter middleware (`telephony/src/middleware/rate-limiter.ts`)
3. Add localhost bypass logic
4. Add graceful degradation for Redis failures

### Phase 4: Verification Endpoints
1. Add `requireInternalSecret` to verify router
2. Update request body interfaces to include `accountId`
3. Apply rate limiter middleware to both endpoints
4. Remove old in-memory rate limiting code
5. Add kill switch check
6. Update frontend actions to include `accountId`

### Phase 5: Tool Endpoints
1. Add session-based limiting to `set_reminder`
2. Add SMS rate limiting to `safety_event`
3. Add SMS rate limiting to `request_upgrade`

### Phase 6: Anomaly Detection & Alerts
1. Implement anomaly detection service
2. Configure email alerts
3. Add anomaly checks to rate limiter

### Phase 7: Testing & Validation
1. Test rate limiting with various scenarios
2. Test Redis failure graceful degradation
3. Test kill switch functionality
4. Test anomaly alerts
5. Verify audit logging

---

## Testing Considerations

### Unit Tests
- Rate limiter service functions
- Anomaly threshold calculations
- Key generation for Redis

### Integration Tests
- Rate limiting across multiple requests
- Redis connection handling
- Kill switch behavior
- Audit log insertion

### Manual Testing Checklist
- [ ] Verify `/verify/send` requires secret header
- [ ] Verify `/verify/check` requires secret header
- [ ] Confirm rate limit after 5 sends to same phone
- [ ] Confirm rate limit after 10 checks to same phone
- [ ] Confirm rate limit after 20 requests from same IP
- [ ] Confirm rate limit after 10 requests from same account
- [ ] Test 5-reminder limit per call session
- [ ] Test 15-SMS limit per account per day
- [ ] Verify Redis fallback behavior (stop Redis, make request)
- [ ] Verify kill switch stops all verification
- [ ] Verify email alert is sent on anomaly detection
- [ ] Check audit logs are created correctly
- [ ] Verify localhost bypass works in development

### Load Testing
- Simulate 100 concurrent verification requests
- Verify Redis handles load appropriately
- Check for race conditions in counter increments

---

## Rollback Plan

If issues arise after deployment:

1. **Immediate**: Set kill switch in database to disable verification
2. **Remove rate limiting**: Comment out middleware, redeploy
3. **Fall back to in-memory**: Restore old in-memory logic temporarily
4. **Redis issues**: System automatically degrades to allow-with-logging mode

---

## Monitoring & Alerting Post-Deployment

### Metrics to Track
- Rate limit hit rate (blocked / total requests)
- Redis latency
- Anomaly alert frequency
- Verification success rate

### Dashboard Queries
```sql
-- Rate limit events in last 24 hours
SELECT event_type, action, COUNT(*)
FROM ultaura_rate_limit_events
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type, action;

-- Top blocked IPs
SELECT ip_address, COUNT(*) as blocks
FROM ultaura_rate_limit_events
WHERE was_allowed = false AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY ip_address
ORDER BY blocks DESC
LIMIT 10;
```

---

## Security Considerations

1. **Secret in headers**: Already using `X-Webhook-Secret` with timing-safe comparison
2. **Phone number logging**: E.164 format logged for audit, no PII exposure
3. **Redis security**: Upstash REST API uses token authentication, encrypted in transit
4. **Kill switch access**: Only accessible via database (requires DB credentials)
5. **Alert emails**: Sent to billing email, not exposed externally

---

## Cost Estimates

### Upstash Redis
- Free tier: 10,000 requests/day
- Pay-as-you-go: $0.2 per 100,000 requests
- Expected usage: ~1,000-5,000 requests/day initially
- **Estimated cost**: Free tier sufficient, or ~$1-5/month at scale

### Reduced Abuse Costs
- Current exposure: Unlimited verification sends
- With rate limiting: Max 5 per phone/hour, 10 per account/hour
- **Estimated savings**: Prevention of potential abuse costing $100s-$1000s

---

## Environment Variables Summary

**New variables to add**:
```bash
# Upstash Redis (required for rate limiting)
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here

# Optional: Override defaults
RATE_LIMIT_VERIFY_SEND_PER_PHONE=5
RATE_LIMIT_VERIFY_CHECK_PER_PHONE=10
RATE_LIMIT_PER_IP=20
RATE_LIMIT_PER_ACCOUNT=10
RATE_LIMIT_SMS_PER_ACCOUNT=15
RATE_LIMIT_REMINDERS_PER_SESSION=5
ANOMALY_COST_THRESHOLD=10.00
ANOMALY_REPEATED_HITS_THRESHOLD=3
ANOMALY_ENUMERATION_THRESHOLD=10
```

---

## Assumptions

1. Upstash free tier will be sufficient for initial traffic
2. Billing email exists for all accounts (used for alerts)
3. All verification requests now route through Next.js app (not direct)
4. Call session IDs are consistently available in tool requests
5. Nodemailer is already configured for email sending
6. Account ID is available in the verification flow context

---

## Open Questions (Resolved)

| Question | Decision |
|----------|----------|
| Redis provider | Upstash (serverless) |
| Require auth on verify endpoints | Yes |
| Rate limits for verification | 5 send / 10 check per phone/hour |
| IP rate limiting | Yes, 20/hour |
| Account-level limits | Yes, 10/hour |
| SMS tool limits | 15/account/day (shared) |
| Reminder limits | 5/call session |
| Alert mechanism | Email to billing address |
| Redis fallback | Allow with logging |
| Kill switch | Database toggle |
| Cost tracking | Estimate (send count × $0.05) |
| Audit logging | Full logging to database |
| Dev bypass | Localhost bypass |

---

## Appendix: Current Code References

### Files to Modify

1. **`telephony/src/routes/verify.ts`** (lines 1-100)
   - Add `requireInternalSecret` at line 8
   - Replace in-memory Map (lines 11-14) with Redis calls
   - Update request validation to require `accountId`

2. **`telephony/src/routes/tools/set-reminder.ts`** (lines 1-200)
   - Add session reminder count check after line 50

3. **`telephony/src/routes/tools/safety-event.ts`** (lines 60-80)
   - Add SMS rate limit check before `sendSms()` call at line 70

4. **`telephony/src/routes/tools/request-upgrade.ts`** (lines 130-145)
   - Add SMS rate limit check before POST to upgrade endpoint

5. **`src/lib/ultaura/actions.ts`** (lines 516-540)
   - Add `accountId` to verify send request body
   - Add `accountId` to verify check request body

### Existing Auth Middleware Location
- `telephony/src/middleware/auth.ts` (lines 6-44)
- Uses `crypto.timingSafeEqual` for timing-safe comparison
- Header: `X-Webhook-Secret`
