// Twilio status callback webhook handler

import { Router, Request, Response } from 'express';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { logger } from '../server.js';
import {
  getCallSessionByTwilioSid,
  updateCallStatus,
  completeCallSession,
  failCallSession,
  updateCallSessionRecording,
} from '../services/call-session.js';
import { validateTwilioSignature } from '../utils/twilio.js';
import { updateLogContext } from '../observability/log-context.js';
// Auto-instrumented HTTP spans; use active span for correlation.
import { recordVoiceDisconnect } from '../utils/metrics.js';
import { logTelephonyEvent } from '../services/telephony-event-log.js';

export const twilioStatusRouter = Router();

type TelephonyEventSeverity = 'info' | 'warn' | 'error';

function toLogPayload(
  body: unknown,
  extras?: Record<string, unknown>,
): Record<string, unknown> {
  const normalizedBody =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : { body };

  return extras ? { ...normalizedBody, ...extras } : normalizedBody;
}

async function safeLogStatusEvent(opts: {
  eventType: string;
  accountId?: string;
  lineId?: string;
  callSessionId?: string;
  providerId?: string;
  payload: Record<string, unknown>;
  severity: TelephonyEventSeverity;
}): Promise<void> {
  try {
    await logTelephonyEvent({
      accountId: opts.accountId,
      lineId: opts.lineId,
      callSessionId: opts.callSessionId,
      providerId: opts.providerId,
      eventType: opts.eventType,
      payload: opts.payload,
      severity: opts.severity,
    });
  } catch (error) {
    logger.warn({ error, eventType: opts.eventType }, 'Failed to enqueue status telephony event log');
  }
}

// Twilio signature validation middleware
function validateTwilioWebhook(req: Request, res: Response, next: () => void) {
  if (process.env.SKIP_TWILIO_SIGNATURE_VALIDATION === 'true') {
    logger.warn('Twilio signature validation skipped (development mode)');
    next();
    return;
  }

  const signature = req.headers['x-twilio-signature'] as string;

  if (!signature) {
    logger.warn('Missing Twilio signature');
    res.status(403).send('Forbidden');
    return;
  }

  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const url = `${protocol}://${host}${req.originalUrl}`;

  const isValid = validateTwilioSignature(url, req.body, signature);

  if (!isValid) {
    logger.warn({ url }, 'Invalid Twilio signature');
    res.status(403).send('Forbidden');
    return;
  }

  next();
}

twilioStatusRouter.use(validateTwilioWebhook);

// Map Twilio call status to our internal status
function mapTwilioStatus(twilioStatus: string): 'created' | 'ringing' | 'in_progress' | 'completed' | 'failed' | 'canceled' | null {
  switch (twilioStatus) {
    case 'queued':
    case 'initiated':
      return 'created';
    case 'ringing':
      return 'ringing';
    case 'in-progress':
      return 'in_progress';
    case 'completed':
      return 'completed';
    case 'busy':
    case 'no-answer':
    case 'failed':
      return 'failed';
    case 'canceled':
      return 'canceled';
    default:
      return null;
  }
}

// Map Twilio status to end reason
function getEndReason(twilioStatus: string): 'hangup' | 'no_answer' | 'busy' | 'error' | null {
  switch (twilioStatus) {
    case 'completed':
      return 'hangup';
    case 'no-answer':
      return 'no_answer';
    case 'busy':
      return 'busy';
    case 'failed':
      return 'error';
    default:
      return null;
  }
}

// Handle Twilio status callbacks
twilioStatusRouter.post('/status', async (req: Request, res: Response) => {
  const { CallSid } = req.body;
  const providerId = typeof CallSid === 'string' ? CallSid : undefined;
  const payload = toLogPayload(req.body);
  let accountId: string | undefined;
  let lineId: string | undefined;
  let callSessionId: string | undefined;
  let eventSeverity: TelephonyEventSeverity = 'info';
  const span = trace.getActiveSpan();
  if (span && typeof CallSid === 'string') {
    span.setAttribute('twilioCallSid', CallSid);
  }
  try {
    const {
      CallStatus,
      CallDuration,
      Direction,
      Timestamp,
      ErrorCode,
      ErrorMessage,
    } = req.body;

    logger.info({
      twilioCallSid: CallSid,
      status: CallStatus,
      duration: CallDuration,
      direction: Direction,
      errorCode: ErrorCode,
    }, 'Twilio status callback');

    // Find the call session
    const session = await getCallSessionByTwilioSid(CallSid);

    if (!session) {
      // This might happen for calls we didn't create (e.g., test calls)
      logger.info({ twilioCallSid: CallSid }, 'No session found for Twilio SID');
      res.sendStatus(200);
      return;
    }

    accountId = session.account_id;
    lineId = session.line_id;
    callSessionId = session.id;

    updateLogContext({ callSessionId: session.id, twilioCallSid: CallSid });
    span?.setAttribute('callSessionId', session.id);
    logger.info({ callSessionId: session.id, twilioCallSid: CallSid }, 'Resolved call session for Twilio status');

    const internalStatus = mapTwilioStatus(CallStatus);

    if (!internalStatus) {
      eventSeverity = 'warn';
      logger.warn({ twilioCallSid: CallSid, status: CallStatus }, 'Unknown Twilio status');
      res.sendStatus(200);
      return;
    }

    // Handle status updates
    switch (internalStatus) {
      case 'ringing':
        await updateCallStatus(session.id, 'ringing');
        break;

      case 'in_progress':
        await updateCallStatus(session.id, 'in_progress', {
          connectedAt: Timestamp || new Date().toISOString(),
        });
        break;

      case 'completed': {
        const endReason = session.end_reason || getEndReason(CallStatus) || 'hangup';
        await completeCallSession(session.id, {
          endReason,
          endedAt: Timestamp || new Date().toISOString(),
        });
        recordVoiceDisconnect(session.id, 'twilio_completed');
        break;
      }

      case 'failed': {
        const endReason = getEndReason(CallStatus) || 'error';

        if (ErrorCode || ErrorMessage) {
          logger.error({
            callSessionId: session.id,
            errorCode: ErrorCode,
            errorMessage: ErrorMessage,
          }, 'Twilio call error');
        }

        if (session.status === 'in_progress' && !session.end_reason) {
          logger.warn({
            callSessionId: session.id,
            twilioCallSid: CallSid,
            status: CallStatus,
          }, 'Call ended unexpectedly while in progress');
          await completeCallSession(session.id, {
            endReason: 'error',
            endedAt: Timestamp || new Date().toISOString(),
          });
          recordVoiceDisconnect(session.id, 'twilio_failed');
          break;
        }

        await failCallSession(session.id, endReason);
        recordVoiceDisconnect(session.id, 'twilio_failed');
        break;
      }

      case 'canceled':
        await updateCallStatus(session.id, 'canceled', {
          endedAt: Timestamp || new Date().toISOString(),
        });
        recordVoiceDisconnect(session.id, 'twilio_failed');
        break;
    }

    res.sendStatus(200);
  } catch (error) {
    eventSeverity = 'error';
    span?.recordException(error as Error);
    span?.setStatus({ code: SpanStatusCode.ERROR });
    logger.error({ error }, 'Error handling status callback');
    res.sendStatus(500);
  } finally {
    void safeLogStatusEvent({
      eventType: 'twilio.voice.status.callback',
      accountId,
      lineId,
      callSessionId,
      providerId,
      payload,
      severity: eventSeverity,
    });
  }
});

// Handle Twilio recording status callbacks
twilioStatusRouter.post('/recording-status', async (req: Request, res: Response) => {
  const { CallSid } = req.body;
  const { RecordingSid } = req.body;
  const providerId = typeof RecordingSid === 'string'
    ? RecordingSid
    : (typeof CallSid === 'string' ? CallSid : undefined);
  const payload = toLogPayload(req.body);
  let accountId: string | undefined;
  let lineId: string | undefined;
  let callSessionId: string | undefined;
  let eventSeverity: TelephonyEventSeverity = 'info';
  const span = trace.getActiveSpan();
  if (span && typeof CallSid === 'string') {
    span.setAttribute('twilioCallSid', CallSid);
  }
  try {
    const { RecordingStatus } = req.body;

    logger.info({
      twilioCallSid: CallSid,
      recordingSid: RecordingSid,
      status: RecordingStatus,
    }, 'Twilio recording status callback');

    if (!CallSid || !RecordingSid) {
      res.sendStatus(200);
      return;
    }

    const session = await getCallSessionByTwilioSid(CallSid);
    if (!session) {
      logger.info({ twilioCallSid: CallSid }, 'No session found for recording callback');
      res.sendStatus(200);
      return;
    }

    accountId = session.account_id;
    lineId = session.line_id;
    callSessionId = session.id;

    updateLogContext({ callSessionId: session.id, twilioCallSid: CallSid });
    span?.setAttribute('callSessionId', session.id);

    if (session.is_test_call || session.is_preview_mode) {
      logger.info({ twilioCallSid: CallSid, callSessionId: session.id }, 'Ignoring recording callback for test/preview call');
      res.sendStatus(200);
      return;
    }

    await updateCallSessionRecording(session.id, RecordingSid);
    res.sendStatus(200);
  } catch (error) {
    eventSeverity = 'error';
    span?.recordException(error as Error);
    span?.setStatus({ code: SpanStatusCode.ERROR });
    logger.error({ error }, 'Error handling recording status callback');
    res.sendStatus(500);
  } finally {
    void safeLogStatusEvent({
      eventType: 'twilio.voice.recording_status.callback',
      accountId,
      lineId,
      callSessionId,
      providerId,
      payload,
      severity: eventSeverity,
    });
  }
});
