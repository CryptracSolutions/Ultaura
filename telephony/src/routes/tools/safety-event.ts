import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getCallSession, recordCallEvent, recordSafetyEvent } from '../../services/call-session.js';
import { markSafetyTier, wasBackstopTriggered } from '../../services/safety-state.js';
import { getSupabaseClient } from '../../utils/supabase.js';
import { sendSms } from '../../utils/twilio.js';

export const safetyEventRouter = Router();

// Notify trusted contacts for high-tier safety events
async function notifyTrustedContacts(
  lineId: string,
  tier: string,
  actionTaken: string
): Promise<void> {
  const supabase = getSupabaseClient();

  try {
    // Check for trusted_contact_notify consent
    const { data: consent } = await supabase
      .from('ultaura_consents')
      .select('granted')
      .eq('line_id', lineId)
      .eq('type', 'trusted_contact_notify')
      .eq('granted', true)
      .is('revoked_at', null)
      .maybeSingle();

    if (!consent) {
      logger.info({ lineId }, 'No trusted contact consent found, skipping notification');
      return;
    }

    // Get enabled trusted contacts for this line
    const { data: contacts } = await supabase
      .from('ultaura_trusted_contacts')
      .select('id, name, phone_e164, notify_on')
      .eq('line_id', lineId)
      .eq('enabled', true);

    if (!contacts || contacts.length === 0) {
      logger.info({ lineId }, 'No enabled trusted contacts found');
      return;
    }

    // Filter to contacts who want high-tier notifications
    const contactsToNotify = contacts.filter(
      (c) => c.notify_on && Array.isArray(c.notify_on) && c.notify_on.includes('high')
    );

    if (contactsToNotify.length === 0) {
      logger.info({ lineId }, 'No contacts configured for high-tier notifications');
      return;
    }

    // Get line info for personalized message
    const { data: line } = await supabase
      .from('ultaura_lines')
      .select('display_name')
      .eq('id', lineId)
      .single();

    const lovedOneName = line?.display_name || 'Your loved one';

    // Send SMS to each contact
    for (const contact of contactsToNotify) {
      try {
        const message = `Ultaura safety alert: ${lovedOneName} may need support. Action taken: ${actionTaken === 'suggested_988' ? 'Suggested calling 988 crisis line' : actionTaken === 'suggested_911' ? 'Suggested calling 911' : 'Provided support'}. Please check in with them.`;

        await sendSms({
          to: contact.phone_e164,
          body: message,
        });

        logger.info(
          { contactId: contact.id, lineId, tier },
          'Notified trusted contact of safety event'
        );
      } catch (smsError) {
        logger.error(
          { error: smsError, contactId: contact.id, lineId },
          'Failed to send SMS to trusted contact'
        );
      }
    }
  } catch (error) {
    logger.error({ error, lineId }, 'Error notifying trusted contacts');
  }
}

safetyEventRouter.post('/', async (req: Request, res: Response) => {
  try {
    const {
      callSessionId,
      lineId,
      tier,
      signals,
      actionTaken,
      source = 'model',
    } = req.body;

    if (!callSessionId || !lineId) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    const accountId = session.account_id;

    const sourceValue = source === 'keyword_backstop' ? 'keyword_backstop' : 'model';
    const backstopWasTriggered =
      sourceValue === 'model' ? wasBackstopTriggered(callSessionId, tier) : false;

    logger.info({
      event: sourceValue === 'keyword_backstop' ? 'safety_backstop_triggered' : 'safety_model_confirmed',
      callSessionId,
      lineId,
      tier,
      source: sourceValue,
      backstopWasTriggered: sourceValue === 'model' ? backstopWasTriggered : undefined,
      timestamp: Date.now(),
    }, `Safety event logged via ${sourceValue}`);

    markSafetyTier(callSessionId, tier, sourceValue);

    await recordSafetyEvent({
      accountId,
      lineId,
      callSessionId,
      tier,
      signals: {
        description: signals,
        source: sourceValue,
      },
      actionTaken,
    });
    await recordCallEvent(
      callSessionId,
      'tool_call',
      {
        tool: 'log_safety_concern',
        success: true,
        tier,
        actionTaken,
      },
      { skipDebugLog: true }
    );

    // For high-tier events, notify trusted contacts
    if (tier === 'high' && sourceValue === 'model') {
      logger.warn({ callSessionId, lineId, tier, actionTaken }, 'HIGH SAFETY TIER EVENT');
      // Run notification in background to not block the response
      notifyTrustedContacts(lineId, tier, actionTaken).catch((error) => {
        logger.error({ error, lineId }, 'Background trusted contact notification failed');
      });
    }

    res.json({ success: true, message: 'Safety concern logged' });
  } catch (error) {
    logger.error({ error }, 'Error logging safety event');
    res.status(500).json({ error: 'Failed to log safety event' });
  }
});
