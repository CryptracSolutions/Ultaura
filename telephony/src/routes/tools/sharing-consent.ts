import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { getLineVoiceConsent, logConsentAuditEvent, updateLineVoiceConsent } from '../../services/privacy.js';
import { getSupabaseClient } from '../../utils/supabase.js';

export const sharingConsentRouter = Router();

const VALID_TIERS = new Set(['tier_1', 'tier_2', 'tier_3', 'tier_4']);

function buildAuditMetadata(session: { is_test_call: boolean; is_preview_mode: boolean }) {
  if (!session.is_test_call && !session.is_preview_mode) {
    return null;
  }
  return {
    is_test_call: true,
    is_preview_mode: session.is_preview_mode,
  };
}

async function getAccountSharing(accountId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ultaura_accounts')
    .select('id, user_type, sharing_enabled, sharing_enabled_at')
    .eq('id', accountId)
    .single();

  if (error || !data) {
    logger.error({ error, accountId }, 'Failed to load account sharing settings');
    return null;
  }

  return data;
}

sharingConsentRouter.post('/set_sharing_tier', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId, tier, consent } = req.body as {
      callSessionId?: string;
      lineId?: string;
      tier?: string;
      consent?: 'granted' | 'denied';
    };

    if (!callSessionId || !lineId || !tier) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    if (!VALID_TIERS.has(tier)) {
      res.status(400).json({ success: false, error: 'Invalid tier' });
      return;
    }

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ success: false, error: 'Call session not found' });
      return;
    }

    const recordFailure = async (errorCode?: string) => {
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'set_sharing_tier',
        success: false,
        errorCode,
      }, { skipDebugLog: true });
    };

    if (lineId !== session.line_id) {
      await recordFailure('unauthorized');
      res.status(403).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const resolvedConsent = consent === 'denied' ? 'denied' : 'granted';
    const resolvedTier = consent === 'denied' ? 'tier_1' : tier;
    const skipPersist = session.is_test_call || session.is_preview_mode;
    const auditMetadata = buildAuditMetadata(session);

    const updated = await updateLineVoiceConsent(
      lineId,
      session.account_id,
      callSessionId,
      {
        sharingConsent: resolvedConsent,
        sharingTier: resolvedTier as 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4',
      },
      { skipPersist, auditMetadata }
    );

    if (!updated && !skipPersist) {
      await recordFailure('db_write_failed');
      res.status(500).json({ success: false, error: 'Failed to update sharing preference' });
      return;
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'set_sharing_tier',
      success: true,
      tier: resolvedTier,
      consent: resolvedConsent,
    }, { skipDebugLog: true });

    res.json({
      success: true,
      message: 'Sharing preference updated.',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to update sharing tier');
    res.status(500).json({ success: false, error: 'Failed to update sharing tier' });
  }
});

sharingConsentRouter.post('/get_sharing_tier', async (req: Request, res: Response) => {
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

    if (lineId !== session.line_id) {
      res.status(403).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const consent = await getLineVoiceConsent(lineId);
    if (!consent) {
      res.status(404).json({ success: false, error: 'Consent record not found' });
      return;
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'get_sharing_tier',
      success: true,
    }, { skipDebugLog: true });

    res.json({
      success: true,
      tier: consent.sharingTier,
      consent: consent.sharingConsent,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get sharing tier');
    res.status(500).json({ success: false, error: 'Failed to get sharing tier' });
  }
});

sharingConsentRouter.post('/enable_family_sharing', async (req: Request, res: Response) => {
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
        tool: 'enable_family_sharing',
        success: false,
        errorCode,
      }, { skipDebugLog: true });
    };

    if (lineId !== session.line_id) {
      await recordFailure('unauthorized');
      res.status(403).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const account = await getAccountSharing(session.account_id);
    if (!account) {
      await recordFailure('account_not_found');
      res.status(404).json({ success: false, error: 'Account not found' });
      return;
    }

    if (account.user_type !== 'self') {
      await recordFailure('invalid_user_type');
      res.status(400).json({ success: false, error: 'Sharing is already managed by family.' });
      return;
    }

    const skipPersist = session.is_test_call || session.is_preview_mode;

    if (!skipPersist) {
      const supabase = getSupabaseClient();
      const updates: Record<string, unknown> = {
        sharing_enabled: true,
      };

      if (!account.sharing_enabled_at) {
        updates.sharing_enabled_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('ultaura_accounts')
        .update(updates)
        .eq('id', session.account_id);

      if (error) {
        logger.error({ error, accountId: session.account_id }, 'Failed to enable sharing');
        await recordFailure('update_failed');
        res.status(500).json({ success: false, error: 'Failed to enable sharing' });
        return;
      }

      const updated = await updateLineVoiceConsent(
        lineId,
        session.account_id,
        callSessionId,
        { sharingConsent: 'pending' },
        { skipPersist: false, auditMetadata: buildAuditMetadata(session) }
      );

      if (!updated) {
        await recordFailure('db_write_failed');
        res.status(500).json({ success: false, error: 'Failed to update sharing consent' });
        return;
      }

      await logConsentAuditEvent({
        accountId: session.account_id,
        lineId,
        callSessionId,
        action: 'sharing_enabled_by_self_user',
        consentType: 'data_sharing',
        oldValue: { sharing_enabled: account.sharing_enabled },
        newValue: { sharing_enabled: true },
        metadata: buildAuditMetadata(session),
      });
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'enable_family_sharing',
      success: true,
    }, { skipDebugLog: true });

    res.json({
      success: true,
      message: 'Family sharing enabled. Ask for tier preference next.',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to enable family sharing');
    res.status(500).json({ success: false, error: 'Failed to enable sharing' });
  }
});
