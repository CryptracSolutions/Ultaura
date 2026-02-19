import { afterEach, describe, expect, it } from 'vitest';
import { getEnforceMfa } from '~/app/admin/utils/is-user-super-admin';

const env = process.env as Record<string, string | undefined>;
const originalAdminEnforceMfa = process.env.ADMIN_ENFORCE_MFA;
const originalNodeEnv = process.env.NODE_ENV;

function setEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete env[name];
    return;
  }

  env[name] = value;
}

function evaluateEnforcement(
  adminEnforceMfa: string | undefined,
  nodeEnv: string | undefined,
) {
  setEnv('ADMIN_ENFORCE_MFA', adminEnforceMfa);
  setEnv('NODE_ENV', nodeEnv);

  return getEnforceMfa();
}

afterEach(() => {
  setEnv('ADMIN_ENFORCE_MFA', originalAdminEnforceMfa);
  setEnv('NODE_ENV', originalNodeEnv);
});

describe('MFA enforcement via ADMIN_ENFORCE_MFA', () => {
  it.each(['true', 'TRUE', '1', 'yes', 'YES', 'on', 'On'])(
    'returns true for truthy override "%s"',
    (value) => {
      expect(evaluateEnforcement(value, 'development')).toBe(true);
    },
  );

  it.each(['false', 'FALSE', '0', 'no', 'NO', 'off', 'Off'])(
    'returns false for falsy override "%s"',
    (value) => {
      expect(evaluateEnforcement(value, 'production')).toBe(false);
    },
  );

  it('handles surrounding whitespace in override values', () => {
    expect(evaluateEnforcement('  yes  ', 'development')).toBe(true);
    expect(evaluateEnforcement('  off  ', 'production')).toBe(false);
  });

  it('defaults to production behavior when override is unknown', () => {
    expect(evaluateEnforcement('maybe', 'production')).toBe(true);
    expect(evaluateEnforcement('maybe', 'development')).toBe(false);
  });

  it('defaults to production behavior when override is blank', () => {
    expect(evaluateEnforcement('', 'production')).toBe(true);
    expect(evaluateEnforcement('   ', 'development')).toBe(false);
  });

  it('defaults to true in production when override is not set', () => {
    expect(evaluateEnforcement(undefined, 'production')).toBe(true);
  });

  it('defaults to false in development when override is not set', () => {
    expect(evaluateEnforcement(undefined, 'development')).toBe(false);
  });

  it('defaults to false in test when override is not set', () => {
    expect(evaluateEnforcement(undefined, 'test')).toBe(false);
  });

  it('override takes precedence over NODE_ENV', () => {
    expect(evaluateEnforcement('false', 'production')).toBe(false);
    expect(evaluateEnforcement('true', 'development')).toBe(true);
  });
});
