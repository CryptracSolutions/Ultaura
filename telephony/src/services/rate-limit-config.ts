const DEFAULTS = {
  verifySendPerPhone: 5,
  verifyCheckPerPhone: 10,
  perIp: 20,
  perAccount: 10,
  smsPerAccount: 15,
  remindersPerSession: 5,
  anomalyCostThreshold: 10.0,
  anomalyRepeatedHitsThreshold: 3,
  anomalyEnumerationThreshold: 10,
};

function getIntEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getFloatEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const RATE_LIMITS = {
  verifySendPerPhone: getIntEnv('RATE_LIMIT_VERIFY_SEND_PER_PHONE', DEFAULTS.verifySendPerPhone),
  verifyCheckPerPhone: getIntEnv('RATE_LIMIT_VERIFY_CHECK_PER_PHONE', DEFAULTS.verifyCheckPerPhone),
  perIp: getIntEnv('RATE_LIMIT_PER_IP', DEFAULTS.perIp),
  perAccount: getIntEnv('RATE_LIMIT_PER_ACCOUNT', DEFAULTS.perAccount),
  smsPerAccount: getIntEnv('RATE_LIMIT_SMS_PER_ACCOUNT', DEFAULTS.smsPerAccount),
  remindersPerSession: getIntEnv('RATE_LIMIT_REMINDERS_PER_SESSION', DEFAULTS.remindersPerSession),
};

export const ANOMALY_THRESHOLDS = {
  costThreshold: getFloatEnv('ANOMALY_COST_THRESHOLD', DEFAULTS.anomalyCostThreshold),
  repeatedHits: getIntEnv('ANOMALY_REPEATED_HITS_THRESHOLD', DEFAULTS.anomalyRepeatedHitsThreshold),
  enumeration: getIntEnv('ANOMALY_ENUMERATION_THRESHOLD', DEFAULTS.anomalyEnumerationThreshold),
};

