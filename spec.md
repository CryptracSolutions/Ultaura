# Multi-Instance Scaling Hazards Fix Specification

## Version 1.0 | January 2026

---

## 1. Objective and Scope

### 1.1 Problem Statement

The Ultaura telephony system runs 4-10 Kubernetes pods with Nginx Ingress. The current implementation has three critical scaling hazards:

1. **WebSocket Sessions**: In-memory state (`GrokBridge` registry, ephemeral buffers) breaks when pods restart or when WebSocket reconnections land on different pods
2. **Weekly Summary Scheduler**: All instances independently fetch and process ALL lines, causing duplicate emails
3. **Recording Deletion Scheduler**: All instances independently process the same deletion queue, causing duplicate Twilio API calls and corrupted retry counts

### 1.2 Scope

This specification covers:
- WebSocket sticky session configuration for Kubernetes/Nginx Ingress
- Distributed coordination for weekly summary scheduler
- Distributed coordination for recording deletion scheduler
- Graceful shutdown with connection draining
- Monitoring, testing, and rollback procedures

### 1.3 Priority Order

1. WebSocket sticky sessions (highest impact on user experience)
2. Weekly summary scheduler (duplicate emails visible to customers)
3. Recording deletion scheduler (wasted API calls, data integrity)

---

## 2. Architecture Overview

### 2.1 Current Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Nginx Ingress                                 │
│                     (No session affinity)                            │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│   Pod 1       │ │   Pod 2       │ │   Pod N       │
│ - scheduler   │ │ - scheduler   │ │ - scheduler   │
│ - ws-registry │ │ - ws-registry │ │ - ws-registry │
│ (in-memory)   │ │ (in-memory)   │ │ (in-memory)   │
└───────────────┘ └───────────────┘ └───────────────┘
```

### 2.2 Target Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Nginx Ingress                                 │
│            (Sticky sessions via callSessionId header)                │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│   Pod 1       │ │   Pod 2       │ │   Pod N       │
│ - scheduler   │ │ - scheduler   │ │ - scheduler   │
│   (lease)     │   (standby)    │   (standby)    │
│ - ws-registry │ │ - ws-registry │ │ - ws-registry │
│ (local only)  │ │ (local only)  │ │ (local only)  │
└───────────────┘ └───────────────┘ └───────────────┘
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ▼
              ┌───────────────────────┐
              │     PostgreSQL        │
              │  - scheduler_leases   │
              │  - call_sessions      │
              └───────────────────────┘
```

### 2.3 Coordination Strategy

| Component | Coordination Method | Rationale |
|-----------|---------------------|-----------|
| WebSocket | Nginx sticky sessions | Audio streams are non-serializable; affinity ensures same pod handles entire call |
| Weekly Summary | PostgreSQL lease | Single-leader pattern; only one instance processes at a time |
| Recording Deletion | PostgreSQL lease + atomic claim | Lease for coordination, atomic claim for individual records |
| Exports | Existing optimistic lock | Already has `status='pending'` check; lease adds extra protection |

---

## 3. Part 1: WebSocket Sticky Sessions

### 3.1 Overview

WebSocket connections carry non-serializable state (active WebSocket handles, callbacks, audio buffers). Rather than externalizing this state, we use sticky sessions to ensure a call's entire WebSocket lifecycle stays on one pod.

### 3.2 Nginx Ingress Configuration

Create a dedicated `Ingress` resource for the telephony WebSocket path:

```yaml
# kubernetes/telephony-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ultaura-telephony-ws
  namespace: ultaura
  annotations:
    # Enable sticky sessions based on custom header
    nginx.ingress.kubernetes.io/affinity: "cookie"
    nginx.ingress.kubernetes.io/affinity-mode: "persistent"
    nginx.ingress.kubernetes.io/session-cookie-name: "ULTAURA_AFFINITY"
    nginx.ingress.kubernetes.io/session-cookie-hash: "sha1"
    nginx.ingress.kubernetes.io/session-cookie-max-age: "3600"
    # WebSocket support
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    # Use upstream hash for initial routing based on callSessionId
    nginx.ingress.kubernetes.io/upstream-hash-by: "$http_x_call_session_id"
    # Connection draining
    nginx.ingress.kubernetes.io/server-snippet: |
      # Allow existing connections to drain during pod termination
      proxy_connect_timeout 60s;
      proxy_read_timeout 3600s;
      proxy_send_timeout 3600s;
spec:
  ingressClassName: nginx
  rules:
    - host: telephony.ultaura.com
      http:
        paths:
          - path: /twilio/media
            pathType: Prefix
            backend:
              service:
                name: ultaura-telephony
                port:
                  number: 3001
```

### 3.3 Twilio WebSocket URL Header Propagation

Modify the TwiML generation to include the `callSessionId` as a header hint. The WebSocket URL already includes `callSessionId` as a query parameter. Nginx can hash on this for consistent routing.

**File: `telephony/src/utils/twilio.ts`**

Add a custom header when generating the WebSocket URL:

```typescript
export function generateStreamTwiML(
  callSessionId: string,
  websocketUrl: string
): string {
  // Ensure the callSessionId is included for sticky routing
  const url = new URL(websocketUrl);
  url.pathname = '/twilio/media';
  url.searchParams.set('callSessionId', callSessionId);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${url.toString()}">
      <Parameter name="callSessionId" value="${callSessionId}" />
    </Stream>
  </Connect>
</Response>`;
}
```

**Nginx Configuration for Query Parameter Hashing:**

```yaml
# Alternative: Hash on query parameter instead of header
nginx.ingress.kubernetes.io/server-snippet: |
  set $affinity_key "";
  if ($args ~* "callSessionId=([^&]+)") {
    set $affinity_key $1;
  }
nginx.ingress.kubernetes.io/upstream-hash-by: "$affinity_key"
```

### 3.4 Graceful Degradation on Pod Failure

When a pod dies mid-call, the WebSocket closes and Twilio triggers the status callback. Handle this gracefully:

**File: `telephony/src/routes/twilio-status.ts`**

```typescript
// Add handling for unexpected disconnection
if (callStatus === 'failed' || callStatus === 'busy') {
  // Check if this was due to pod failure (no clean end)
  const session = await getCallSession(callSid);
  if (session?.status === 'in_progress' && !session.end_reason) {
    logger.warn({
      callSessionId: session.id,
      callSid,
      status: callStatus,
    }, 'Call ended unexpectedly - possible pod failure');

    // Mark session with appropriate end reason
    await completeCallSession(session.id, {
      endReason: 'system_error',
      languageDetected: null,
    });
  }
}
```

**Apology TTS for Reconnection Failure:**

The existing `media-stream.ts` already has reconnection logic with fallback TTS. When reconnection fails after max attempts, it plays an apology message:

```typescript
// Existing code in media-stream.ts:
const failedMessage = getFallbackMessage(detectedLanguage, 'retry_failed');
await playFallbackTTS(callSid, failedMessage, detectedLanguage, { hangup: true });
```

Ensure the fallback messages include appropriate apology text:

**File: `telephony/src/utils/fallback-messages.ts`**

```typescript
export const FALLBACK_MESSAGES = {
  en: {
    retry_wait: "I'm having a brief connection issue. Please hold on just a moment.",
    retry_failed: "I'm so sorry, but I'm experiencing technical difficulties and need to end our call. I'll try calling you back soon. Take care!",
  },
  es: {
    retry_wait: "Estoy teniendo un pequeño problema de conexión. Por favor espere un momento.",
    retry_failed: "Lo siento mucho, pero estoy experimentando dificultades técnicas y necesito terminar nuestra llamada. ¡Intentaré llamarte pronto! ¡Cuídate!",
  },
  // ... other languages
};
```

### 3.5 Graceful Shutdown with Connection Draining

**File: `telephony/src/server.ts`**

Modify the shutdown handlers to drain active WebSocket connections:

```typescript
// Configuration
const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 30_000; // 30 seconds to drain
const DRAIN_CHECK_INTERVAL_MS = 1_000;

// Track active call sessions
const activeCallSessions = new Set<string>();

export function registerActiveCall(callSessionId: string): void {
  activeCallSessions.add(callSessionId);
}

export function unregisterActiveCall(callSessionId: string): void {
  activeCallSessions.delete(callSessionId);
}

export function getActiveCallCount(): number {
  return activeCallSessions.size;
}

// Graceful shutdown with draining
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal, activeCallCount: activeCallSessions.size }, 'Shutdown signal received, starting graceful shutdown');

  // Stop accepting new connections
  // (Kubernetes removes pod from service endpoints when readiness probe fails)

  // Stop all schedulers immediately
  stopScheduler();
  stopWeeklySummaryScheduler();
  stopRecordingDeletionScheduler();
  stopEmbeddingJob();
  stopMemoryDecayJob();

  // Wait for active calls to complete or timeout
  const startTime = Date.now();

  while (activeCallSessions.size > 0) {
    const elapsed = Date.now() - startTime;

    if (elapsed >= GRACEFUL_SHUTDOWN_TIMEOUT_MS) {
      logger.warn({
        remainingCalls: activeCallSessions.size,
        callSessionIds: Array.from(activeCallSessions),
      }, 'Graceful shutdown timeout - forcing closure');
      break;
    }

    logger.info({
      activeCallCount: activeCallSessions.size,
      elapsedMs: elapsed,
      remainingMs: GRACEFUL_SHUTDOWN_TIMEOUT_MS - elapsed,
    }, 'Waiting for active calls to drain');

    await sleep(DRAIN_CHECK_INTERVAL_MS);
  }

  // Close HTTP server
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force exit after additional timeout
  setTimeout(() => {
    logger.error('Forced exit after server.close timeout');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

**Update media-stream.ts to register/unregister calls:**

```typescript
// At start of handleMediaStreamConnection:
registerActiveCall(callSessionId);

// In ws.on('close') handler, before cleanup:
unregisterActiveCall(callSessionId);

// In ws.on('error') handler:
unregisterActiveCall(callSessionId);
```

### 3.6 Kubernetes Pod Configuration

Configure the pod to support graceful draining:

```yaml
# kubernetes/telephony-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ultaura-telephony
  namespace: ultaura
spec:
  replicas: 4
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0  # Never remove pods until new ones are ready
  template:
    spec:
      terminationGracePeriodSeconds: 60  # Allow 60s for draining
      containers:
        - name: telephony
          image: ultaura/telephony:latest
          ports:
            - containerPort: 3001
          env:
            - name: HOSTNAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
          readinessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 5
            periodSeconds: 10
            failureThreshold: 3
          livenessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 15
            periodSeconds: 20
            failureThreshold: 3
          lifecycle:
            preStop:
              exec:
                # Give time for ingress to update before shutdown starts
                command: ["/bin/sh", "-c", "sleep 5"]
```

### 3.7 Failure Tracking (Logging Only)

Track pod failures via structured logging rather than a database table:

```typescript
// In media-stream.ts onDisconnect handler:
logger.error({
  event: 'call_pod_failure',
  callSessionId,
  reconnectAttempts,
  podName: process.env.HOSTNAME,
  timestamp: new Date().toISOString(),
}, 'Call ended due to pod failure');

// Metrics can be scraped from logs or emitted to Prometheus
```

---

## 4. Part 2: Weekly Summary Scheduler

### 4.1 Overview

The weekly summary scheduler processes all lines hourly to generate weekly summary emails. Currently, all pods run independently, causing N-fold duplication.

### 4.2 Database Migration

Add a new lease row for weekly summaries:

**File: `supabase/migrations/20260120000001_weekly_summary_lease.sql`**

```sql
-- Add lease row for weekly summary scheduler
INSERT INTO ultaura_scheduler_leases (id)
VALUES ('weekly-summaries')
ON CONFLICT (id) DO NOTHING;

-- Add comment
COMMENT ON TABLE ultaura_scheduler_leases IS
  'Distributed locking for scheduler coordination. Lease IDs: schedules, reminders, weekly-summaries, recording-deletions';
```

### 4.3 Code Changes

**File: `telephony/src/scheduler/weekly-summary-scheduler.ts`**

Complete rewrite to use lease-based coordination:

```typescript
// Weekly summary scheduler with distributed coordination
// Uses PostgreSQL leases to ensure only one instance processes at a time

import { v4 as uuidv4 } from 'uuid';
import { getSupabaseClient, LineRow } from '../utils/supabase.js';
import { logger } from '../utils/logger.js';
import { generateWeeklySummaryForLine } from '../services/weekly-summary.js';

// Configuration
const POLL_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const LEASE_DURATION_SECONDS = 300; // 5 minutes
const HEARTBEAT_INTERVAL_MS = 60_000; // 1 minute
const LEASE_ID = 'weekly-summaries';

// Worker identity (unique per instance)
const WORKER_ID = `${process.env.HOSTNAME || 'local'}-${uuidv4().slice(0, 8)}`;

// Scheduler state
let isRunning = false;
let interval: ReturnType<typeof setInterval> | null = null;
let timeout: ReturnType<typeof setTimeout> | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let shuttingDown = false;

export function startWeeklySummaryScheduler(): void {
  if (process.env.SCHEDULER_DISABLED === 'true') {
    logger.info('Weekly summary scheduler disabled via SCHEDULER_DISABLED env var');
    return;
  }

  logger.info({
    workerId: WORKER_ID,
    pollIntervalMs: POLL_INTERVAL_MS,
    leaseDurationSeconds: LEASE_DURATION_SECONDS,
  }, 'Starting weekly summary scheduler');

  // Run immediately on start
  runWeeklySummaryCycle();

  // Align to the top of the hour
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setMinutes(60, 0, 0);
  const delayMs = Math.max(0, nextHour.getTime() - now.getTime());

  timeout = setTimeout(() => {
    runWeeklySummaryCycle();
    interval = setInterval(runWeeklySummaryCycle, POLL_INTERVAL_MS);
  }, delayMs);
}

export function stopWeeklySummaryScheduler(): void {
  shuttingDown = true;

  if (timeout) {
    clearTimeout(timeout);
    timeout = null;
  }

  if (interval) {
    clearInterval(interval);
    interval = null;
  }

  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  // Release the lease if we hold it
  releaseLease().catch(err =>
    logger.error({ err, leaseId: LEASE_ID }, 'Error releasing lease during shutdown')
  );

  logger.info({ workerId: WORKER_ID }, 'Weekly summary scheduler stopped');
}

async function runWeeklySummaryCycle(): Promise<void> {
  if (isRunning || shuttingDown) {
    logger.debug('Weekly summary cycle skipped (already running or shutting down)');
    return;
  }

  isRunning = true;

  try {
    await processWithLease();
  } catch (error) {
    logger.error({ error, workerId: WORKER_ID }, 'Weekly summary scheduler cycle error');
  } finally {
    isRunning = false;
  }
}

async function processWithLease(): Promise<void> {
  const supabase = getSupabaseClient();

  // Try to acquire the lease
  const { data: acquired, error: leaseError } = await supabase.rpc(
    'try_acquire_scheduler_lease',
    {
      p_lease_id: LEASE_ID,
      p_worker_id: WORKER_ID,
      p_lease_duration_seconds: LEASE_DURATION_SECONDS,
    }
  );

  if (leaseError) {
    logger.error({ error: leaseError, leaseId: LEASE_ID }, 'Failed to acquire weekly summary lease');
    return;
  }

  if (!acquired) {
    logger.debug({ leaseId: LEASE_ID, workerId: WORKER_ID }, 'Weekly summary lease held by another worker');
    return;
  }

  logger.info({ leaseId: LEASE_ID, workerId: WORKER_ID }, 'Acquired weekly summary lease');

  // Start heartbeat for this lease
  heartbeatInterval = setInterval(async () => {
    if (shuttingDown) return;

    const { error } = await supabase.rpc('heartbeat_scheduler_lease', {
      p_lease_id: LEASE_ID,
      p_worker_id: WORKER_ID,
      p_extend_seconds: LEASE_DURATION_SECONDS,
    });

    if (error) {
      logger.warn({ error, leaseId: LEASE_ID }, 'Weekly summary heartbeat failed');
    }
  }, HEARTBEAT_INTERVAL_MS);

  try {
    await processAllLines();
  } finally {
    // Stop heartbeat
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    // Release lease
    await releaseLease();
  }
}

async function processAllLines(): Promise<void> {
  const supabase = getSupabaseClient();

  const { data: lines, error } = await supabase
    .from('ultaura_lines')
    .select('id, account_id, display_name, timezone, short_id, last_weekly_summary_at');

  if (error) {
    logger.error({ error }, 'Failed to fetch lines for weekly summaries');
    return;
  }

  logger.info({ lineCount: lines?.length ?? 0, workerId: WORKER_ID }, 'Processing lines for weekly summaries');

  for (const line of (lines || []) as LineRow[]) {
    if (shuttingDown) {
      logger.info('Shutting down, stopping weekly summary processing');
      break;
    }

    try {
      await generateWeeklySummaryForLine(line);
    } catch (error) {
      logger.error({ error, lineId: line.id }, 'Failed to generate weekly summary for line');
    }
  }
}

async function releaseLease(): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.rpc('release_scheduler_lease', {
    p_lease_id: LEASE_ID,
    p_worker_id: WORKER_ID,
  });

  if (error) {
    logger.warn({ error, leaseId: LEASE_ID }, 'Failed to release weekly summary lease');
  } else {
    logger.debug({ leaseId: LEASE_ID, workerId: WORKER_ID }, 'Released weekly summary lease');
  }
}
```

### 4.4 Database Connection Loss Handling

The code handles DB connection loss gracefully:
- `try_acquire_scheduler_lease` returns error on failure
- Error is logged and cycle exits without processing
- Next cycle (1 hour later) will retry

---

## 5. Part 3: Recording Deletion Scheduler

### 5.1 Overview

The recording deletion scheduler processes pending recording deletions and data export requests. It needs lease coordination to prevent duplicate processing.

### 5.2 Database Migration

Add lease row for recording deletions:

**File: `supabase/migrations/20260120000002_recording_deletion_lease.sql`**

```sql
-- Add lease row for recording deletion scheduler
INSERT INTO ultaura_scheduler_leases (id)
VALUES ('recording-deletions')
ON CONFLICT (id) DO NOTHING;
```

### 5.3 Code Changes

**File: `telephony/src/scheduler/recording-deletion.ts`**

Complete rewrite with lease coordination:

```typescript
// Recording deletion scheduler with distributed coordination
// Handles both recording deletions and data export requests

import { v4 as uuidv4 } from 'uuid';
import { getSupabaseClient } from '../utils/supabase.js';
import { getTwilioClient } from '../utils/twilio.js';
import { logger } from '../utils/logger.js';
import { processExportRequest } from '../services/exports.js';

// Configuration
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const LEASE_DURATION_SECONDS = 300; // 5 minutes
const HEARTBEAT_INTERVAL_MS = 60_000; // 1 minute
const LEASE_ID = 'recording-deletions';
const FETCH_LIMIT = 200;
const BATCH_LIMIT = 50;
const EXPORT_BATCH_LIMIT = 5;

// Worker identity
const WORKER_ID = `${process.env.HOSTNAME || 'local'}-${uuidv4().slice(0, 8)}`;

// Scheduler state
let pollInterval: NodeJS.Timeout | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;
let isRunning = false;
let lastExportCleanupAt = 0;
let shuttingDown = false;

function getBackoffMs(attempts: number): number {
  if (attempts <= 0) return 0;
  if (attempts === 1) return 15 * 60 * 1000; // 15 minutes
  if (attempts === 2) return 60 * 60 * 1000; // 1 hour
  return Number.POSITIVE_INFINITY;
}

function canAttempt(record: {
  attempts: number;
  last_attempt_at: string | null;
}): boolean {
  const backoffMs = getBackoffMs(record.attempts);
  if (backoffMs === 0) return true;
  if (!record.last_attempt_at) return true;
  const lastAttemptMs = new Date(record.last_attempt_at).getTime();
  return Date.now() - lastAttemptMs >= backoffMs;
}

export function startRecordingDeletionScheduler(): void {
  if (process.env.RECORDING_DELETION_DISABLED === 'true') {
    logger.info('Recording deletion scheduler disabled via RECORDING_DELETION_DISABLED');
    return;
  }

  if (pollInterval) return;

  logger.info({
    workerId: WORKER_ID,
    pollIntervalMs: POLL_INTERVAL_MS,
    leaseDurationSeconds: LEASE_DURATION_SECONDS,
  }, 'Starting recording deletion scheduler');

  pollInterval = setInterval(processPendingRecordingDeletions, POLL_INTERVAL_MS);

  // Run immediately
  processPendingRecordingDeletions().catch((error) => {
    logger.error({ error }, 'Initial recording deletion run failed');
  });
}

export function stopRecordingDeletionScheduler(): void {
  shuttingDown = true;

  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }

  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  // Release lease
  releaseLease().catch(err =>
    logger.error({ err, leaseId: LEASE_ID }, 'Error releasing lease during shutdown')
  );

  logger.info({ workerId: WORKER_ID }, 'Recording deletion scheduler stopped');
}

export async function processPendingRecordingDeletions(): Promise<void> {
  if (isRunning || shuttingDown) return;
  isRunning = true;

  try {
    await processWithLease();
  } catch (error) {
    logger.error({ error, workerId: WORKER_ID }, 'Recording deletion scheduler error');
  } finally {
    isRunning = false;
  }
}

async function processWithLease(): Promise<void> {
  const supabase = getSupabaseClient();

  // Try to acquire the lease
  const { data: acquired, error: leaseError } = await supabase.rpc(
    'try_acquire_scheduler_lease',
    {
      p_lease_id: LEASE_ID,
      p_worker_id: WORKER_ID,
      p_lease_duration_seconds: LEASE_DURATION_SECONDS,
    }
  );

  if (leaseError) {
    logger.error({ error: leaseError, leaseId: LEASE_ID }, 'Failed to acquire recording deletion lease');
    return;
  }

  if (!acquired) {
    logger.debug({ leaseId: LEASE_ID, workerId: WORKER_ID }, 'Recording deletion lease held by another worker');
    return;
  }

  logger.debug({ leaseId: LEASE_ID, workerId: WORKER_ID }, 'Acquired recording deletion lease');

  // Start heartbeat
  heartbeatInterval = setInterval(async () => {
    if (shuttingDown) return;

    const { error } = await supabase.rpc('heartbeat_scheduler_lease', {
      p_lease_id: LEASE_ID,
      p_worker_id: WORKER_ID,
      p_extend_seconds: LEASE_DURATION_SECONDS,
    });

    if (error) {
      logger.warn({ error, leaseId: LEASE_ID }, 'Recording deletion heartbeat failed');
    }
  }, HEARTBEAT_INTERVAL_MS);

  try {
    // Process all tasks in sequence
    await maybeCleanupExpiredExports();
    await processPendingExportRequests();
    await processPendingDeletions();
  } finally {
    // Stop heartbeat
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    // Release lease
    await releaseLease();
  }
}

async function releaseLease(): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.rpc('release_scheduler_lease', {
    p_lease_id: LEASE_ID,
    p_worker_id: WORKER_ID,
  });

  if (error) {
    logger.warn({ error, leaseId: LEASE_ID }, 'Failed to release recording deletion lease');
  } else {
    logger.debug({ leaseId: LEASE_ID, workerId: WORKER_ID }, 'Released recording deletion lease');
  }
}

async function maybeCleanupExpiredExports(): Promise<void> {
  const now = Date.now();
  const cleanupIntervalMs = 24 * 60 * 60 * 1000; // 24 hours

  if (now - lastExportCleanupAt < cleanupIntervalMs) {
    return;
  }

  lastExportCleanupAt = now;

  const supabase = getSupabaseClient();
  const bucket = supabase.storage.from('ultaura-exports');
  const nowIso = new Date(now).toISOString();

  // Clean up expired ready exports
  const { data: expiredReady, error: expiredError } = await supabase
    .from('ultaura_data_export_requests')
    .select('id, account_id, format')
    .eq('status', 'ready')
    .lt('expires_at', nowIso);

  if (expiredError) {
    logger.error({ error: expiredError }, 'Failed to load expired exports');
  } else if (expiredReady?.length) {
    for (const exportRequest of expiredReady) {
      const path = `${exportRequest.account_id}/${exportRequest.id}.${exportRequest.format}`;
      const { error: removeError } = await bucket.remove([path]);
      if (removeError) {
        logger.error({ error: removeError, path }, 'Failed to remove expired export file');
      }

      await supabase
        .from('ultaura_data_export_requests')
        .update({ status: 'expired', download_url: null })
        .eq('id', exportRequest.id);
    }

    logger.info({ count: expiredReady.length }, 'Cleaned up expired exports');
  }

  // Clean up old failed exports
  const failedCutoff = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: failedExports, error: failedError } = await supabase
    .from('ultaura_data_export_requests')
    .select('id, account_id, format')
    .eq('status', 'failed')
    .lt('created_at', failedCutoff);

  if (failedError) {
    logger.error({ error: failedError }, 'Failed to load old failed exports');
  } else if (failedExports?.length) {
    for (const exportRequest of failedExports) {
      const path = `${exportRequest.account_id}/${exportRequest.id}.${exportRequest.format}`;
      await bucket.remove([path]); // Ignore errors for cleanup

      await supabase
        .from('ultaura_data_export_requests')
        .update({ status: 'expired', download_url: null })
        .eq('id', exportRequest.id);
    }

    logger.info({ count: failedExports.length }, 'Cleaned up old failed exports');
  }
}

async function processPendingExportRequests(): Promise<void> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('ultaura_data_export_requests')
    .select('id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(EXPORT_BATCH_LIMIT);

  if (error) {
    logger.error({ error }, 'Failed to load pending exports');
    return;
  }

  if (!data || data.length === 0) {
    return;
  }

  logger.info({ count: data.length, workerId: WORKER_ID }, 'Processing pending exports');

  for (const request of data) {
    if (shuttingDown) break;

    // processExportRequest already has optimistic locking
    const result = await processExportRequest(request.id);
    if (!result.success && result.status !== 409) {
      logger.warn({ exportRequestId: request.id, error: result.error }, 'Export processing failed');
    }
  }
}

async function processPendingDeletions(): Promise<void> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('ultaura_pending_recording_deletions')
    .select('*')
    .is('processed_at', null)
    .order('created_at', { ascending: true })
    .limit(FETCH_LIMIT);

  if (error) {
    logger.error({ error }, 'Failed to load pending recording deletions');
    return;
  }

  if (!data || data.length === 0) {
    return;
  }

  // Filter to eligible records (backoff and retry limits)
  const eligible = data.filter((record) => {
    if (record.attempts >= record.max_attempts) {
      // Mark as processed with error
      markProcessed(record.id, {
        processed_at: new Date().toISOString(),
        last_error: record.last_error || 'Max attempts reached',
      }).catch(() => undefined);
      return false;
    }
    return canAttempt(record);
  });

  const batch = eligible.slice(0, BATCH_LIMIT);
  if (batch.length === 0) {
    return;
  }

  logger.info({ count: batch.length, workerId: WORKER_ID }, 'Processing recording deletions');

  for (const record of batch) {
    if (shuttingDown) break;

    const now = new Date().toISOString();
    const nextAttempts = record.attempts + 1;

    try {
      await deleteTwilioRecording(record.recording_sid);

      await supabase
        .from('ultaura_call_sessions')
        .update({
          recording_deleted_at: now,
          recording_deletion_reason: record.reason,
        })
        .eq('recording_sid', record.recording_sid);

      await markProcessed(record.id, {
        attempts: nextAttempts,
        last_attempt_at: now,
        processed_at: now,
        last_error: null,
      });

      logger.info({ recordingSid: record.recording_sid }, 'Recording deleted');
    } catch (error) {
      const errorMessage = (error as { message?: string }).message || 'Unknown error';
      const updates: Record<string, unknown> = {
        attempts: nextAttempts,
        last_attempt_at: now,
        last_error: errorMessage,
      };

      if (nextAttempts >= record.max_attempts) {
        updates.processed_at = now;
        logger.error({ recordingSid: record.recording_sid, error }, 'Recording deletion failed after max attempts');
      } else {
        logger.warn({ recordingSid: record.recording_sid, error }, 'Recording deletion failed; will retry');
      }

      await markProcessed(record.id, updates);
    }
  }
}

async function markProcessed(id: string, updates: Record<string, unknown>): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('ultaura_pending_recording_deletions')
    .update(updates)
    .eq('id', id);

  if (error) {
    logger.error({ error, id }, 'Failed to update pending recording deletion');
  }
}

async function deleteTwilioRecording(recordingSid: string): Promise<void> {
  const client = getTwilioClient();
  await client.recordings(recordingSid).remove();
}
```

---

## 6. Database Migrations

### 6.1 Complete Migration File

**File: `supabase/migrations/20260120000001_multi_instance_scaling.sql`**

```sql
-- Multi-instance scaling fixes
-- Adds lease rows for weekly summaries and recording deletions

-- Add lease rows for new schedulers
INSERT INTO ultaura_scheduler_leases (id)
VALUES
  ('weekly-summaries'),
  ('recording-deletions')
ON CONFLICT (id) DO NOTHING;

-- Update table comment
COMMENT ON TABLE ultaura_scheduler_leases IS
  'Distributed locking for scheduler coordination. Lease IDs: schedules, reminders, weekly-summaries, recording-deletions';

-- Verify all expected lease rows exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ultaura_scheduler_leases WHERE id = 'schedules') THEN
    INSERT INTO ultaura_scheduler_leases (id) VALUES ('schedules');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM ultaura_scheduler_leases WHERE id = 'reminders') THEN
    INSERT INTO ultaura_scheduler_leases (id) VALUES ('reminders');
  END IF;
END $$;
```

### 6.2 Migration Rollback

**File: `supabase/migrations/20260120000001_multi_instance_scaling_rollback.sql`**

```sql
-- Rollback: Remove new lease rows
-- Note: This is safe to run - the scheduler code will handle missing rows gracefully

DELETE FROM ultaura_scheduler_leases
WHERE id IN ('weekly-summaries', 'recording-deletions');

-- Restore original comment
COMMENT ON TABLE ultaura_scheduler_leases IS
  'Distributed locking for scheduler coordination. Prevents multiple telephony instances from processing schedules/reminders simultaneously.';
```

---

## 7. Metrics and Monitoring

### 7.1 Prometheus Metrics

Add metrics to track scheduler health:

**File: `telephony/src/utils/metrics.ts`**

```typescript
import { Counter, Gauge, Histogram, Registry } from 'prom-client';

export const registry = new Registry();

// Lease metrics
export const leaseAcquisitions = new Counter({
  name: 'ultaura_scheduler_lease_acquisitions_total',
  help: 'Total number of scheduler lease acquisition attempts',
  labelNames: ['lease_id', 'worker_id', 'result'],
  registers: [registry],
});

export const leaseHoldDuration = new Histogram({
  name: 'ultaura_scheduler_lease_hold_duration_seconds',
  help: 'Duration a worker held a scheduler lease',
  labelNames: ['lease_id'],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600],
  registers: [registry],
});

export const activeLeases = new Gauge({
  name: 'ultaura_scheduler_active_leases',
  help: 'Number of leases currently held by this worker',
  labelNames: ['lease_id'],
  registers: [registry],
});

// Call metrics
export const activeWebSocketConnections = new Gauge({
  name: 'ultaura_websocket_active_connections',
  help: 'Number of active WebSocket connections',
  registers: [registry],
});

export const activeCalls = new Gauge({
  name: 'ultaura_active_calls',
  help: 'Number of active calls on this pod',
  registers: [registry],
});

export const callDrainWaitDuration = new Histogram({
  name: 'ultaura_call_drain_wait_seconds',
  help: 'Time spent waiting for calls to drain during shutdown',
  buckets: [1, 5, 10, 15, 20, 25, 30],
  registers: [registry],
});

// Processing metrics
export const weeklySummariesProcessed = new Counter({
  name: 'ultaura_weekly_summaries_processed_total',
  help: 'Total weekly summaries processed',
  labelNames: ['result'],
  registers: [registry],
});

export const recordingDeletionsProcessed = new Counter({
  name: 'ultaura_recording_deletions_processed_total',
  help: 'Total recording deletions processed',
  labelNames: ['result'],
  registers: [registry],
});
```

### 7.2 Metrics Endpoint

**Add to `telephony/src/server.ts`:**

```typescript
import { register } from 'prom-client';
import { registry } from './utils/metrics.js';

// Metrics endpoint
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', registry.contentType);
  res.send(await registry.metrics());
});
```

### 7.3 Alerting Rules

**File: `kubernetes/prometheus-rules.yaml`**

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: ultaura-telephony-alerts
  namespace: monitoring
spec:
  groups:
    - name: ultaura-telephony
      rules:
        # No instance holding a lease for too long
        - alert: SchedulerLeaseStuck
          expr: |
            increase(ultaura_scheduler_lease_hold_duration_seconds_bucket{le="600"}[30m]) == 0
            and on (lease_id) ultaura_scheduler_active_leases > 0
          for: 10m
          labels:
            severity: warning
          annotations:
            summary: "Scheduler lease {{ $labels.lease_id }} may be stuck"
            description: "Lease has been held for over 10 minutes without release"

        # Failed lease acquisitions
        - alert: SchedulerLeaseFailures
          expr: |
            sum(rate(ultaura_scheduler_lease_acquisitions_total{result="error"}[5m])) > 0.5
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: "High rate of scheduler lease acquisition failures"

        # Calls not draining during shutdown
        - alert: CallDrainTimeout
          expr: |
            histogram_quantile(0.99, ultaura_call_drain_wait_seconds_bucket) > 25
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "Calls taking too long to drain during shutdown"

        # Duplicate processing detection (via logging rate)
        - alert: PossibleDuplicateProcessing
          expr: |
            sum(rate(ultaura_weekly_summaries_processed_total[5m])) by (result)
            > sum(rate(ultaura_weekly_summaries_processed_total[5m])) * 1.5
          for: 10m
          labels:
            severity: warning
          annotations:
            summary: "Possible duplicate weekly summary processing detected"
```

### 7.4 Grafana Dashboard

Key panels to include:
- Lease acquisition success/failure rate by lease_id
- Average lease hold duration
- Active calls per pod
- WebSocket connections per pod
- Call drain wait time histogram
- Weekly summaries processed rate
- Recording deletions processed rate

---

## 8. Testing Strategy

### 8.1 Unit Tests

**File: `telephony/src/scheduler/__tests__/weekly-summary-scheduler.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Weekly Summary Scheduler', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should not process when lease is held by another worker', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValueOnce({ data: false, error: null }), // lease not acquired
    };

    // ... test implementation
  });

  it('should process lines when lease is acquired', async () => {
    const mockSupabase = {
      rpc: vi.fn()
        .mockResolvedValueOnce({ data: true, error: null }) // lease acquired
        .mockResolvedValueOnce({ data: true, error: null }), // heartbeat
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [{ id: 'line-1' }], error: null }),
      }),
    };

    // ... test implementation
  });

  it('should release lease on shutdown', async () => {
    // ... test implementation
  });

  it('should handle database connection failures gracefully', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockRejectedValue(new Error('Connection failed')),
    };

    // Should not throw, should log error
    // ... test implementation
  });
});
```

### 8.2 Integration Tests

**File: `telephony/src/__tests__/integration/multi-instance.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

describe('Multi-instance Integration', () => {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  describe('Lease Coordination', () => {
    it('should prevent concurrent lease acquisition', async () => {
      // Simulate two workers trying to acquire the same lease
      const worker1 = 'test-worker-1';
      const worker2 = 'test-worker-2';
      const leaseId = 'test-lease';

      // Clean up any existing test lease
      await supabase
        .from('ultaura_scheduler_leases')
        .upsert({ id: leaseId, held_by: null, expires_at: null });

      // Both workers try to acquire simultaneously
      const [result1, result2] = await Promise.all([
        supabase.rpc('try_acquire_scheduler_lease', {
          p_lease_id: leaseId,
          p_worker_id: worker1,
          p_lease_duration_seconds: 60,
        }),
        supabase.rpc('try_acquire_scheduler_lease', {
          p_lease_id: leaseId,
          p_worker_id: worker2,
          p_lease_duration_seconds: 60,
        }),
      ]);

      // Exactly one should succeed
      expect([result1.data, result2.data].filter(Boolean).length).toBe(1);

      // Clean up
      await supabase
        .from('ultaura_scheduler_leases')
        .delete()
        .eq('id', leaseId);
    });

    it('should allow lease takeover after expiration', async () => {
      const worker1 = 'test-worker-1';
      const worker2 = 'test-worker-2';
      const leaseId = 'test-lease-expire';

      // Set up expired lease
      await supabase.from('ultaura_scheduler_leases').upsert({
        id: leaseId,
        held_by: worker1,
        expires_at: new Date(Date.now() - 1000).toISOString(), // Expired
      });

      // Worker 2 should be able to take over
      const { data } = await supabase.rpc('try_acquire_scheduler_lease', {
        p_lease_id: leaseId,
        p_worker_id: worker2,
        p_lease_duration_seconds: 60,
      });

      expect(data).toBe(true);

      // Verify worker2 holds the lease
      const { data: lease } = await supabase
        .from('ultaura_scheduler_leases')
        .select('held_by')
        .eq('id', leaseId)
        .single();

      expect(lease?.held_by).toBe(worker2);

      // Clean up
      await supabase
        .from('ultaura_scheduler_leases')
        .delete()
        .eq('id', leaseId);
    });
  });
});
```

### 8.3 Local Multi-Pod Simulation

**File: `docker-compose.multi-pod.yaml`**

```yaml
version: '3.8'
services:
  telephony-1:
    build: ./telephony
    environment:
      - HOSTNAME=telephony-1
      - NODE_ENV=development
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
    ports:
      - "3001:3001"

  telephony-2:
    build: ./telephony
    environment:
      - HOSTNAME=telephony-2
      - NODE_ENV=development
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
    ports:
      - "3002:3001"

  telephony-3:
    build: ./telephony
    environment:
      - HOSTNAME=telephony-3
      - NODE_ENV=development
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
    ports:
      - "3003:3001"

  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx-test.conf:/etc/nginx/nginx.conf
    ports:
      - "8080:80"
    depends_on:
      - telephony-1
      - telephony-2
      - telephony-3
```

### 8.4 Staging Environment Tests

1. Deploy to staging with 4 pods
2. Monitor logs for:
   - Only one pod acquiring each lease
   - Lease handoff on pod restart
   - No duplicate processing messages
3. Trigger test weekly summaries and verify single delivery
4. Trigger test recording deletions and verify single Twilio call
5. Simulate pod failure during active call and verify apology TTS

---

## 9. Rollback Procedures

### 9.1 WebSocket Sticky Sessions Rollback

1. Remove the Ingress annotations:
   ```bash
   kubectl annotate ingress ultaura-telephony-ws nginx.ingress.kubernetes.io/affinity- nginx.ingress.kubernetes.io/upstream-hash-by-
   ```

2. Or replace with the previous Ingress configuration

3. Calls may experience disconnections during transition; monitor for errors

### 9.2 Scheduler Rollback

1. **Immediate (code rollback):**
   ```bash
   kubectl rollout undo deployment/ultaura-telephony
   ```

2. **Database rollback (only if needed):**
   ```bash
   npx supabase db execute --sql-file supabase/migrations/20260120000001_multi_instance_scaling_rollback.sql
   ```

3. The old code will work without the new lease rows (it simply won't coordinate)

### 9.3 Rollback Verification

- Monitor `/health` endpoint for all pods
- Check logs for scheduler errors
- Verify calls are connecting successfully
- Check for duplicate email alerts

---

## 10. Operational Runbook

### 10.1 Common Issues and Resolution

| Issue | Symptoms | Resolution |
|-------|----------|------------|
| Lease stuck | One pod holding lease > 10 min, others logging "held by another worker" | Manually clear: `UPDATE ultaura_scheduler_leases SET held_by = NULL, expires_at = NULL WHERE id = 'lease-id'` |
| Duplicate processing | Multiple pods logging same line ID processing | Check if migration ran; verify lease rows exist |
| Calls dropping on deploy | Calls ending abruptly during rollout | Increase `terminationGracePeriodSeconds`; verify `preStop` hook |
| WebSocket not sticky | Same call hitting different pods | Verify Ingress annotations; check `callSessionId` in URL |
| DB connection issues | Lease acquisition errors in logs | Check Supabase status; verify connection pool settings |

### 10.2 Health Check Commands

```bash
# Check which worker holds each lease
kubectl exec -it deployment/ultaura-telephony -- \
  curl -s localhost:3001/internal/scheduler-status

# View active calls per pod
kubectl exec -it deployment/ultaura-telephony -- \
  curl -s localhost:3001/internal/active-calls

# Check lease table directly
psql $DATABASE_URL -c "SELECT * FROM ultaura_scheduler_leases;"

# Force release stuck lease (use with caution)
psql $DATABASE_URL -c "UPDATE ultaura_scheduler_leases SET held_by = NULL, expires_at = NULL WHERE id = 'weekly-summaries';"
```

### 10.3 Scaling Operations

**Scale up:**
```bash
kubectl scale deployment ultaura-telephony --replicas=10
# New pods will automatically compete for leases
```

**Scale down:**
```bash
kubectl scale deployment ultaura-telephony --replicas=4
# SIGTERM triggers graceful shutdown with lease release
```

**Emergency pod restart:**
```bash
kubectl delete pod telephony-xyz --grace-period=60
# Allows 60 seconds for call draining
```

---

## 11. Implementation Checklist

### Phase 1: Database Migration (Day 1)
- [ ] Create migration file `20260120000001_multi_instance_scaling.sql`
- [ ] Test migration in staging
- [ ] Deploy migration to production (off-peak)
- [ ] Verify lease rows exist: `SELECT * FROM ultaura_scheduler_leases`

### Phase 2: Weekly Summary Scheduler (Day 2-3)
- [ ] Update `weekly-summary-scheduler.ts` with lease coordination
- [ ] Add unit tests
- [ ] Test locally with docker-compose multi-pod setup
- [ ] Deploy to staging
- [ ] Monitor logs for correct lease behavior
- [ ] Deploy to production

### Phase 3: Recording Deletion Scheduler (Day 4-5)
- [ ] Update `recording-deletion.ts` with lease coordination
- [ ] Add unit tests
- [ ] Test locally with docker-compose
- [ ] Deploy to staging
- [ ] Monitor Twilio API call counts
- [ ] Deploy to production

### Phase 4: WebSocket Sticky Sessions (Day 6-8)
- [ ] Create Kubernetes Ingress configuration
- [ ] Update server.ts with graceful shutdown draining
- [ ] Update media-stream.ts to track active calls
- [ ] Add metrics for active connections
- [ ] Test in staging with simulated pod failures
- [ ] Deploy to production during low-traffic period
- [ ] Monitor call completion rates

### Phase 5: Monitoring and Documentation (Day 9-10)
- [ ] Deploy Prometheus metrics
- [ ] Create Grafana dashboard
- [ ] Configure alerting rules
- [ ] Update CLAUDE.md with new architecture details
- [ ] Conduct team training on runbook procedures

### Verification Gates
- [ ] No duplicate weekly summary emails in 48-hour window
- [ ] Twilio recording deletion API calls match expected count
- [ ] Call completion rate unchanged or improved
- [ ] Zero calls dropped during pod rollout
- [ ] All metrics reporting correctly

---

## Appendix A: Reference File Locations

| Purpose | File Path |
|---------|-----------|
| Call scheduler (reference) | `telephony/src/scheduler/call-scheduler.ts` |
| Weekly summary scheduler | `telephony/src/scheduler/weekly-summary-scheduler.ts` |
| Recording deletion scheduler | `telephony/src/scheduler/recording-deletion.ts` |
| WebSocket handler | `telephony/src/websocket/media-stream.ts` |
| Bridge registry | `telephony/src/websocket/grok-bridge-registry.ts` |
| Server entry point | `telephony/src/server.ts` |
| Lease table migration | `supabase/migrations/20260104000001_scheduler_leases.sql` |
| Lease RPC functions | `supabase/migrations/20260104000004_scheduler_rpc_functions.sql` |
| Redis client | `telephony/src/services/redis.ts` |
| Export service | `telephony/src/services/exports.ts` |

---

## Appendix B: Environment Variables

No new environment variables required. Existing variables used:

| Variable | Purpose |
|----------|---------|
| `HOSTNAME` | Worker ID generation (set automatically in Kubernetes) |
| `SCHEDULER_DISABLED` | Disable all schedulers |
| `RECORDING_DELETION_DISABLED` | Disable recording deletion scheduler |

---

*End of Specification*
