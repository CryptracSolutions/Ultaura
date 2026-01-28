import { decryptMemoryValue, encryptMemoryValue } from './encryption.js';
import { getSupabaseClient } from './supabase.js';
import { getMemoryDEK } from '../services/line-encryption.js';
import { decodeBytea } from './bytea.js';

const REMINDER_ALG = 'AES-256-GCM';
const REMINDER_KID = 'kek_v1';

export interface EncryptedReminderMessagePayload {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
  alg: string;
  kid: string;
}

export function buildReminderMessageAAD(
  accountId: string,
  lineId: string,
  reminderId: string
): Buffer {
  return Buffer.from(
    JSON.stringify({
      account_id: accountId,
      line_id: lineId,
      reminder_id: reminderId,
      type: 'reminder_message',
    }),
    'utf8'
  );
}

export function encryptReminderMessageWithDek(
  dek: Buffer,
  message: string,
  aad: Buffer
): EncryptedReminderMessagePayload {
  const { ciphertext, iv, tag } = encryptMemoryValue(dek, message, aad);

  return {
    ciphertext,
    iv,
    tag,
    alg: REMINDER_ALG,
    kid: REMINDER_KID,
  };
}

export function decryptReminderMessageWithDek(
  dek: Buffer,
  encrypted: { ciphertext: Uint8Array | string; iv: Uint8Array | string; tag: Uint8Array | string },
  aad: Buffer
): string {
  const ciphertext = decodeBytea(encrypted.ciphertext);
  const iv = decodeBytea(encrypted.iv);
  const tag = decodeBytea(encrypted.tag);
  if (!ciphertext || !iv || !tag) {
    throw new Error('Failed to decode reminder payloads');
  }
  const value = decryptMemoryValue(
    dek,
    Buffer.from(ciphertext),
    Buffer.from(iv),
    Buffer.from(tag),
    aad
  );

  return String(value ?? '');
}

export async function encryptReminderMessage(
  accountId: string,
  lineId: string,
  reminderId: string,
  message: string
): Promise<EncryptedReminderMessagePayload> {
  const supabase = getSupabaseClient();
  const dek = await getMemoryDEK(supabase, accountId, lineId);
  const aad = buildReminderMessageAAD(accountId, lineId, reminderId);

  return encryptReminderMessageWithDek(dek, message, aad);
}

export async function decryptReminderMessage(
  accountId: string,
  lineId: string,
  reminderId: string,
  encrypted: { ciphertext: Uint8Array | string; iv: Uint8Array | string; tag: Uint8Array | string }
): Promise<string> {
  const supabase = getSupabaseClient();
  const dek = await getMemoryDEK(supabase, accountId, lineId);
  const aad = buildReminderMessageAAD(accountId, lineId, reminderId);

  return decryptReminderMessageWithDek(dek, encrypted, aad);
}

export function decryptReminderMessagesWithDek(
  dek: Buffer,
  accountId: string,
  lineId: string,
  reminders: Array<{
    id: string;
    message_ciphertext?: Uint8Array | string | null;
    message_iv?: Uint8Array | string | null;
    message_tag?: Uint8Array | string | null;
    message?: string | null;
  }>
): Array<{ id: string; message: string | null; decryptFailed: boolean }> {
  return reminders.map((reminder) => {
    if (reminder.message_ciphertext && reminder.message_iv && reminder.message_tag) {
      const aad = buildReminderMessageAAD(accountId, lineId, reminder.id);
      try {
        const message = decryptReminderMessageWithDek(
          dek,
          {
            ciphertext: reminder.message_ciphertext,
            iv: reminder.message_iv,
            tag: reminder.message_tag,
          },
          aad
        );
        return { id: reminder.id, message, decryptFailed: false };
      } catch {
        return { id: reminder.id, message: null, decryptFailed: true };
      }
    }

    return {
      id: reminder.id,
      message: reminder.message ?? null,
      decryptFailed: false,
    };
  });
}
