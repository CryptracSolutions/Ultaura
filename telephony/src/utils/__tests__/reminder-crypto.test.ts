import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  buildReminderMessageAAD,
  decryptReminderMessageWithDek,
  decryptReminderMessagesWithDek,
  encryptReminderMessageWithDek,
} from '../reminder-crypto.js';

describe('reminder-crypto', () => {
  it('builds deterministic AAD', () => {
    const aad1 = buildReminderMessageAAD('acct-1', 'line-1', 'rem-1');
    const aad2 = buildReminderMessageAAD('acct-1', 'line-1', 'rem-1');

    expect(aad1.equals(aad2)).toBe(true);
  });

  it('encrypts and decrypts reminder messages with AAD', () => {
    const dek = crypto.randomBytes(32);
    const aad = buildReminderMessageAAD('acct-1', 'line-1', 'rem-1');

    const encrypted = encryptReminderMessageWithDek(dek, 'Take medication', aad);
    const decrypted = decryptReminderMessageWithDek(dek, encrypted, aad);

    expect(decrypted).toBe('Take medication');
  });

  it('round-trips unicode reminder messages', () => {
    const dek = crypto.randomBytes(32);
    const aad = buildReminderMessageAAD('acct-1', 'line-1', 'rem-1');

    const encrypted = encryptReminderMessageWithDek(dek, 'Café mañana', aad);
    const decrypted = decryptReminderMessageWithDek(dek, encrypted, aad);

    expect(decrypted).toBe('Café mañana');
  });

  it('fails decryption with different AAD', () => {
    const dek = crypto.randomBytes(32);
    const aad = buildReminderMessageAAD('acct-1', 'line-1', 'rem-1');
    const wrongAad = buildReminderMessageAAD('acct-1', 'line-1', 'rem-2');

    const encrypted = encryptReminderMessageWithDek(dek, 'Call the doctor', aad);

    expect(() => decryptReminderMessageWithDek(dek, encrypted, wrongAad)).toThrow();
  });

  it('batch decrypt reports failures without stopping', () => {
    const dek = crypto.randomBytes(32);
    const aad1 = buildReminderMessageAAD('acct-1', 'line-1', 'rem-1');
    const aad2 = buildReminderMessageAAD('acct-1', 'line-1', 'rem-2');

    const encrypted1 = encryptReminderMessageWithDek(dek, 'Drink water', aad1);
    const encrypted2 = encryptReminderMessageWithDek(dek, 'Stretch', aad2);
    const badTag = Buffer.from(encrypted2.tag);
    badTag[0] = badTag[0] ^ 0xff;

    const results = decryptReminderMessagesWithDek(dek, 'acct-1', 'line-1', [
      {
        id: 'rem-1',
        message_ciphertext: encrypted1.ciphertext,
        message_iv: encrypted1.iv,
        message_tag: encrypted1.tag,
        message: null,
      },
      {
        id: 'rem-2',
        message_ciphertext: encrypted2.ciphertext,
        message_iv: encrypted2.iv,
        message_tag: badTag,
        message: null,
      },
    ]);

    const first = results.find((result) => result.id === 'rem-1');
    const second = results.find((result) => result.id === 'rem-2');

    expect(first?.message).toBe('Drink water');
    expect(first?.decryptFailed).toBe(false);
    expect(second?.message).toBeNull();
    expect(second?.decryptFailed).toBe(true);
  });
});
