import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { recordSafetyEvent } from '../../services/call-session.js';
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
    const { callSessionId, lineId, accountId, tier, signals, actionTaken } = req.body;

    await recordSafetyEvent({
      accountId,
      lineId,
      callSessionId,
      tier,
      signals: { description: signals },
      actionTaken,
    });

    // For high-tier events, notify trusted contacts
    if (tier === 'high') {
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
