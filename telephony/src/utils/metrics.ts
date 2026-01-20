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

// Voice product metrics
export const voiceTimeToFirstAudioMs = new Histogram({
  name: 'ultaura_voice_time_to_first_audio_ms',
  help: 'Time from Twilio media stream start to first Grok audio chunk (ms)',
  labelNames: ['direction', 'isReminderCall'],
  buckets: [50, 100, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000, 8000, 12000],
  registers: [registry],
});

export const voiceBargeInTotal = new Counter({
  name: 'ultaura_voice_barge_in_total',
  help: 'Total number of barge-in events during calls',
  registers: [registry],
});

export type VoiceDisconnectReason =
  | 'ws_close'
  | 'twilio_failed'
  | 'twilio_completed'
  | 'grok_error'
  | 'grok_close'
  | 'pod_failure'
  | 'other';

export const voiceDisconnectTotal = new Counter({
  name: 'ultaura_voice_disconnect_total',
  help: 'Total number of call disconnects (deduped per call session)',
  labelNames: ['reason'],
  registers: [registry],
});

export const voiceToolCallsTotal = new Counter({
  name: 'ultaura_voice_tool_calls_total',
  help: 'Total Grok tool calls by tool name',
  labelNames: ['toolName'],
  registers: [registry],
});

export const voiceToolErrorsTotal = new Counter({
  name: 'ultaura_voice_tool_errors_total',
  help: 'Total Grok tool call failures by tool name',
  labelNames: ['toolName'],
  registers: [registry],
});

// Scheduler outcome metrics
export const scheduleOutcomesTotal = new Counter({
  name: 'ultaura_scheduler_schedule_outcomes_total',
  help: 'Total schedule processing outcomes',
  labelNames: ['outcome'],
  registers: [registry],
});

export const reminderOutcomesTotal = new Counter({
  name: 'ultaura_scheduler_reminder_outcomes_total',
  help: 'Total reminder processing outcomes',
  labelNames: ['outcome'],
  registers: [registry],
});

activeWebSocketConnections.set(0);
activeCalls.set(0);

const VOICE_DISCONNECT_TTL_MS = 6 * 60 * 60 * 1000;
const voiceDisconnectRegistry = new Map<string, number>();

function pruneVoiceDisconnectRegistry(now: number): void {
  for (const [sessionId, timestamp] of voiceDisconnectRegistry.entries()) {
    if (now - timestamp > VOICE_DISCONNECT_TTL_MS) {
      voiceDisconnectRegistry.delete(sessionId);
    }
  }
}

export function recordVoiceDisconnect(callSessionId: string, reason: VoiceDisconnectReason): boolean {
  if (!callSessionId) {
    return false;
  }

  const now = Date.now();
  pruneVoiceDisconnectRegistry(now);

  if (voiceDisconnectRegistry.has(callSessionId)) {
    return false;
  }

  voiceDisconnectRegistry.set(callSessionId, now);
  voiceDisconnectTotal.inc({ reason });
  return true;
}
