import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateEnvVariables } from '../env-validator.js';

const ORIGINAL_ENV = { ...process.env };

function resetEnv(): void {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

function setBaseEnv(overrides: Record<string, string | undefined> = {}): void {
  Object.assign(process.env, {
    ULTAURA_ENCRYPTION_KEY: 'a'.repeat(64),
    ULTAURA_INTERNAL_API_SECRET: 'a'.repeat(32),
    ULTAURA_PUBLIC_URL: 'https://public.example.com',
    ULTAURA_WEBSOCKET_URL: 'wss://public.example.com/twilio/media',
    ULTAURA_STREAM_TOKEN_SECRET: 'a'.repeat(32),
    XAI_API_KEY: 'xai-test',
    TWILIO_ACCOUNT_SID: 'AC00000000000000000000000000000000',
    TWILIO_AUTH_TOKEN: 'test-auth-token',
    TWILIO_PHONE_NUMBER: '+15555550100',
    TWILIO_VERIFY_SERVICE_SID: 'VA00000000000000000000000000000000',
    SUPABASE_URL: 'https://supabase.example.com',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    ULTAURA_SEMANTIC_SEARCH_ENABLED: 'false',
    ...overrides,
  });
}

function stubExit(): void {
  vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`process.exit:${code}`);
  }) as never);
}

describe('validateEnvVariables', () => {
  beforeEach(() => {
    resetEnv();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetEnv();
  });

  it('requires WS security enforce mode in production', () => {
    stubExit();
    setBaseEnv({
      NODE_ENV: 'production',
      ULTAURA_BACKEND_URL: 'https://backend.example.com',
      ULTAURA_WS_SECURITY_MODE: 'audit',
    });

    expect(() => validateEnvVariables()).toThrow('process.exit:1');
  });

  it('blocks TWILIO_MEDIA_IP_ALLOW_UNKNOWN in production', () => {
    stubExit();
    setBaseEnv({
      NODE_ENV: 'production',
      ULTAURA_BACKEND_URL: 'https://backend.example.com',
      ULTAURA_WS_SECURITY_MODE: 'enforce',
      TWILIO_MEDIA_IP_ALLOW_UNKNOWN: 'true',
    });

    expect(() => validateEnvVariables()).toThrow('process.exit:1');
  });

  it('does not require WS security enforce mode outside production', () => {
    stubExit();
    setBaseEnv({
      NODE_ENV: 'test',
      ULTAURA_WS_SECURITY_MODE: 'audit',
    });

    expect(() => validateEnvVariables()).not.toThrow();
  });

  it('accepts ULTAURA_ENCRYPTION_KEY_PREVIOUS when valid hex64', () => {
    stubExit();
    setBaseEnv({
      NODE_ENV: 'test',
      ULTAURA_ENCRYPTION_KEY_PREVIOUS: 'b'.repeat(64),
    });

    expect(() => validateEnvVariables()).not.toThrow();
  });

  it('rejects ULTAURA_ENCRYPTION_KEY_PREVIOUS when not hex64', () => {
    stubExit();
    setBaseEnv({
      NODE_ENV: 'test',
      ULTAURA_ENCRYPTION_KEY_PREVIOUS: 'invalid-key',
    });

    expect(() => validateEnvVariables()).toThrow('process.exit:1');
  });
});
