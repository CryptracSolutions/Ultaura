# WebSocket Security Specification for `/twilio/media` Endpoint

## 1. Objective and Scope

### 1.1 Objective

Secure the `/twilio/media` WebSocket endpoint against unauthorized access, preventing:
- Audio injection into active calls
- Eavesdropping on conversations
- Cost abuse through unauthorized usage
- Session hijacking via ID guessing

### 1.2 In Scope

- Stream token authentication (HMAC-based)
- IP allowlisting for Twilio Media Streams
- Per-call connection cap (single connection per session)
- Audit mode for gradual rollout
- Security event logging and alerting
- Both inbound and outbound call flows

### 1.3 Out of Scope

- Changes to HTTP webhook authentication (already uses Twilio signature validation)
- Modifications to Grok bridge or xAI integration
- Database schema changes
- Client-side changes (Twilio manages the WebSocket client)
- mTLS or client certificate authentication

---

## 2. Threat Model

### 2.1 Threats Addressed

| Threat | Risk Level | Mitigation |
|--------|------------|------------|
| Session ID enumeration/guessing | High | HMAC token with expiry |
| Replay attacks | Medium | 5-minute token expiry |
| Non-Twilio connections | High | IP allowlisting |
| Multiple connections hijacking | Medium | Per-call connection cap |
| Key compromise | Medium | Dual-key rotation support |

### 2.2 Attack Vectors

1. **Brute-force session ID guessing**: Attacker attempts random UUIDs
2. **Session ID leakage**: Attacker obtains valid session ID from logs/network
3. **Man-in-the-middle**: Attacker intercepts and replays connection
4. **Parallel connection hijacking**: Attacker connects while legitimate call in progress
5. **Non-Twilio source**: Attacker connects from unauthorized IP

### 2.3 Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                        UNTRUSTED ZONE                           │
│   ┌─────────────┐                      ┌─────────────────────┐ │
│   │  Attacker   │                      │  Unknown IP Source  │ │
│   └─────────────┘                      └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                    WebSocket Connection
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     VALIDATION LAYER                            │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐│
│   │ Token Auth  │  │ IP Check    │  │ Connection Cap Check    ││
│   └─────────────┘  └─────────────┘  └─────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       TRUSTED ZONE                              │
│   ┌─────────────────────┐      ┌────────────────────────────┐  │
│   │  Twilio Media       │      │  Grok Bridge / Call Logic  │  │
│   └─────────────────────┘      └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Technical Requirements

### 3.1 Stream Token Authentication

| Requirement | Description |
|-------------|-------------|
| Algorithm | HMAC-SHA256 |
| Payload | `callSessionId` + expiry timestamp (Unix seconds) |
| Lifetime | 5 minutes from generation |
| Delivery | Query parameter (`token`) |
| Key rotation | Support current + previous secret validation |

### 3.2 IP Allowlisting

| Requirement | Description |
|-------------|-------------|
| Default behavior | Block connections from non-Twilio IPs |
| Twilio ranges | Hardcoded in source, overridable via env var |
| Development bypass | Allow all IPs when `TWILIO_MEDIA_IP_ALLOW_UNKNOWN=true` |
| Validation | Check against CIDR ranges |

### 3.3 Per-Call Connection Cap

| Requirement | Description |
|-------------|-------------|
| Maximum connections | 1 per callSessionId |
| Conflict resolution | First connection wins |
| Tracking | In-memory Map (extend grok-bridge-registry pattern) |
| Cleanup | Remove on connection close |

### 3.4 Rollout Mode

| Requirement | Description |
|-------------|-------------|
| Modes | `audit` (log only) or `enforce` (reject) |
| Default | `audit` |
| Configuration | `ULTAURA_WS_SECURITY_MODE` env var |
| Mixed signals | Follow mode (e.g., bad token + good IP = mode determines action) |

---

## 4. Architecture

### 4.1 Component Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         TwiML Generation                             │
│  ┌─────────────────────┐              ┌─────────────────────┐        │
│  │ twilio-inbound.ts   │              │ twilio-outbound.ts  │        │
│  │ generateStreamTwiML │              │ generateStreamTwiML │        │
│  └──────────┬──────────┘              └──────────┬──────────┘        │
│             │                                    │                   │
│             └────────────────┬───────────────────┘                   │
│                              ▼                                       │
│                    ┌─────────────────┐                               │
│                    │ stream-token.ts │  (NEW)                        │
│                    │ generateToken() │                               │
│                    └─────────────────┘                               │
└──────────────────────────────────────────────────────────────────────┘
                               │
                    WebSocket URL with token
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      WebSocket Security Layer                        │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                         server.ts                              │  │
│  │                    wss.on('connection')                        │  │
│  │                              │                                 │  │
│  │    ┌─────────────────────────┼─────────────────────────┐       │  │
│  │    ▼                         ▼                         ▼       │  │
│  │ ┌──────────┐         ┌──────────────┐         ┌─────────────┐ │  │
│  │ │validateIP│         │validateToken │         │checkConnCap │ │  │
│  │ └──────────┘         └──────────────┘         └─────────────┘ │  │
│  │    │                         │                         │       │  │
│  │    └─────────────────────────┴─────────────────────────┘       │  │
│  │                              │                                 │  │
│  │                              ▼                                 │  │
│  │                    ┌─────────────────┐                         │  │
│  │                    │ ws-security.ts  │ (NEW)                   │  │
│  │                    │ validateWsConn  │                         │  │
│  │                    └─────────────────┘                         │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│                    handleMediaStreamConnection()                     │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.2 Validation Flow

```
Connection Request
       │
       ▼
┌──────────────────┐
│ Extract IP from  │
│ req.socket       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌─────────────────┐
│ Check IP against │────▶│ Log IP result   │
│ allowlist        │     │ (pass/fail/dev) │
└────────┬─────────┘     └─────────────────┘
         │
         ▼
┌──────────────────┐     ┌─────────────────┐
│ Extract & verify │────▶│ Log token result│
│ HMAC token       │     │ (valid/expired/ │
└────────┬─────────┘     │  invalid/missing│
         │               └─────────────────┘
         ▼
┌──────────────────┐     ┌─────────────────┐
│ Check connection │────▶│ Log cap result  │
│ cap for session  │     │ (first/dup)     │
└────────┬─────────┘     └─────────────────┘
         │
         ▼
┌──────────────────┐
│ Security Mode?   │
├──────────────────┤
│ AUDIT: Log+Allow │
│ ENFORCE: Reject  │
└────────┬─────────┘
         │
         ▼
   Continue/Reject
```

---

## 5. Implementation Details

### 5.1 New Files to Create

#### `telephony/src/services/stream-token.ts`

```typescript
import crypto from 'crypto';
import { logger } from '../server.js';

interface TokenPayload {
  callSessionId: string;
  exp: number; // Unix timestamp (seconds)
}

interface TokenValidationResult {
  valid: boolean;
  reason: 'valid' | 'expired' | 'invalid_signature' | 'malformed' | 'missing';
  callSessionId?: string;
}

const TOKEN_LIFETIME_SECONDS = 300; // 5 minutes

function getSecrets(): { current: string; previous: string | null } {
  const current = process.env.ULTAURA_STREAM_TOKEN_SECRET;
  const previous = process.env.ULTAURA_STREAM_TOKEN_SECRET_PREVIOUS || null;

  if (!current) {
    throw new Error('ULTAURA_STREAM_TOKEN_SECRET is required');
  }

  return { current, previous };
}

function createHmac(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');
}

export function generateStreamToken(callSessionId: string): string {
  const { current } = getSecrets();
  const exp = Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS;
  const payload = `${callSessionId}.${exp}`;
  const signature = createHmac(payload, current);
  return `${payload}.${signature}`;
}

export function validateStreamToken(
  token: string | null,
  expectedCallSessionId: string
): TokenValidationResult {
  if (!token) {
    return { valid: false, reason: 'missing' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, reason: 'malformed' };
  }

  const [callSessionId, expStr, signature] = parts;
  const exp = parseInt(expStr, 10);

  if (isNaN(exp)) {
    return { valid: false, reason: 'malformed' };
  }

  if (callSessionId !== expectedCallSessionId) {
    return { valid: false, reason: 'invalid_signature' };
  }

  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (now > exp) {
    return { valid: false, reason: 'expired', callSessionId };
  }

  // Verify signature with current key
  const { current, previous } = getSecrets();
  const payload = `${callSessionId}.${expStr}`;
  const expectedSig = createHmac(payload, current);

  if (crypto.timingSafeEqual(
    Buffer.from(signature, 'base64url'),
    Buffer.from(expectedSig, 'base64url')
  )) {
    return { valid: true, reason: 'valid', callSessionId };
  }

  // Try previous key for rotation support
  if (previous) {
    const previousSig = createHmac(payload, previous);
    if (crypto.timingSafeEqual(
      Buffer.from(signature, 'base64url'),
      Buffer.from(previousSig, 'base64url')
    )) {
      logger.info({ callSessionId }, 'Token validated with previous secret');
      return { valid: true, reason: 'valid', callSessionId };
    }
  }

  return { valid: false, reason: 'invalid_signature', callSessionId };
}
```

#### `telephony/src/services/ws-security.ts`

```typescript
import { IncomingMessage } from 'http';
import { WebSocket } from 'ws';
import { logger } from '../server.js';
import { validateStreamToken } from './stream-token.js';
import { sendSecurityAlert } from './ws-security-alerts.js';

// Twilio Media Streams IP ranges (as of 2024)
// Source: https://www.twilio.com/docs/sip-trunking/ip-addresses
const DEFAULT_TWILIO_IP_RANGES = [
  // Global Media IP Gateway
  '168.86.128.0/18',
  // Legacy Media Streams ranges (may still be active)
  '34.203.254.0/24',
  '3.235.111.128/25',
];

interface IpCheckResult {
  allowed: boolean;
  reason: 'twilio' | 'override' | 'development' | 'unknown';
  ip: string;
}

interface SecurityValidationResult {
  allowed: boolean;
  ipCheck: IpCheckResult;
  tokenCheck: {
    valid: boolean;
    reason: string;
  };
  connectionCapCheck: {
    allowed: boolean;
    reason: 'first' | 'duplicate';
  };
  mode: 'audit' | 'enforce';
}

// In-memory connection tracking
const activeConnections = new Map<string, WebSocket>();

function getSecurityMode(): 'audit' | 'enforce' {
  const mode = process.env.ULTAURA_WS_SECURITY_MODE?.toLowerCase();
  return mode === 'enforce' ? 'enforce' : 'audit';
}

function parseCIDR(cidr: string): { network: bigint; mask: bigint } | null {
  const [ip, prefixStr] = cidr.split('/');
  const prefix = parseInt(prefixStr, 10);

  if (isNaN(prefix) || prefix < 0 || prefix > 32) return null;

  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return null;
  }

  const network = BigInt(
    (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]
  );
  const mask = BigInt(0xFFFFFFFF << (32 - prefix)) & BigInt(0xFFFFFFFF);

  return { network: network & mask, mask };
}

function ipToBigInt(ip: string): bigint | null {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return null;
  }
  return BigInt(
    (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]
  );
}

function isIpInCIDR(ip: string, cidr: string): boolean {
  const ipNum = ipToBigInt(ip);
  const range = parseCIDR(cidr);

  if (ipNum === null || range === null) return false;

  return (ipNum & range.mask) === range.network;
}

function getTwilioIpRanges(): string[] {
  const override = process.env.TWILIO_MEDIA_IP_ALLOWLIST;
  if (override) {
    return override.split(',').map(s => s.trim()).filter(Boolean);
  }
  return DEFAULT_TWILIO_IP_RANGES;
}

function checkIpAllowlist(ip: string): IpCheckResult {
  // Development bypass
  if (process.env.TWILIO_MEDIA_IP_ALLOW_UNKNOWN === 'true') {
    return { allowed: true, reason: 'development', ip };
  }

  const ranges = getTwilioIpRanges();
  const isOverride = !!process.env.TWILIO_MEDIA_IP_ALLOWLIST;

  for (const range of ranges) {
    if (isIpInCIDR(ip, range)) {
      return {
        allowed: true,
        reason: isOverride ? 'override' : 'twilio',
        ip
      };
    }
  }

  return { allowed: false, reason: 'unknown', ip };
}

function extractClientIp(req: IncomingMessage): string {
  // Check for forwarded headers (behind proxy/load balancer)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return first.trim();
  }

  // Direct connection
  const remoteAddr = req.socket.remoteAddress || 'unknown';
  // Strip IPv6 prefix if present
  return remoteAddr.replace(/^::ffff:/, '');
}

export function registerConnection(callSessionId: string, ws: WebSocket): boolean {
  if (activeConnections.has(callSessionId)) {
    return false; // Duplicate
  }
  activeConnections.set(callSessionId, ws);
  return true;
}

export function unregisterConnection(callSessionId: string): void {
  activeConnections.delete(callSessionId);
}

export function hasActiveConnection(callSessionId: string): boolean {
  const existing = activeConnections.get(callSessionId);
  if (!existing) return false;

  // Check if the connection is still open
  if (existing.readyState === WebSocket.OPEN) {
    return true;
  }

  // Clean up stale entry
  activeConnections.delete(callSessionId);
  return false;
}

export async function validateWebSocketConnection(
  req: IncomingMessage,
  callSessionId: string,
  token: string | null
): Promise<SecurityValidationResult> {
  const mode = getSecurityMode();
  const clientIp = extractClientIp(req);

  // 1. IP Check
  const ipCheck = checkIpAllowlist(clientIp);

  // 2. Token Check
  const tokenCheck = validateStreamToken(token, callSessionId);

  // 3. Connection Cap Check
  const hasExisting = hasActiveConnection(callSessionId);
  const connectionCapCheck = {
    allowed: !hasExisting,
    reason: hasExisting ? 'duplicate' as const : 'first' as const,
  };

  // Determine overall result
  const allChecksPass =
    ipCheck.allowed &&
    tokenCheck.valid &&
    connectionCapCheck.allowed;

  const result: SecurityValidationResult = {
    allowed: mode === 'audit' ? true : allChecksPass,
    ipCheck,
    tokenCheck: {
      valid: tokenCheck.valid,
      reason: tokenCheck.reason,
    },
    connectionCapCheck,
    mode,
  };

  // Log security event
  logSecurityEvent(callSessionId, result);

  // Send alerts for high-severity events
  if (!ipCheck.allowed || connectionCapCheck.reason === 'duplicate') {
    await sendSecurityAlert(callSessionId, result);
  }

  return result;
}

function logSecurityEvent(
  callSessionId: string,
  result: SecurityValidationResult
): void {
  const level = result.allowed ? 'info' : 'warn';
  const eventType = result.allowed ? 'ws_security_pass' : 'ws_security_fail';

  logger[level]({
    event: eventType,
    callSessionId,
    mode: result.mode,
    ip: {
      address: result.ipCheck.ip,
      allowed: result.ipCheck.allowed,
      reason: result.ipCheck.reason,
    },
    token: {
      valid: result.tokenCheck.valid,
      reason: result.tokenCheck.reason,
    },
    connectionCap: {
      allowed: result.connectionCapCheck.allowed,
      reason: result.connectionCapCheck.reason,
    },
  }, `WebSocket security ${eventType}`);
}
```

#### `telephony/src/services/ws-security-alerts.ts`

```typescript
import { logger } from '../server.js';
import { getInternalApiSecret } from '../utils/env.js';

export type SecurityEventType =
  | 'non_twilio_ip'
  | 'duplicate_connection'
  | 'invalid_token'
  | 'expired_token';

interface SecurityAlertPayload {
  eventType: SecurityEventType;
  callSessionId: string;
  details: Record<string, unknown>;
  timestamp: string;
  severity: 'high' | 'medium' | 'low';
}

export async function sendSecurityAlert(
  callSessionId: string,
  result: {
    ipCheck: { allowed: boolean; reason: string; ip: string };
    tokenCheck: { valid: boolean; reason: string };
    connectionCapCheck: { allowed: boolean; reason: string };
    mode: string;
  }
): Promise<void> {
  const events: SecurityAlertPayload[] = [];

  if (!result.ipCheck.allowed) {
    events.push({
      eventType: 'non_twilio_ip',
      callSessionId,
      details: {
        ip: result.ipCheck.ip,
        reason: result.ipCheck.reason,
      },
      timestamp: new Date().toISOString(),
      severity: 'high',
    });
  }

  if (result.connectionCapCheck.reason === 'duplicate') {
    events.push({
      eventType: 'duplicate_connection',
      callSessionId,
      details: {},
      timestamp: new Date().toISOString(),
      severity: 'high',
    });
  }

  if (!result.tokenCheck.valid && result.tokenCheck.reason === 'expired') {
    events.push({
      eventType: 'expired_token',
      callSessionId,
      details: { reason: result.tokenCheck.reason },
      timestamp: new Date().toISOString(),
      severity: 'medium',
    });
  }

  if (!result.tokenCheck.valid &&
      result.tokenCheck.reason !== 'expired' &&
      result.tokenCheck.reason !== 'missing') {
    events.push({
      eventType: 'invalid_token',
      callSessionId,
      details: { reason: result.tokenCheck.reason },
      timestamp: new Date().toISOString(),
      severity: 'high',
    });
  }

  // Send alerts via existing anomaly alerts endpoint
  const appBaseUrl = process.env.ULTAURA_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000';
  const alertsUrl = `${appBaseUrl.replace(/\/$/, '')}/api/telephony/alerts`;

  for (const event of events) {
    try {
      const response = await fetch(alertsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': getInternalApiSecret(),
        },
        body: JSON.stringify({
          anomalyType: `ws_security_${event.eventType}`,
          source: callSessionId,
          sourceType: 'session',
          details: {
            ...event.details,
            mode: result.mode,
          },
          timestamp: event.timestamp,
          severity: event.severity,
        }),
      });

      if (!response.ok) {
        logger.error({
          status: response.status,
          eventType: event.eventType
        }, 'Failed to send WS security alert');
      }
    } catch (error) {
      logger.error({ error, eventType: event.eventType },
        'Error sending WS security alert');
    }
  }
}
```

### 5.2 Files to Modify

#### `telephony/src/server.ts` (lines 150-169)

Replace the WebSocket connection handler:

```typescript
import {
  validateWebSocketConnection,
  registerConnection,
  unregisterConnection
} from './services/ws-security.js';

// ... existing code ...

// Handle WebSocket connections
wss.on('connection', async (ws, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const callSessionId = url.searchParams.get('callSessionId');
  const token = url.searchParams.get('token');

  if (!callSessionId) {
    logger.error('WebSocket connection without callSessionId');
    ws.close(1008, 'Connection rejected');
    return;
  }

  // Validate security
  const validation = await validateWebSocketConnection(req, callSessionId, token);

  if (!validation.allowed) {
    logger.warn({ callSessionId }, 'WebSocket connection rejected by security');
    ws.close(1008, 'Connection rejected');
    return;
  }

  // Register connection for cap tracking
  if (!registerConnection(callSessionId, ws)) {
    logger.warn({ callSessionId }, 'Duplicate connection rejected');
    ws.close(1008, 'Connection rejected');
    return;
  }

  // Clean up on close
  ws.on('close', () => {
    unregisterConnection(callSessionId);
  });

  logger.info({ callSessionId }, 'WebSocket connection established');
  handleMediaStreamConnection(ws, callSessionId);
});
```

#### `telephony/src/utils/twilio.ts` (lines 73-97)

Update `generateStreamTwiML` to include token:

```typescript
import { generateStreamToken } from '../services/stream-token.js';

// Update function signature and implementation
export function generateStreamTwiML(
  callSessionId: string,
  websocketUrl: string,
  options?: {
    includeDisclosure?: boolean;
    disclosureLanguage?: string;
  }
): string {
  const token = generateStreamToken(callSessionId);
  const streamUrl = `${websocketUrl}?callSessionId=${callSessionId}&token=${token}`;
  const includeDisclosure = options?.includeDisclosure ?? false;

  const disclosure = includeDisclosure
    ? buildRecordingDisclosure(options?.disclosureLanguage)
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
${disclosure}  <Connect>
    <Stream url="${streamUrl}">
      <Parameter name="callSessionId" value="${callSessionId}" />
    </Stream>
  </Connect>
</Response>`;
}
```

#### `telephony/src/utils/env-validator.ts`

Add new environment variables to validation:

```typescript
const ULTAURA_ENV_VARS: EnvVariable[] = [
  // ... existing variables ...

  // WebSocket Security (new)
  { name: 'ULTAURA_STREAM_TOKEN_SECRET', required: true, format: 'min32' },
  { name: 'ULTAURA_STREAM_TOKEN_SECRET_PREVIOUS', required: false, format: 'min32' },
  { name: 'ULTAURA_WS_SECURITY_MODE', required: false }, // audit|enforce
  { name: 'TWILIO_MEDIA_IP_ALLOWLIST', required: false }, // comma-separated CIDRs
  { name: 'TWILIO_MEDIA_IP_ALLOW_UNKNOWN', required: false, format: 'boolean' },
];
```

---

## 6. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ULTAURA_STREAM_TOKEN_SECRET` | Yes | - | HMAC secret for token signing. Min 32 chars. Generate with `openssl rand -hex 32` |
| `ULTAURA_STREAM_TOKEN_SECRET_PREVIOUS` | No | - | Previous secret for key rotation. Same format as above |
| `ULTAURA_WS_SECURITY_MODE` | No | `audit` | Security mode: `audit` (log only) or `enforce` (reject) |
| `TWILIO_MEDIA_IP_ALLOWLIST` | No | Built-in | Comma-separated CIDR ranges to override default Twilio IPs |
| `TWILIO_MEDIA_IP_ALLOW_UNKNOWN` | No | `false` | Set to `true` to allow any IP (development only) |

### Example `.env` additions:

```bash
# WebSocket Security (Required)
ULTAURA_STREAM_TOKEN_SECRET=your-32-char-minimum-secret-here-generate-with-openssl

# Optional: Previous secret during key rotation
# ULTAURA_STREAM_TOKEN_SECRET_PREVIOUS=old-secret-during-rotation

# Security mode: audit (default, log only) or enforce (reject invalid)
ULTAURA_WS_SECURITY_MODE=audit

# Development only: allow any IP
# TWILIO_MEDIA_IP_ALLOW_UNKNOWN=true

# Optional: Override Twilio IP ranges
# TWILIO_MEDIA_IP_ALLOWLIST=168.86.128.0/18,34.203.254.0/24
```

---

## 7. Token Format

### 7.1 Token Structure

```
{callSessionId}.{expiryTimestamp}.{signature}
```

- **callSessionId**: UUID from call session
- **expiryTimestamp**: Unix timestamp (seconds) when token expires
- **signature**: Base64URL-encoded HMAC-SHA256 of `{callSessionId}.{expiryTimestamp}`

### 7.2 Example Token

```
550e8400-e29b-41d4-a716-446655440000.1705600000.kGxP2r8vN_mYJkzH9q5bL0X3wRt6cKdF1uSe4pVoZnA
```

### 7.3 Generation Algorithm

```typescript
function generateStreamToken(callSessionId: string): string {
  const secret = process.env.ULTAURA_STREAM_TOKEN_SECRET;
  const exp = Math.floor(Date.now() / 1000) + 300; // 5 minutes
  const payload = `${callSessionId}.${exp}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}
```

### 7.4 Validation Algorithm

```typescript
function validateStreamToken(token: string, expectedSessionId: string): boolean {
  const [sessionId, expStr, signature] = token.split('.');

  // 1. Check session ID matches
  if (sessionId !== expectedSessionId) return false;

  // 2. Check expiry
  const exp = parseInt(expStr, 10);
  if (Date.now() / 1000 > exp) return false;

  // 3. Verify signature (try current key, then previous)
  const payload = `${sessionId}.${expStr}`;
  const expectedSig = hmac(payload, currentSecret);

  if (timingSafeEqual(signature, expectedSig)) return true;
  if (previousSecret) {
    return timingSafeEqual(signature, hmac(payload, previousSecret));
  }

  return false;
}
```

---

## 8. Twilio IP Ranges

### 8.1 Current Known Ranges

Based on Twilio documentation (as of January 2025):

| Range | Purpose | Notes |
|-------|---------|-------|
| `168.86.128.0/18` | Global Media IP Gateway | Primary range for voice media |
| `34.203.254.0/24` | Legacy US Media Streams | May still be active |
| `3.235.111.128/25` | Legacy US Media Streams | May still be active |

### 8.2 Update Procedure

1. **Monitor Twilio changelog**: https://www.twilio.com/en-us/changelog
2. **Subscribe to Twilio status**: https://status.twilio.com
3. **Update process**:
   - Add new ranges to `DEFAULT_TWILIO_IP_RANGES` array
   - Deploy with `ULTAURA_WS_SECURITY_MODE=audit`
   - Monitor logs for false positives
   - Switch to `enforce` after verification
   - Remove deprecated ranges after grace period

### 8.3 Important Note

Twilio has moved to using dynamic AWS IPs for Media Streams. The official guidance is:

> "Configure your firewall rules to allow secure websocket connections (TCP port 443) to your websocket servers from any public IP address."

The IP allowlisting in this spec is a **defense-in-depth** measure, not a primary security control. The HMAC token is the primary authentication mechanism.

---

## 9. Error Handling

### 9.1 WebSocket Close Codes

| Code | Reason | When Used |
|------|--------|-----------|
| `1008` | Policy Violation | All security rejections (generic) |
| `1011` | Internal Error | Server-side failures |

### 9.2 Generic Error Messages

All rejections use the same message to avoid information leakage:

```typescript
ws.close(1008, 'Connection rejected');
```

### 9.3 Server-Side Logging

Detailed information is logged server-side:

```typescript
logger.warn({
  event: 'ws_security_fail',
  callSessionId,
  mode: 'enforce',
  ip: {
    address: '203.0.113.50',
    allowed: false,
    reason: 'unknown',
  },
  token: {
    valid: false,
    reason: 'expired',
  },
  connectionCap: {
    allowed: true,
    reason: 'first',
  },
}, 'WebSocket security ws_security_fail');
```

### 9.4 Alert Severity Levels

| Event | Severity | Alert Triggered |
|-------|----------|-----------------|
| Non-Twilio IP | High | Yes |
| Duplicate connection | High | Yes |
| Invalid token signature | High | Yes |
| Expired token | Medium | Yes |
| Missing token | Low | No (audit mode only) |
| Malformed token | Medium | Yes |

---

## 10. Migration Plan

### Phase 1: Preparation (Week 1)

1. **Generate secrets**
   ```bash
   openssl rand -hex 32  # ULTAURA_STREAM_TOKEN_SECRET
   ```

2. **Update environment files**
   - Add `ULTAURA_STREAM_TOKEN_SECRET`
   - Set `ULTAURA_WS_SECURITY_MODE=audit`
   - Set `TWILIO_MEDIA_IP_ALLOW_UNKNOWN=true` (temporarily)

3. **Deploy token generation code**
   - New files: `stream-token.ts`, `ws-security.ts`, `ws-security-alerts.ts`
   - Update `twilio.ts` to include token in TwiML

4. **Verify token appears in WebSocket URLs**
   - Check TwiML output in logs
   - Confirm format: `wss://...?callSessionId=...&token=...`

### Phase 2: Audit Mode (Week 2)

1. **Enable IP checking in audit mode**
   ```bash
   ULTAURA_WS_SECURITY_MODE=audit
   TWILIO_MEDIA_IP_ALLOW_UNKNOWN=false
   ```

2. **Monitor logs for 1 week**
   - Look for `ws_security_fail` events
   - Identify any legitimate Twilio IPs not in allowlist
   - Update `TWILIO_MEDIA_IP_ALLOWLIST` if needed

3. **Review alerts**
   - Check for false positives
   - Tune alerting thresholds if needed

### Phase 3: Soft Enforcement (Week 3)

1. **Enable enforcement for token only**
   - Keep IP in audit mode initially
   - Token failures will reject

2. **Monitor for issues**
   - Check call success rates
   - Review any token-related failures

### Phase 4: Full Enforcement (Week 4)

1. **Enable full enforcement**
   ```bash
   ULTAURA_WS_SECURITY_MODE=enforce
   ```

2. **Monitor closely for 48 hours**
   - Watch for increased call failures
   - Be ready to roll back

3. **Declare success**
   - Document any IP ranges added
   - Update runbooks

---

## 11. Testing Strategy

### 11.1 Test Matrix

| Scenario | Token | IP | Connection | Mode | Expected Result |
|----------|-------|-----|------------|------|-----------------|
| Valid connection | Valid | Twilio | First | Enforce | Allow |
| Valid connection | Valid | Twilio | First | Audit | Allow |
| Expired token | Expired | Twilio | First | Enforce | Reject |
| Expired token | Expired | Twilio | First | Audit | Allow + Log |
| Invalid signature | Invalid | Twilio | First | Enforce | Reject |
| Missing token | Missing | Twilio | First | Enforce | Reject |
| Non-Twilio IP | Valid | Non-Twilio | First | Enforce | Reject |
| Non-Twilio IP | Valid | Non-Twilio | First | Audit | Allow + Log + Alert |
| Dev bypass | Valid | Any | First | Enforce + Dev | Allow |
| Duplicate connection | Valid | Twilio | Second | Enforce | Reject |
| Previous key rotation | PrevKey | Twilio | First | Enforce | Allow |

### 11.2 Mock Helpers

#### `telephony/src/__tests__/helpers/ws-security-mocks.ts`

```typescript
import crypto from 'crypto';
import { IncomingMessage } from 'http';
import { generateStreamToken } from '../../services/stream-token.js';

// Generate a valid token for testing
export function createValidToken(callSessionId: string): string {
  return generateStreamToken(callSessionId);
}

// Generate an expired token
export function createExpiredToken(callSessionId: string): string {
  const exp = Math.floor(Date.now() / 1000) - 60; // 1 minute ago
  const payload = `${callSessionId}.${exp}`;
  const signature = crypto
    .createHmac('sha256', process.env.ULTAURA_STREAM_TOKEN_SECRET!)
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

// Generate a token with wrong signature
export function createInvalidToken(callSessionId: string): string {
  const exp = Math.floor(Date.now() / 1000) + 300;
  return `${callSessionId}.${exp}.invalidSignature123`;
}

// Mock Twilio IP
export function createTwilioIpRequest(): Partial<IncomingMessage> {
  return {
    socket: { remoteAddress: '168.86.128.1' } as any,
    headers: {},
  };
}

// Mock non-Twilio IP
export function createNonTwilioIpRequest(): Partial<IncomingMessage> {
  return {
    socket: { remoteAddress: '203.0.113.50' } as any,
    headers: {},
  };
}

// Mock with X-Forwarded-For
export function createProxiedRequest(ip: string): Partial<IncomingMessage> {
  return {
    socket: { remoteAddress: '127.0.0.1' } as any,
    headers: { 'x-forwarded-for': ip },
  };
}

// Time manipulation helper
export function withFrozenTime<T>(
  timestamp: number,
  fn: () => T
): T {
  const realDateNow = Date.now;
  Date.now = () => timestamp;
  try {
    return fn();
  } finally {
    Date.now = realDateNow;
  }
}
```

### 11.3 Unit Tests

#### `telephony/src/services/__tests__/stream-token.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateStreamToken, validateStreamToken } from '../stream-token.js';

describe('stream-token', () => {
  beforeEach(() => {
    vi.stubEnv('ULTAURA_STREAM_TOKEN_SECRET', 'test-secret-at-least-32-characters');
  });

  describe('generateStreamToken', () => {
    it('generates a token with correct format', () => {
      const token = generateStreamToken('test-session-id');
      const parts = token.split('.');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('test-session-id');
    });

    it('sets expiry 5 minutes in the future', () => {
      const token = generateStreamToken('test-session-id');
      const [, expStr] = token.split('.');
      const exp = parseInt(expStr, 10);
      const now = Math.floor(Date.now() / 1000);
      expect(exp - now).toBeCloseTo(300, -1); // Within 10 seconds
    });
  });

  describe('validateStreamToken', () => {
    it('validates a fresh token', () => {
      const token = generateStreamToken('test-session-id');
      const result = validateStreamToken(token, 'test-session-id');
      expect(result.valid).toBe(true);
      expect(result.reason).toBe('valid');
    });

    it('rejects expired token', () => {
      vi.useFakeTimers();
      const token = generateStreamToken('test-session-id');
      vi.advanceTimersByTime(6 * 60 * 1000); // 6 minutes
      const result = validateStreamToken(token, 'test-session-id');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('expired');
      vi.useRealTimers();
    });

    it('rejects token for wrong session', () => {
      const token = generateStreamToken('test-session-id');
      const result = validateStreamToken(token, 'different-session');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid_signature');
    });

    it('accepts token signed with previous key', () => {
      vi.stubEnv('ULTAURA_STREAM_TOKEN_SECRET_PREVIOUS', 'test-secret-at-least-32-characters');
      vi.stubEnv('ULTAURA_STREAM_TOKEN_SECRET', 'new-secret-at-least-32-characters-long');

      // Generate with old key (simulated)
      const oldToken = generateStreamToken('test-session-id');
      // ... validate with new key setup
    });
  });
});
```

### 11.4 Integration Tests

```typescript
describe('WebSocket security integration', () => {
  it('allows valid Twilio connection', async () => {
    const session = await createTestCallSession();
    const token = generateStreamToken(session.id);

    const ws = new WebSocket(
      `wss://localhost:3001/twilio/media?callSessionId=${session.id}&token=${token}`
    );

    await expect(wsConnected(ws)).resolves.toBe(true);
    ws.close();
  });

  it('rejects connection from non-Twilio IP in enforce mode', async () => {
    vi.stubEnv('ULTAURA_WS_SECURITY_MODE', 'enforce');
    vi.stubEnv('TWILIO_MEDIA_IP_ALLOW_UNKNOWN', 'false');

    // This test requires mocking the IP check
    // ...
  });
});
```

---

## 12. Rollback Plan

### 12.1 Immediate Rollback (< 5 minutes)

If calls are failing after deployment:

```bash
# Option 1: Disable all enforcement
export ULTAURA_WS_SECURITY_MODE=audit
export TWILIO_MEDIA_IP_ALLOW_UNKNOWN=true

# Restart telephony server
pm2 restart telephony
# or
docker-compose restart telephony
```

### 12.2 Quick IP Fix

If specific Twilio IPs are blocked:

```bash
# Add missing ranges
export TWILIO_MEDIA_IP_ALLOWLIST="168.86.128.0/18,34.203.254.0/24,3.235.111.128/25,NEW.RANGE.HERE/24"

# Restart
pm2 restart telephony
```

### 12.3 Complete Rollback

If the feature needs to be fully reverted:

1. Revert the code changes in `server.ts` WebSocket handler
2. Revert `generateStreamTwiML` in `twilio.ts`
3. Keep new files but they won't be called
4. Deploy reverted code

### 12.4 Monitoring During Rollback

After rollback, monitor:
- Call success rates return to normal
- No more `ws_security_fail` events with rejections
- Alerts stop firing

---

## 13. Future Considerations

### 13.1 Explicitly Deferred

1. **mTLS/Client certificates**: More complex to implement, requires Twilio support
2. **Redis-backed connection tracking**: Current in-memory Map is sufficient for single-instance deployment
3. **Per-account connection limits**: Not needed for current threat model
4. **WebSocket message-level authentication**: Token at connection time is sufficient
5. **Rate limiting on WebSocket connections**: Covered by existing IP rate limiting

### 13.2 Potential Future Enhancements

1. **Dynamic Twilio IP fetching**: Query Twilio API for current IP ranges
2. **Token refresh mechanism**: Extend token during long calls
3. **Distributed connection tracking**: Use Redis for multi-instance deployments
4. **Metrics and dashboards**: Add Prometheus metrics for security events

### 13.3 Dependencies on External Changes

- Twilio IP range updates: Monitor changelog
- AWS IP range changes: Twilio manages this

---

## Appendix A: WebSocket Close Codes Reference

| Code | Name | Description |
|------|------|-------------|
| 1000 | Normal Closure | Clean close |
| 1001 | Going Away | Server shutting down |
| 1008 | Policy Violation | Security rejection |
| 1011 | Internal Error | Server error |

## Appendix B: CIDR Calculation Examples

```
168.86.128.0/18
Network: 168.86.128.0
Broadcast: 168.86.191.255
Usable IPs: 168.86.128.1 - 168.86.191.254
Total IPs: 16,384
```

## Appendix C: Changelog Entry Template

```markdown
## [Date] WebSocket Security Enhancement

### Added
- HMAC-SHA256 token authentication for `/twilio/media` WebSocket
- Twilio IP allowlisting with configurable overrides
- Per-call connection cap (single connection per session)
- Audit mode for gradual rollout
- Security event logging and alerting

### Environment Variables
- `ULTAURA_STREAM_TOKEN_SECRET` (required): Token signing secret
- `ULTAURA_WS_SECURITY_MODE` (optional): `audit` or `enforce`
- `TWILIO_MEDIA_IP_ALLOWLIST` (optional): Override IP ranges
- `TWILIO_MEDIA_IP_ALLOW_UNKNOWN` (optional): Development bypass
```

---

## Critical Files for Implementation

Files most critical for implementing this plan:

1. **`telephony/src/server.ts`** (lines 150-169) - Core WebSocket handler that needs security validation added
2. **`telephony/src/utils/twilio.ts`** (lines 73-97) - TwiML generation that needs token parameter added to WebSocket URL
3. **`telephony/src/websocket/grok-bridge-registry.ts`** - Pattern to follow for in-memory connection tracking
4. **`telephony/src/services/anomaly-alerts.ts`** - Pattern to follow for security alerting integration
5. **`telephony/src/utils/env-validator.ts`** - Environment variable validation that needs new security variables added

---

**Document Version**: 1.0
**Last Updated**: 2026-01-18
**Author**: Claude (Planning Agent)
