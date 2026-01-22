import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import {
  getCallSession,
  incrementToolInvocations,
  recordCallEvent,
  updateCallSessionRecording,
} from '../../services/call-session.js';
import { getAccountPrivacySettings, updateLineVoiceConsent } from '../../services/privacy.js';
import { getSupabaseClient } from '../../utils/supabase.js';
import { getPublicUrl } from '../../utils/env.js';
import { startRecordingForCall, stopRecordingForCall } from '../../utils/twilio.js';

export const recordingConsentRouter = Router();

const RECORDING_DISABLED_RESPONSE = {
  success: false,
  error: 'Recording is disabled for this account.',
};

function buildAuditMetadata(session: { is_test_call: boolean; is_preview_mode: boolean }) {
  if (!session.is_test_call && !session.is_preview_mode) {
    return null;
  }
  return {
    is_test_call: true,
    is_preview_mode: session.is_preview_mode,
  };
}

async function queueRecordingDeletion(options: {
  accountId: string;
  callSessionId: string;
  recordingSid: string;
}) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('ultaura_pending_recording_deletions')
    .insert({
      account_id: options.accountId,
      call_session_id: options.callSessionId,
      recording_sid: options.recordingSid,
      reason: 'user_request',
    });

  if (error) {
    logger.error({ error, recordingSid: options.recordingSid }, 'Failed to queue recording deletion');
  }
}

async function ensureRecordingEnabled(accountId: string) {
  const privacySettings = await getAccountPrivacySettings(accountId);
  return process.env.ULTAURA_ENABLE_RECORDING === 'true' && !!privacySettings?.recordingEnabled;
}

recordingConsentRouter.post('/grant_recording_consent', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId } = req.body as {
      callSessionId?: string;
      lineId?: string;
    };

    if (!callSessionId || !lineId) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ success: false, error: 'Call session not found' });
      return;
    }

    const recordFailure = async (errorCode?: string) => {
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'grant_recording_consent',
        success: false,
        errorCode,
      }, { skipDebugLog: true });
    };

    if (lineId !== session.line_id) {
      await recordFailure('unauthorized');
      res.status(403).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const recordingEnabled = await ensureRecordingEnabled(session.account_id);
    if (!recordingEnabled) {
      await recordFailure('recording_disabled');
      res.json(RECORDING_DISABLED_RESPONSE);
      return;
    }

    const skipPersist = session.is_test_call || session.is_preview_mode;
    const auditMetadata = buildAuditMetadata(session);

    const updated = await updateLineVoiceConsent(
      lineId,
      session.account_id,
      callSessionId,
      { recordingConsent: 'granted', recordingReenableRequestedAt: null },
      { skipPersist, auditMetadata }
    );

    if (!updated && !skipPersist) {
      await recordFailure('db_write_failed');
      res.status(500).json({ success: false, error: 'Failed to record consent' });
      return;
    }

    if (!skipPersist && session.twilio_call_sid && !session.recording_sid) {
      const publicUrl = getPublicUrl().replace(/\/$/, '');
      const recordingSid = await startRecordingForCall({
        callSid: session.twilio_call_sid,
        recordingStatusCallback: `${publicUrl}/twilio/recording-status`,
      });

      if (recordingSid) {
        await updateCallSessionRecording(session.id, recordingSid);
      }
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'grant_recording_consent',
      success: true,
    }, { skipDebugLog: true });

    res.json({
      success: true,
      message: 'Recording consent granted.',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to grant recording consent');
    res.status(500).json({ success: false, error: 'Failed to record consent' });
  }
});

recordingConsentRouter.post('/deny_recording_consent', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId } = req.body as {
      callSessionId?: string;
      lineId?: string;
    };

    if (!callSessionId || !lineId) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ success: false, error: 'Call session not found' });
      return;
    }

    const recordFailure = async (errorCode?: string) => {
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'deny_recording_consent',
        success: false,
        errorCode,
      }, { skipDebugLog: true });
    };

    if (lineId !== session.line_id) {
      await recordFailure('unauthorized');
      res.status(403).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const recordingEnabled = await ensureRecordingEnabled(session.account_id);
    if (!recordingEnabled) {
      await recordFailure('recording_disabled');
      res.json(RECORDING_DISABLED_RESPONSE);
      return;
    }

    if (!session.is_test_call && !session.is_preview_mode && session.recording_sid) {
      if (!session.twilio_call_sid) {
        logger.warn({ callSessionId }, 'Missing Twilio call SID; queueing recording deletion');
        await queueRecordingDeletion({
          accountId: session.account_id,
          callSessionId,
          recordingSid: session.recording_sid,
        });
      } else {
        const stopped = await stopRecordingForCall({
          callSid: session.twilio_call_sid,
          recordingSid: session.recording_sid,
        });
        if (!stopped) {
          await queueRecordingDeletion({
            accountId: session.account_id,
            callSessionId,
            recordingSid: session.recording_sid,
          });
        }
      }
    }

    const skipPersist = session.is_test_call || session.is_preview_mode;
    const auditMetadata = buildAuditMetadata(session);

    const updated = await updateLineVoiceConsent(
      lineId,
      session.account_id,
      callSessionId,
      { recordingConsent: 'denied', recordingReenableRequestedAt: null },
      { skipPersist, auditMetadata }
    );

    if (!updated && !skipPersist) {
      await recordFailure('db_write_failed');
      res.status(500).json({ success: false, error: 'Failed to record consent' });
      return;
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'deny_recording_consent',
      success: true,
    }, { skipDebugLog: true });

    res.json({
      success: true,
      message: 'Recording consent denied.',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to deny recording consent');
    res.status(500).json({ success: false, error: 'Failed to record consent' });
  }
});

recordingConsentRouter.post('/revoke_recording_consent', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId } = req.body as {
      callSessionId?: string;
      lineId?: string;
    };

    if (!callSessionId || !lineId) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ success: false, error: 'Call session not found' });
      return;
    }

    const recordFailure = async (errorCode?: string) => {
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'revoke_recording_consent',
        success: false,
        errorCode,
      }, { skipDebugLog: true });
    };

    if (lineId !== session.line_id) {
      await recordFailure('unauthorized');
      res.status(403).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const recordingEnabled = await ensureRecordingEnabled(session.account_id);
    if (!recordingEnabled) {
      await recordFailure('recording_disabled');
      res.json(RECORDING_DISABLED_RESPONSE);
      return;
    }

    if (!session.is_test_call && !session.is_preview_mode && session.recording_sid) {
      if (!session.twilio_call_sid) {
        logger.warn({ callSessionId }, 'Missing Twilio call SID; queueing recording deletion');
        await queueRecordingDeletion({
          accountId: session.account_id,
          callSessionId,
          recordingSid: session.recording_sid,
        });
      } else {
        const stopped = await stopRecordingForCall({
          callSid: session.twilio_call_sid,
          recordingSid: session.recording_sid,
        });
        if (!stopped) {
          await queueRecordingDeletion({
            accountId: session.account_id,
            callSessionId,
            recordingSid: session.recording_sid,
          });
        }
      }
    }

    const skipPersist = session.is_test_call || session.is_preview_mode;
    const auditMetadata = buildAuditMetadata(session);

    const updated = await updateLineVoiceConsent(
      lineId,
      session.account_id,
      callSessionId,
      { recordingConsent: 'denied', recordingReenableRequestedAt: null },
      { skipPersist, auditMetadata }
    );

    if (!updated && !skipPersist) {
      await recordFailure('db_write_failed');
      res.status(500).json({ success: false, error: 'Failed to record consent' });
      return;
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'revoke_recording_consent',
      success: true,
    }, { skipDebugLog: true });

    res.json({
      success: true,
      message: 'Recording stopped for this call.',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to revoke recording consent');
    res.status(500).json({ success: false, error: 'Failed to revoke consent' });
  }
});

recordingConsentRouter.post('/set_recording_preference_permanent', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId, never_ask } = req.body as {
      callSessionId?: string;
      lineId?: string;
      never_ask?: boolean;
    };

    if (!callSessionId || !lineId || typeof never_ask !== 'boolean') {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ success: false, error: 'Call session not found' });
      return;
    }

    const recordFailure = async (errorCode?: string) => {
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'set_recording_preference_permanent',
        success: false,
        errorCode,
      }, { skipDebugLog: true });
    };

    if (lineId !== session.line_id) {
      await recordFailure('unauthorized');
      res.status(403).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const supabase = getSupabaseClient();
    const { data: consentRow, error: consentError } = await supabase
      .from('ultaura_line_voice_consent')
      .select('recording_reenable_requested_at, recording_reenable_decline_count, recording_reenable_blocked_at')
      .eq('line_id', lineId)
      .maybeSingle();

    if (consentError) {
      logger.error({ error: consentError, lineId }, 'Failed to load recording consent state');
    }

    const skipPersist = session.is_test_call || session.is_preview_mode;
    const auditMetadata = buildAuditMetadata(session);

    const hasReenableRequest = Boolean(consentRow?.recording_reenable_requested_at);
    const currentDeclineCount = consentRow?.recording_reenable_decline_count ?? 0;
    const currentBlockedAt = consentRow?.recording_reenable_blocked_at ?? null;
    const updates: Parameters<typeof updateLineVoiceConsent>[3] = {
      recordingPreferencePermanent: never_ask,
    };

    if (hasReenableRequest) {
      updates.recordingReenableRequestedAt = null;
      if (never_ask) {
        const nextDeclineCount = currentDeclineCount + 1;
        updates.recordingReenableDeclineCount = nextDeclineCount;
        if (!currentBlockedAt) {
          updates.recordingReenableBlockedAt = new Date().toISOString();
        }
      }
    }

    const updated = await updateLineVoiceConsent(
      lineId,
      session.account_id,
      callSessionId,
      updates,
      { skipPersist, auditMetadata }
    );

    if (!updated && !skipPersist) {
      await recordFailure('db_write_failed');
      res.status(500).json({ success: false, error: 'Failed to update recording preference' });
      return;
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'set_recording_preference_permanent',
      success: true,
      neverAsk: never_ask,
    }, { skipDebugLog: true });

    res.json({
      success: true,
      message: never_ask
        ? 'Recording preference updated. Will not ask again.'
        : 'Recording preference updated. Will ask each call.',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to update recording preference');
    res.status(500).json({ success: false, error: 'Failed to update recording preference' });
  }
});
