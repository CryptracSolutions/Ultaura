import 'server-only';

import crypto from 'crypto';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import getLogger from '~/core/logger';

const logger = getLogger();
const TOKEN_TTL_MINUTES = 5;
const TOKEN_RATE_LIMIT_PER_HOUR = 30;

export function generateAccessToken(): { plainToken: string; tokenHash: string } {
  const plainToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');
  return { plainToken, tokenHash };
}

export async function createAccessToken(
  documentId: string,
  lineId: string,
  accountId: string,
  actorUserId: string,
  action: 'preview' | 'download',
): Promise<{ token: string; expiresAt: string } | { error: string }> {
  const client = getSupabaseServerActionClient({ admin: true });

  // Rate limit: 30 token requests per document per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await client
    .from('ultaura_health_document_access_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', documentId)
    .gte('created_at', oneHourAgo);

  if (countError) {
    logger.error({ error: countError, documentId }, 'Failed to check token rate limit');
    return { error: 'Rate limit check failed' };
  }

  if ((count ?? 0) >= TOKEN_RATE_LIMIT_PER_HOUR) {
    return { error: 'Token rate limit exceeded' };
  }

  const { plainToken, tokenHash } = generateAccessToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

  const { error } = await client
    .from('ultaura_health_document_access_tokens')
    .insert({
      document_id: documentId,
      line_id: lineId,
      account_id: accountId,
      actor_user_id: actorUserId,
      action,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

  if (error) {
    logger.error({ error, documentId }, 'Failed to create access token');
    return { error: 'Failed to create token' };
  }

  return { token: plainToken, expiresAt };
}

export async function validateAndConsumeToken(
  plainToken: string,
  documentId: string,
  action: 'preview' | 'download',
): Promise<
  | { valid: true; accountId: string; lineId: string; actorUserId: string }
  | { valid: false; reason: string }
> {
  const client = getSupabaseServerActionClient({ admin: true });
  const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');

  // Atomically consume: UPDATE ... WHERE used_at IS NULL AND expires_at > now()
  const { data, error } = await client
    .from('ultaura_health_document_access_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token_hash', tokenHash)
    .eq('document_id', documentId)
    .eq('action', action)
    .is('used_at', null)
    .gte('expires_at', new Date().toISOString())
    .select('account_id, line_id, actor_user_id')
    .maybeSingle();

  if (error) {
    logger.error({ error, documentId }, 'Token validation query failed');
    return { valid: false, reason: 'Validation error' };
  }

  if (!data) {
    return { valid: false, reason: 'Token invalid, expired, or already used' };
  }

  return {
    valid: true,
    accountId: data.account_id,
    lineId: data.line_id,
    actorUserId: data.actor_user_id ?? '',
  };
}
