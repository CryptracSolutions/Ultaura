import { logger } from '../utils/logger.js';
import { getSupabaseClient } from '../utils/supabase.js';
import { generateHandoffSummary, HANDOFF_FALLBACK_SUMMARY } from './handoff-summary.js';
import type { HandoffSummary } from './handoff-summary.js';
import { recordCallEvent } from './call-session.js';
import {
  HANDOFF_PREWARM_TIMEOUT_MS,
  HANDOFF_RESPONSE_DRAIN_MS,
  HANDOFF_MAX_RETRIES,
} from '../utils/constants.js';
import { sessionHandoffsTotal, sessionHandoffDurationMs } from '../utils/metrics.js';
import { registerGrokBridge } from '../websocket/grok-bridge-registry.js';
import type { GrokBridge } from '../websocket/grok-bridge.js';
import { startSpan, SpanStatusCode } from '../observability/tracing.js';

export interface HandoffState {
  handoffNumber: number;
  summary: HandoffSummary | null;
  prewarmedBridge: GrokBridge | null;
  phase: 'idle' | 'summarizing' | 'summary_ready' | 'prewarming' | 'executing' | 'complete' | 'failed';
  timers: NodeJS.Timeout[];
}

export interface HandoffCallbacks {
  playBridgePhrase: () => Promise<void>;
  reconnectStream: () => Promise<void>;
  closeOldBridge: (bridge: GrokBridge) => void;
  getOldBridge: () => GrokBridge | null;
  isResponseInFlight: () => boolean;
  cancelResponse: () => void;
  setKeepBridgeAlive: (value: boolean) => void;
}

export function createHandoffState(): HandoffState {
  return {
    handoffNumber: 0,
    summary: null,
    prewarmedBridge: null,
    phase: 'idle',
    timers: [],
  };
}

export function clearHandoffTimers(state: HandoffState): void {
  for (const timer of state.timers) {
    clearTimeout(timer);
  }
  state.timers = [];
}

export async function startSummaryGeneration(
  callSessionId: string,
  state: HandoffState
): Promise<void> {
  if (state.phase !== 'idle') {
    logger.warn({ callSessionId, currentPhase: state.phase }, 'Skipping summary generation — wrong phase');
    return;
  }

  state.phase = 'summarizing';
  logger.info({ callSessionId, handoffNumber: state.handoffNumber + 1 }, 'Starting handoff summary generation');

  try {
    state.summary = await generateHandoffSummary(callSessionId);
    state.phase = 'summary_ready';
    logger.info(
      {
        callSessionId,
        source: state.summary.source,
        turnCount: state.summary.turnCount,
        summaryLength: state.summary.text.length,
      },
      'Handoff summary ready'
    );
  } catch (error) {
    logger.error(
      { callSessionId, error: error instanceof Error ? error.message : String(error) },
      'Handoff summary generation failed'
    );
    state.summary = {
      text: HANDOFF_FALLBACK_SUMMARY,
      source: 'fallback',
      generatedAt: Date.now(),
      turnCount: 0,
    };
  }
}

export async function startPreWarm(
  callSessionId: string,
  currentBridge: GrokBridge,
  state: HandoffState
): Promise<void> {
  if (state.phase !== 'summarizing' && state.phase !== 'summary_ready') {
    if (!state.summary) {
      logger.warn({ callSessionId, currentPhase: state.phase }, 'Skipping pre-warm — no summary available');
      return;
    }
  }

  state.phase = 'prewarming';
  const summaryText = state.summary?.text || HANDOFF_FALLBACK_SUMMARY;

  logger.info({ callSessionId, handoffNumber: state.handoffNumber + 1 }, 'Pre-warming new Grok bridge');

  let retries = 0;
  while (retries <= HANDOFF_MAX_RETRIES) {
    try {
      const newBridge = currentBridge.cloneForHandoff(summaryText);
      await newBridge.connect(HANDOFF_PREWARM_TIMEOUT_MS);
      state.prewarmedBridge = newBridge;

      logger.info(
        { callSessionId, retries, handoffNumber: state.handoffNumber + 1 },
        'New Grok bridge pre-warmed successfully'
      );
      return;
    } catch (error) {
      retries++;
      logger.warn(
        {
          callSessionId,
          retries,
          error: error instanceof Error ? error.message : String(error),
        },
        'Pre-warm attempt failed'
      );
    }
  }

  // All retries exhausted
  state.phase = 'failed';
  sessionHandoffsTotal.inc({ status: 'failed' });
  logger.error({ callSessionId, handoffNumber: state.handoffNumber + 1 }, 'Pre-warm failed after all retries');
}

async function recordHandoffToDb(
  callSessionId: string,
  handoffNumber: number,
  status: 'success' | 'failed' | 'retried',
  durationMs: number,
  summary: HandoffSummary | null,
  prewarmDurationMs?: number,
  errorMessage?: string
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('ultaura_session_handoffs').insert({
      call_session_id: callSessionId,
      handoff_number: handoffNumber,
      status,
      duration_ms: durationMs,
      summary_source: summary?.source ?? null,
      summary_length: summary?.turnCount ?? null,
      prewarm_duration_ms: prewarmDurationMs ?? null,
      error_message: errorMessage ?? null,
    });

    if (error) {
      logger.warn(
        { callSessionId, handoffNumber, error: error.message },
        'Failed to record handoff to DB'
      );
    }
  } catch (error) {
    logger.warn(
      { callSessionId, handoffNumber, error: error instanceof Error ? error.message : String(error) },
      'Failed to record handoff to DB (exception)'
    );
  }
}

export async function executeHandoff(
  callSessionId: string,
  state: HandoffState,
  callbacks: HandoffCallbacks
): Promise<boolean> {
  if (state.phase === 'failed' || state.phase === 'complete') {
    logger.warn({ callSessionId, currentPhase: state.phase }, 'Skipping handoff execution — terminal phase');
    return false;
  }

  // Verify pre-warmed bridge exists and is still connected
  if (!state.prewarmedBridge) {
    logger.warn({ callSessionId }, 'Skipping handoff execution — no pre-warmed bridge');
    state.phase = 'failed';
    sessionHandoffsTotal.inc({ status: 'failed' });
    return false;
  }

  if (!state.prewarmedBridge.isConnectedToGrok()) {
    logger.warn({ callSessionId }, 'Skipping handoff execution — pre-warmed bridge disconnected');
    state.phase = 'failed';
    sessionHandoffsTotal.inc({ status: 'failed' });
    return false;
  }

  state.phase = 'executing';
  state.handoffNumber++;
  const startTime = Date.now();

  const span = startSpan('handoff.execute');
  span?.setAttribute('handoff.number', state.handoffNumber);
  span?.setAttribute('handoff.call_session_id', callSessionId);

  logger.info({ callSessionId, handoffNumber: state.handoffNumber }, 'Executing session handoff');

  void recordCallEvent(callSessionId, 'state_change', {
    event: 'handoff_start',
    handoffNumber: state.handoffNumber,
    summarySource: state.summary?.source,
  }).catch(() => {});

  let bridgePhrasePlayed = false;
  let retries = 0;
  while (retries <= HANDOFF_MAX_RETRIES) {
    try {
      // Step a: Wait for in-flight response to finish (max HANDOFF_RESPONSE_DRAIN_MS)
      if (callbacks.isResponseInFlight()) {
        logger.info({ callSessionId }, 'Waiting for in-flight response to drain');
        const drainStart = Date.now();
        while (
          callbacks.isResponseInFlight() &&
          Date.now() - drainStart < HANDOFF_RESPONSE_DRAIN_MS
        ) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        // Step b: Cancel if still going
        if (callbacks.isResponseInFlight()) {
          logger.info({ callSessionId }, 'Cancelling in-flight response for handoff');
          callbacks.cancelResponse();
        }
      }

      // Step c: Set keepBridgeAlive to prevent cleanup during swap
      callbacks.setKeepBridgeAlive(true);

      // Step d: Register new bridge in registry (replaces old)
      registerGrokBridge(callSessionId, state.prewarmedBridge);

      // Step e: Play bridge phrase via Twilio TTS (skip on retry — idempotent)
      if (!bridgePhrasePlayed) {
        await callbacks.playBridgePhrase();
        bridgePhrasePlayed = true;
      }

      // Step f: Reconnect media stream — triggers new Twilio WS
      await callbacks.reconnectStream();

      // Step g: Close old bridge's Grok WebSocket
      const oldBridge = callbacks.getOldBridge();
      if (oldBridge) {
        callbacks.closeOldBridge(oldBridge);
      }

      // Record success
      const durationMs = Date.now() - startTime;
      state.phase = 'complete';

      sessionHandoffsTotal.inc({ status: retries > 0 ? 'retried' : 'success' });
      sessionHandoffDurationMs.observe(durationMs);
      span?.setAttribute('handoff.duration_ms', durationMs);
      span?.setAttribute('handoff.status', retries > 0 ? 'retried' : 'success');
      span?.setStatus({ code: SpanStatusCode.OK });
      span?.end();

      void recordHandoffToDb(
        callSessionId,
        state.handoffNumber,
        retries > 0 ? 'retried' : 'success',
        durationMs,
        state.summary
      );

      void recordCallEvent(callSessionId, 'state_change', {
        event: 'handoff_success',
        handoffNumber: state.handoffNumber,
        durationMs,
        summarySource: state.summary?.source,
      }).catch(() => {});

      logger.info(
        {
          callSessionId,
          handoffNumber: state.handoffNumber,
          durationMs,
          summarySource: state.summary?.source,
        },
        'Session handoff completed successfully'
      );

      return true;
    } catch (error) {
      retries++;
      logger.error(
        {
          callSessionId,
          retries,
          handoffNumber: state.handoffNumber,
          error: error instanceof Error ? error.message : String(error),
        },
        'Handoff execution attempt failed'
      );

      if (retries > HANDOFF_MAX_RETRIES) {
        break;
      }
    }
  }

  // All retries exhausted
  const durationMs = Date.now() - startTime;
  state.phase = 'failed';
  callbacks.setKeepBridgeAlive(false);

  sessionHandoffsTotal.inc({ status: 'failed' });
  sessionHandoffDurationMs.observe(durationMs);
  span?.setAttribute('handoff.duration_ms', durationMs);
  span?.setAttribute('handoff.status', 'failed');
  span?.setStatus({ code: SpanStatusCode.ERROR, message: 'All handoff retries exhausted' });
  span?.end();

  void recordHandoffToDb(
    callSessionId,
    state.handoffNumber,
    'failed',
    durationMs,
    state.summary,
    undefined,
    'All handoff retries exhausted'
  );

  void recordCallEvent(callSessionId, 'error', {
    errorType: 'handoff_failed',
    handoffNumber: state.handoffNumber,
    durationMs,
  }).catch(() => {});

  logger.error(
    { callSessionId, handoffNumber: state.handoffNumber, durationMs },
    'Session handoff failed after all retries'
  );

  return false;
}

export function resetForNextHandoff(state: HandoffState): void {
  state.summary = null;
  state.prewarmedBridge = null;
  state.phase = 'idle';
  // handoffNumber is preserved — it's cumulative
  // timers are re-scheduled by the caller
}
