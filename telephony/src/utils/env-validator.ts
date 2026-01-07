import { IANAZone } from 'luxon';

interface EnvVariable {
  name: string;
  required: boolean;
  format?: 'hex64' | 'url' | 'wss' | 'boolean' | 'number' | 'timezone' | 'min32' | 'decimal';
  default?: string;
}

const ULTAURA_ENV_VARS: EnvVariable[] = [
  // Required - Critical
  { name: 'ULTAURA_ENCRYPTION_KEY', required: true, format: 'hex64' },
  { name: 'ULTAURA_INTERNAL_API_SECRET', required: true, format: 'min32' },
  { name: 'ULTAURA_BACKEND_URL', required: true, format: 'url' },
  { name: 'ULTAURA_PUBLIC_URL', required: true, format: 'url' },
  { name: 'ULTAURA_WEBSOCKET_URL', required: true, format: 'wss' },

  // Required - External Services
  { name: 'XAI_API_KEY', required: true },
  { name: 'TWILIO_ACCOUNT_SID', required: true },
  { name: 'TWILIO_AUTH_TOKEN', required: true },
  { name: 'TWILIO_PHONE_NUMBER', required: true },
  { name: 'TWILIO_VERIFY_SERVICE_SID', required: true },
  { name: 'SUPABASE_URL', required: true, format: 'url' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', required: true },

  // Optional with defaults
  { name: 'PORT', required: false, format: 'number', default: '3001' },
  { name: 'ULTAURA_DEBUG', required: false, format: 'boolean', default: 'false' },
  { name: 'ULTAURA_DEFAULT_TIMEZONE', required: false, format: 'timezone', default: 'America/Los_Angeles' },
  { name: 'ULTAURA_ENABLE_RECORDING', required: false, format: 'boolean', default: 'false' },
  { name: 'XAI_REALTIME_URL', required: false, format: 'wss', default: 'wss://api.x.ai/v1/realtime' },
  { name: 'TWILIO_AMD_ENABLED', required: false, format: 'boolean', default: 'true' },

  // Optional - Redis (rate limiting)
  { name: 'UPSTASH_REDIS_REST_URL', required: false, format: 'url' },
  { name: 'UPSTASH_REDIS_REST_TOKEN', required: false },

  // Optional - Rate limit overrides
  { name: 'RATE_LIMIT_VERIFY_SEND_PER_PHONE', required: false, format: 'number', default: '5' },
  { name: 'RATE_LIMIT_VERIFY_CHECK_PER_PHONE', required: false, format: 'number', default: '10' },
  { name: 'RATE_LIMIT_PER_IP', required: false, format: 'number', default: '20' },
  { name: 'RATE_LIMIT_PER_ACCOUNT', required: false, format: 'number', default: '10' },
  { name: 'RATE_LIMIT_SMS_PER_ACCOUNT', required: false, format: 'number', default: '15' },
  { name: 'RATE_LIMIT_REMINDERS_PER_SESSION', required: false, format: 'number', default: '5' },

  // Optional - Anomaly thresholds
  { name: 'ANOMALY_COST_THRESHOLD', required: false, format: 'decimal', default: '10.00' },
  { name: 'ANOMALY_REPEATED_HITS_THRESHOLD', required: false, format: 'number', default: '3' },
  { name: 'ANOMALY_ENUMERATION_THRESHOLD', required: false, format: 'number', default: '10' },
];

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function validateEnvVariables(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const variable of ULTAURA_ENV_VARS) {
    const value = process.env[variable.name];

    if (variable.required && !value) {
      if (variable.name === 'ULTAURA_BACKEND_URL' && !isProduction()) {
        continue;
      }
      errors.push(`Missing required environment variable: ${variable.name}`);
      continue;
    }

    if (!value) {
      continue;
    }

    if (variable.format) {
      const formatError = validateFormat(variable.name, value, variable.format);
      if (formatError) {
        errors.push(formatError);
        continue;
      }

      const warning = validateWarning(variable.name, value, variable.format);
      if (warning) {
        warnings.push(warning);
      }
    }
  }

  if (errors.length > 0) {
    console.error('\n========================================');
    console.error('ENVIRONMENT VALIDATION FAILED');
    console.error('========================================\n');
    errors.forEach((err) => console.error(`  - ${err}`));
    console.error('\n');
    process.exit(1);
  }

  if (warnings.length > 0) {
    warnings.forEach((warn) => console.warn(`[ENV WARNING] ${warn}`));
  }
}

function validateFormat(name: string, value: string, format: EnvVariable['format']): string | null {
  const production = isProduction();

  switch (format) {
    case 'hex64':
      if (!/^[0-9a-fA-F]{64}$/.test(value)) {
        return `${name} must be exactly 64 hexadecimal characters. Got ${value.length} chars.`;
      }
      break;
    case 'min32':
      if (value.length < 32) {
        return `${name} must be at least 32 characters.`;
      }
      break;
    case 'url':
      if (production && !value.startsWith('https://')) {
        return `${name} must use HTTPS in production.`;
      }
      if (!production && !/^https?:\/\/.+/.test(value)) {
        return `${name} must be a valid URL.`;
      }
      break;
    case 'wss':
      if (production && !value.startsWith('wss://')) {
        return `${name} must use WSS in production.`;
      }
      if (!production && !/^wss?:\/\/.+/.test(value)) {
        return `${name} must be a valid WebSocket URL.`;
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
    case 'decimal':
      if (!/^\d+(\.\d+)?$/.test(value)) {
        return `${name} must be a decimal number. Got: ${value}`;
      }
      break;
    case 'timezone':
      if (!IANAZone.isValidZone(value)) {
        return `${name} must be a valid IANA timezone (e.g., America/New_York). Got: ${value}`;
      }
      break;
  }

  return null;
}

function validateWarning(name: string, value: string, format: EnvVariable['format']): string | null {
  if (!isProduction()) {
    return null;
  }

  if (format !== 'url' && format !== 'wss') {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return `${name} is set to ${parsed.hostname} in production.`;
    }
  } catch {
    return null;
  }

  return null;
}
