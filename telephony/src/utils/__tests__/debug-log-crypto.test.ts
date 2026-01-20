import { describe, it, expect } from 'vitest';
import {
  buildDebugLogAAD,
  decryptDebugPayloadWithDek,
  encryptDebugPayloadWithDek,
} from '../debug-log-crypto.js';
import { generateDEK } from '../crypto.js';

describe('debug-log-crypto', () => {
  const accountId = 'test-account-id';
  const sessionId = 'test-session-id';
  const logId = 'test-log-id';

  it('encrypts and decrypts payload correctly with WithDek helpers', () => {
    const dek = generateDEK();
    const payload = { tool: 'test', argsSummary: { foo: { type: 'string', size: 10 } } };
    const aad = buildDebugLogAAD(accountId, sessionId, logId);

    const encrypted = encryptDebugPayloadWithDek(dek, payload, aad);
    const decrypted = decryptDebugPayloadWithDek(dek, encrypted, aad);

    expect(decrypted).toEqual(payload);
  });

  it('throws on decryption with wrong AAD (wrong log ID)', () => {
    const dek = generateDEK();
    const payload = { tool: 'test' };
    const aad = buildDebugLogAAD(accountId, sessionId, logId);
    const encrypted = encryptDebugPayloadWithDek(dek, payload, aad);
    const wrongAad = buildDebugLogAAD(accountId, sessionId, 'wrong-log-id');

    expect(() => decryptDebugPayloadWithDek(dek, encrypted, wrongAad)).toThrow();
  });

  it('throws on decryption with wrong DEK', () => {
    const dek1 = generateDEK();
    const dek2 = generateDEK();
    const payload = { tool: 'test' };
    const aad = buildDebugLogAAD(accountId, sessionId, logId);
    const encrypted = encryptDebugPayloadWithDek(dek1, payload, aad);

    expect(() => decryptDebugPayloadWithDek(dek2, encrypted, aad)).toThrow();
  });

  it('builds correct AAD structure', () => {
    const aad = buildDebugLogAAD(accountId, sessionId, logId);
    const parsed = JSON.parse(aad.toString('utf8'));

    expect(parsed).toEqual({
      account_id: accountId,
      call_session_id: sessionId,
      debug_log_id: logId,
      type: 'debug_log_payload',
    });
  });
});
