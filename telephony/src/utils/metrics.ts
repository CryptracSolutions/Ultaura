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

activeWebSocketConnections.set(0);
activeCalls.set(0);
