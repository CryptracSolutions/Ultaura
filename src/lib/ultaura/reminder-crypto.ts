'use server';

import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import getLogger from '~/core/logger';

const logger = getLogger();

const ALGORITHM = 'aes-256-gcm';
const TAG_LENGTH = 16;
const IV_LENGTH = 12;
const REMINDER_ALG = 'AES-256-GCM';
const REMINDER_KID = 'kek_v1';

const DEFAULT_DEK_CUTOFF = '2026-03-01T00:00:00Z';
const PER_LINE_DEK_ENABLED = process.env.ULTAURA_PER_LINE_DEK_ENABLED !== 'false';
const PER_LINE_DEK_CUTOFF = new Date(process.env.ULTAURA_PER_LINE_DEK_CUTOFF || DEFAULT_DEK_CUTOFF);

function getKEK(): Buffer {
  const kekHex = process.env.ULTAURA_ENCRYPTION_KEY;

  if (!kekHex) {
    throw new Error('Missing ULTAURA_ENCRYPTION_KEY environment variable');
  }

  if (kekHex.length !== 64) {
    throw new Error('ULTAURA_ENCRYPTION_KEY must be 64 hex characters');
  }

  return Buffer.from(kekHex, 'hex');
}

function unwrapDEK(wrapped: Buffer, iv: Buffer, tag: Buffer): Buffer {
  const kek = getKEK();
  const decipher = crypto.createDecipheriv(ALGORITHM, kek, iv, {
    authTagLength: TAG_LENGTH,
  });

  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(wrapped), decipher.final()]);
}

function wrapDEK(dek: Buffer): { wrapped: Buffer; iv: Buffer; tag: Buffer } {
  const kek = getKEK();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, kek, iv, {
    authTagLength: TAG_LENGTH,
  });

  const wrapped = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();

  return { wrapped, iv, tag };
}

function isLegacyLine(createdAt: string | null | undefined): boolean {
  if (!PER_LINE_DEK_ENABLED || !createdAt) {
    return true;
  }

  const cutoff = Number.isNaN(PER_LINE_DEK_CUTOFF.getTime())
    ? new Date(DEFAULT_DEK_CUTOFF)
    : PER_LINE_DEK_CUTOFF;

  return new Date(createdAt) < cutoff;
}

async function getOrCreateAccountDEK(
  client: SupabaseClient,
  accountId: string
): Promise<Buffer> {
  const { data: existing } = await client
    .from('ultaura_account_crypto_keys')
    .select('*')
    .eq('account_id', accountId)
    .single();

  if (existing) {
    return unwrapDEK(
      Buffer.from(existing.dek_wrapped),
      Buffer.from(existing.dek_wrap_iv),
      Buffer.from(existing.dek_wrap_tag)
    );
  }

  const dek = crypto.randomBytes(32);
  const { wrapped, iv, tag } = wrapDEK(dek);

  const { error } = await client
    .from('ultaura_account_crypto_keys')
    .insert({
      account_id: accountId,
      dek_wrapped: wrapped,
      dek_wrap_iv: iv,
      dek_wrap_tag: tag,
      dek_kid: REMINDER_KID,
      dek_alg: REMINDER_ALG,
    });

  if (error) {
    logger.error({ error, accountId }, 'Failed to create account DEK');
    throw new Error('Failed to create account encryption key');
  }

  return dek;
}

async function getLineDEK(
  client: SupabaseClient,
  lineId: string
): Promise<Buffer | null> {
  const { data: existing, error } = await client
    .from('ultaura_line_crypto_keys')
    .select('*')
    .eq('line_id', lineId)
    .maybeSingle();

  if (error) {
    logger.error({ error, lineId }, 'Failed to load line DEK');
    return null;
  }

  if (!existing) {
    return null;
  }

  return unwrapDEK(
    Buffer.from(existing.dek_wrapped),
    Buffer.from(existing.dek_wrap_iv),
    Buffer.from(existing.dek_wrap_tag)
  );
}

async function createLineDEK(
  client: SupabaseClient,
  accountId: string,
  lineId: string
): Promise<Buffer> {
  const dek = crypto.randomBytes(32);
  const { wrapped, iv, tag } = wrapDEK(dek);

  const { error } = await client
    .from('ultaura_line_crypto_keys')
    .insert({
      line_id: lineId,
      account_id: accountId,
      dek_wrapped: wrapped,
      dek_wrap_iv: iv,
      dek_wrap_tag: tag,
      dek_kid: REMINDER_KID,
      dek_alg: REMINDER_ALG,
    });

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      const existing = await getLineDEK(client, lineId);
      if (existing) {
        return existing;
      }
    }
    logger.error({ error, lineId }, 'Failed to create line DEK');
    throw new Error('Failed to create line encryption key');
  }

  return dek;
}

async function getOrCreateLineDEK(
  client: SupabaseClient,
  accountId: string,
  lineId: string
): Promise<Buffer> {
  const existing = await getLineDEK(client, lineId);
  if (existing) {
    return existing;
  }
  return createLineDEK(client, accountId, lineId);
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

function encryptValue(
  dek: Buffer,
  message: string,
  aad: Buffer
): { ciphertext: Buffer; iv: Buffer; tag: Buffer } {
  const iv = crypto.randomBytes(IV_LENGTH);
  const plaintext = Buffer.from(JSON.stringify(message), 'utf8');

  const cipher = crypto.createCipheriv(ALGORITHM, dek, iv, {
    authTagLength: TAG_LENGTH,
  });

  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return { ciphertext, iv, tag };
}

function decryptValue(
  dek: Buffer,
  ciphertext: Uint8Array,
  iv: Uint8Array,
  tag: Uint8Array,
  aad: Buffer
): string {
  const decipher = crypto.createDecipheriv(ALGORITHM, dek, iv, {
    authTagLength: TAG_LENGTH,
  });

  decipher.setAuthTag(Buffer.from(tag));
  decipher.setAAD(aad);

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext)),
    decipher.final(),
  ]);

  return String(JSON.parse(plaintext.toString('utf8')) ?? '');
}

async function getReminderDEK(
  client: SupabaseClient,
  accountId: string,
  lineId: string,
  lineCreatedAt?: string | null
): Promise<Buffer> {
  if (!PER_LINE_DEK_ENABLED) {
    return getOrCreateAccountDEK(client, accountId);
  }

  if (isLegacyLine(lineCreatedAt)) {
    return getOrCreateAccountDEK(client, accountId);
  }

  return getOrCreateLineDEK(client, accountId, lineId);
}

export async function encryptReminderMessage(
  client: SupabaseClient,
  accountId: string,
  lineId: string,
  reminderId: string,
  message: string,
  lineCreatedAt?: string | null
): Promise<{
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
  alg: string;
  kid: string;
}> {
  const dek = await getReminderDEK(client, accountId, lineId, lineCreatedAt);
  const aad = buildReminderMessageAAD(accountId, lineId, reminderId);
  const { ciphertext, iv, tag } = encryptValue(dek, message, aad);

  return {
    ciphertext,
    iv,
    tag,
    alg: REMINDER_ALG,
    kid: REMINDER_KID,
  };
}

export async function decryptReminderMessage(
  client: SupabaseClient,
  accountId: string,
  lineId: string,
  reminderId: string,
  encrypted: { ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array },
  lineCreatedAt?: string | null
): Promise<string> {
  const dek = await getReminderDEK(client, accountId, lineId, lineCreatedAt);
  const aad = buildReminderMessageAAD(accountId, lineId, reminderId);

  return decryptValue(dek, encrypted.ciphertext, encrypted.iv, encrypted.tag, aad);
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
        const message = decryptValue(
          dek,
          Buffer.from(reminder.message_ciphertext as Uint8Array),
          Buffer.from(reminder.message_iv as Uint8Array),
          Buffer.from(reminder.message_tag as Uint8Array),
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

export async function decryptReminderMessagesForLine(
  client: SupabaseClient,
  accountId: string,
  lineId: string,
  reminders: Array<{
    id: string;
    message_ciphertext?: Uint8Array | string | null;
    message_iv?: Uint8Array | string | null;
    message_tag?: Uint8Array | string | null;
    message?: string | null;
  }>,
  lineCreatedAt?: string | null
): Promise<Array<{ id: string; message: string | null; decryptFailed: boolean }>> {
  const dek = await getReminderDEK(client, accountId, lineId, lineCreatedAt);
  return decryptReminderMessagesWithDek(dek, accountId, lineId, reminders);
}
