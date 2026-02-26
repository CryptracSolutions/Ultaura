// Internal API for initiating calls

import { Router, Request, Response } from 'express';
import { logger } from '../server.js';
import { getLineById, checkLineAccess, isInQuietHours } from '../services/line-lookup.js';
import { createCallSession, failCallSession, getCallSessionByIdempotencyKey } from '../services/call-session.js';
import { initiateOutboundCall } from '../utils/twilio.js';
import { getPublicUrl } from '../utils/env.js';
import { requireInternalSecret } from '../middleware/auth.js';
import { sanitizePromptValue } from '../services/prompt-context.js';
import {
  clearLifeNoteForCallSession,
  setLifeNoteForCallSession,
  type LifeNotePayload,
} from '../websocket/life-note-store.js';

export const callsRouter = Router();

callsRouter.use(requireInternalSecret);

function mapAccessDeniedReasonToEndReason(
  reason: string | undefined
): 'trial_cap' | 'minutes_cap' | 'error' {
  if (reason === 'trial_cap') {
    return 'trial_cap';
  }

  if (reason === 'minutes_cap') {
    return 'minutes_cap';
  }

  return 'error';
}

function sanitizeOptionalLifeNoteField(value: unknown, maxLength: number): string | null {
  return typeof value === 'string'
    ? sanitizePromptValue(value, maxLength) || null
    : null;
}

function extractLifeNotePayload(body: Record<string, unknown>): LifeNotePayload | null {
  const note = sanitizeOptionalLifeNoteField(body.lifeNote, 200);

  if (!note) {
    return null;
  }

  const authorName = sanitizeOptionalLifeNoteField(body.lifeNoteAuthorName, 100);
  if (!authorName) {
    return null;
  }

  const relationshipRaw = body.lifeNoteAuthorRelationship;
  const relationship =
    relationshipRaw === null ? null : sanitizeOptionalLifeNoteField(relationshipRaw, 100);

  return { note, authorName, relationship };
}

// Initiate an outbound call
callsRouter.post('/outbound', async (req: Request, res: Response) => {
  try {
    const {
      lineId,
      reason,
      reminderId,
      schedulerIdempotencyKey,
      isPreviewMode,
      targetPhoneNumber,
      overrideQuietHours,
    } = req.body;
    const lifeNote = extractLifeNotePayload((req.body ?? {}) as Record<string, unknown>);

    if (!lineId) {
      res.status(400).json({ error: 'Missing lineId' });
      return;
    }

    const isReminderCall = reason === 'reminder' && !!reminderId;
    const isTestCall = reason === 'test';
    const isManualCall = reason === 'manual';
    const previewMode = Boolean(isPreviewMode) && isTestCall;
    const hasAlternateTarget = isTestCall && typeof targetPhoneNumber === 'string' && targetPhoneNumber.trim().length > 0;
    const quietHoursOverride = (isTestCall || isManualCall) && Boolean(overrideQuietHours);

    logger.info({
      lineId,
      reason,
      isReminderCall,
      isTestCall,
      isManualCall,
      isPreviewMode: previewMode,
      schedulerIdempotencyKey,
    }, 'Outbound call request');

    // Get line info
    const lineWithAccount = await getLineById(lineId);
    if (!lineWithAccount) {
      res.status(404).json({ error: 'Line not found' });
      return;
    }

    const { line, account } = lineWithAccount;

    // Check if line is opted out
    if (line.do_not_call && !hasAlternateTarget) {
      logger.info({ lineId }, 'Line opted out, skipping call');
      res.status(400).json({ error: 'Line opted out', code: 'DO_NOT_CALL' });
      return;
    }

    // Check quiet hours
    if (isInQuietHours(line) && !quietHoursOverride) {
      logger.info({ lineId }, 'In quiet hours, skipping call');
      res.status(400).json({ error: 'In quiet hours', code: 'QUIET_HOURS' });
      return;
    }

    const callDestination = hasAlternateTarget ? targetPhoneNumber.trim() : line.phone_e164;

    // Create call session
    const session = await createCallSession({
      accountId: account.id,
      lineId: line.id,
      direction: 'outbound',
      twilioFrom: process.env.TWILIO_PHONE_NUMBER,
      twilioTo: callDestination,
      isReminderCall,
      isTestCall,
      reminderId: isReminderCall ? reminderId : undefined,
      schedulerIdempotencyKey,
      isPreviewMode: previewMode,
    });

    if (!session) {
      // Check if this was an idempotency conflict (already processed)
      if (schedulerIdempotencyKey) {
        const existing = await getCallSessionByIdempotencyKey(schedulerIdempotencyKey);
        if (existing) {
          res.status(409).json({
            error: 'Duplicate scheduled call',
            code: 'DUPLICATE_SCHEDULED_CALL',
            existingSessionId: existing.id,
          });
          return;
        }
      }
      res.status(500).json({ error: 'Failed to create call session' });
      return;
    }

    if (lifeNote) {
      setLifeNoteForCallSession(session.id, lifeNote);
    }

    // Reserve trial cap (if applicable) with the real session ID before Twilio call initiation.
    const accessCheck = await checkLineAccess(line, account, 'outbound', {
      skipDnc: hasAlternateTarget,
      skipVerification: hasAlternateTarget,
      callSessionId: session.id,
    });
    if (!accessCheck.allowed) {
      logger.info({ lineId, callSessionId: session.id, reason: accessCheck.reason }, 'Line access denied');
      clearLifeNoteForCallSession(session.id);
      await failCallSession(session.id, mapAccessDeniedReasonToEndReason(accessCheck.reason));
      res.status(400).json({ error: 'Access denied', code: accessCheck.reason });
      return;
    }

    try {
      // Get base URL for callbacks
      const publicUrl = getPublicUrl().replace(/\/$/, '');

      // Initiate the call via Twilio
      const callSid = await initiateOutboundCall({
        to: callDestination,
        from: process.env.TWILIO_PHONE_NUMBER!,
        callbackUrl: `${publicUrl}/twilio/voice/outbound`,
        statusCallbackUrl: `${publicUrl}/twilio/status`,
        callSessionId: session.id,
        callbackParams: quietHoursOverride ? { overrideQuietHours: '1' } : undefined,
      });

      logger.info({
        callSessionId: session.id,
        twilioCallSid: callSid,
        lineId,
        isReminderCall,
      }, 'Outbound call initiated');

      res.json({
        success: true,
        sessionId: session.id,
        callSid,
      });
    } catch (error) {
      logger.error({ error, callSessionId: session.id }, 'Failed to initiate Twilio call');
      clearLifeNoteForCallSession(session.id);
      await failCallSession(session.id, 'error');
      res.status(500).json({ error: 'Failed to initiate call' });
    }
  } catch (error) {
    logger.error({ error }, 'Error in outbound call request');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test call endpoint (for dashboard "Test call now" button)
callsRouter.post('/test', async (req: Request, res: Response) => {
  // Forward to outbound with test reason
  req.body.reason = 'test';

  // Call the outbound handler logic directly
  const { lineId, isPreviewMode } = req.body;

  if (!lineId) {
    res.status(400).json({ error: 'Missing lineId' });
    return;
  }

  // Get line info
  const lineWithAccount = await getLineById(lineId);
  if (!lineWithAccount) {
    res.status(404).json({ error: 'Line not found' });
    return;
  }

  const { line, account } = lineWithAccount;

  // Skip opt-out check for test calls
  // Skip quiet hours check for test calls

  // Create call session
  const session = await createCallSession({
    accountId: account.id,
    lineId: line.id,
    direction: 'outbound',
    twilioFrom: process.env.TWILIO_PHONE_NUMBER,
    twilioTo: line.phone_e164,
    isTestCall: true,
    isPreviewMode: Boolean(isPreviewMode),
  });

  if (!session) {
    res.status(500).json({ error: 'Failed to create call session' });
    return;
  }

  // Reserve trial cap (if applicable) with the real session ID before Twilio call initiation.
  const accessCheck = await checkLineAccess(line, account, 'outbound', {
    callSessionId: session.id,
  });
  if (!accessCheck.allowed) {
    logger.info({ lineId, callSessionId: session.id, reason: accessCheck.reason }, 'Line access denied for test call');
    await failCallSession(session.id, mapAccessDeniedReasonToEndReason(accessCheck.reason));
    res.status(400).json({ error: 'Access denied', code: accessCheck.reason });
    return;
  }

  const publicUrl = getPublicUrl().replace(/\/$/, '');

  try {
    const callSid = await initiateOutboundCall({
      to: line.phone_e164,
      from: process.env.TWILIO_PHONE_NUMBER!,
      callbackUrl: `${publicUrl}/twilio/voice/outbound`,
      statusCallbackUrl: `${publicUrl}/twilio/status`,
      callSessionId: session.id,
    });

    logger.info({
      callSessionId: session.id,
      twilioCallSid: callSid,
      lineId,
      reason: 'test',
    }, 'Test call initiated');

    res.json({ success: true, sessionId: session.id, callSid });
  } catch (error) {
    logger.error({ error, callSessionId: session.id }, 'Failed to initiate test call');
    await failCallSession(session.id, 'error');
    res.status(500).json({ error: 'Failed to initiate test call' });
  }
});
