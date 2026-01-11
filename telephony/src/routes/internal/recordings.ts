import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { requireInternalSecret } from '../../middleware/auth.js';
import { getSupabaseClient } from '../../utils/supabase.js';
import { getTwilioClient } from '../../utils/twilio.js';

const allowedReasons = new Set(['retention_policy', 'user_request', 'account_deletion']);

export const internalRecordingsRouter = Router();

internalRecordingsRouter.use(requireInternalSecret);

internalRecordingsRouter.post('/recordings/delete', async (req: Request, res: Response) => {
  try {
    const { recording_sids: recordingSids, reason } = req.body as {
      recording_sids?: string[];
      reason?: string;
    };

    if (!recordingSids || !Array.isArray(recordingSids) || recordingSids.length === 0) {
      res.status(400).json({ error: 'Missing recording_sids array' });
      return;
    }

    if (!reason || !allowedReasons.has(reason)) {
      res.status(400).json({ error: 'Invalid reason' });
      return;
    }

    const supabase = getSupabaseClient();
    const client = getTwilioClient();

    const { data: sessions, error: sessionError } = await supabase
      .from('ultaura_call_sessions')
      .select('id, account_id, recording_sid')
      .in('recording_sid', recordingSids);

    if (sessionError) {
      logger.error({ error: sessionError }, 'Failed to load call sessions for recording deletion');
    }

    const { data: pendingRows, error: pendingError } = await supabase
      .from('ultaura_pending_recording_deletions')
      .select('id, recording_sid, attempts, max_attempts')
      .in('recording_sid', recordingSids);

    if (pendingError) {
      logger.error({ error: pendingError }, 'Failed to load pending recording deletions');
    }

    const sessionByRecording = new Map<string, { id: string; account_id: string }>();
    (sessions || []).forEach((session) => {
      if (session.recording_sid) {
        sessionByRecording.set(session.recording_sid, {
          id: session.id,
          account_id: session.account_id,
        });
      }
    });

    const pendingByRecording = new Map<string, { id: string; attempts: number; max_attempts: number }>();
    (pendingRows || []).forEach((row) => {
      pendingByRecording.set(row.recording_sid, {
        id: row.id,
        attempts: row.attempts,
        max_attempts: row.max_attempts,
      });
    });

    let deleted = 0;
    let failed = 0;

    for (const recordingSid of recordingSids) {
      const session = sessionByRecording.get(recordingSid);
      const pending = pendingByRecording.get(recordingSid);
      const now = new Date().toISOString();

      if (!session) {
        logger.warn({ recordingSid }, 'No call session found for recording deletion');
      }

      try {
        await client.recordings(recordingSid).remove();
        deleted += 1;

        if (session) {
          await supabase
            .from('ultaura_call_sessions')
            .update({
              recording_deleted_at: now,
              recording_deletion_reason: reason,
            })
            .eq('id', session.id);
        }

        if (pending) {
          await supabase
            .from('ultaura_pending_recording_deletions')
            .update({
              attempts: pending.attempts + 1,
              last_attempt_at: now,
              processed_at: now,
              last_error: null,
            })
            .eq('id', pending.id);
        }
      } catch (error) {
        failed += 1;
        const errorMessage = (error as { message?: string }).message || 'Unknown error';
        logger.error({ error, recordingSid }, 'Failed to delete recording');

        if (!session) {
          continue;
        }

        const attempts = (pending?.attempts ?? 0) + 1;
        const maxAttempts = pending?.max_attempts ?? 3;

        const updates: Record<string, unknown> = {
          recording_sid: recordingSid,
          account_id: session.account_id,
          call_session_id: session.id,
          reason,
          attempts,
          last_attempt_at: now,
          last_error: errorMessage,
        };

        if (attempts >= maxAttempts) {
          updates.processed_at = now;
        }

        if (pending) {
          await supabase
            .from('ultaura_pending_recording_deletions')
            .update(updates)
            .eq('id', pending.id);
        } else {
          await supabase
            .from('ultaura_pending_recording_deletions')
            .insert(updates);
        }
      }
    }

    res.json({ success: true, deleted, failed });
  } catch (error) {
    logger.error({ error }, 'Recording deletion endpoint failed');
    res.status(500).json({ error: 'Failed to delete recordings' });
  }
});
