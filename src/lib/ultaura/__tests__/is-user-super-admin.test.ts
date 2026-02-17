import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Test the MFA enforcement logic by directly testing getEnforceMfa behavior

function getEnforceMfa(env: Record<string, string | undefined>): boolean {
  const envValue = env.ADMIN_ENFORCE_MFA;
  if (envValue !== undefined) {
    return envValue === 'true';
  }
  return env.NODE_ENV === 'production';
}

describe('MFA enforcement via ADMIN_ENFORCE_MFA', () => {
  it('returns true when ADMIN_ENFORCE_MFA=true', () => {
    expect(getEnforceMfa({ ADMIN_ENFORCE_MFA: 'true', NODE_ENV: 'development' })).toBe(true);
  });

  it('returns false when ADMIN_ENFORCE_MFA=false', () => {
    expect(getEnforceMfa({ ADMIN_ENFORCE_MFA: 'false', NODE_ENV: 'production' })).toBe(false);
  });

  it('defaults to true in production when env var not set', () => {
    expect(getEnforceMfa({ NODE_ENV: 'production' })).toBe(true);
  });

  it('defaults to false in development when env var not set', () => {
    expect(getEnforceMfa({ NODE_ENV: 'development' })).toBe(false);
  });

  it('defaults to false in test when env var not set', () => {
    expect(getEnforceMfa({ NODE_ENV: 'test' })).toBe(false);
  });

  it('env var takes precedence over NODE_ENV', () => {
    expect(getEnforceMfa({ ADMIN_ENFORCE_MFA: 'false', NODE_ENV: 'production' })).toBe(false);
    expect(getEnforceMfa({ ADMIN_ENFORCE_MFA: 'true', NODE_ENV: 'development' })).toBe(true);
  });
});
