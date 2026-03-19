// Shared telephony constants

export const GROK_INITIAL_CONNECT_TIMEOUT_MS = 10000;
export const GROK_RECONNECT_TIMEOUT_MS = 3000;
export const GROK_RECONNECT_MAX_ATTEMPTS = 1;

export const FALLBACK_TTS_WAIT_MS = 3000;

export const VAD_SILENCE_DURATION_MS = 500;
export const VAD_THRESHOLD = 0.5;

export const TRIAL_DAILY_LIMIT_MINUTES = 20;

// Session handoff thresholds (env overrides for testing)
export const HANDOFF_SUMMARY_START_MS =
  Number(process.env.ULTAURA_HANDOFF_SUMMARY_MS) || 25 * 60 * 1000;
export const HANDOFF_PREWARM_START_MS =
  Number(process.env.ULTAURA_HANDOFF_PREWARM_MS) || 26.5 * 60 * 1000;
export const HANDOFF_EXECUTE_MS =
  Number(process.env.ULTAURA_HANDOFF_EXECUTE_MS) || 27 * 60 * 1000;
export const HANDOFF_FORCE_MS =
  Number(process.env.ULTAURA_HANDOFF_FORCE_MS) || 29.5 * 60 * 1000;
export const HANDOFF_PREWARM_TIMEOUT_MS = 8000;
export const HANDOFF_SUMMARY_TIMEOUT_MS = 10000;
export const HANDOFF_RESPONSE_DRAIN_MS = 5000;
export const HANDOFF_MAX_RETRIES = 1;
