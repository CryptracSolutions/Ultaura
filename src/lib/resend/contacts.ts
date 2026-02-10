import 'server-only';

import { getResendClient } from './client';
import { getResendSegmentId } from './topics';

function is404(err: unknown): boolean {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    return (err as { statusCode: number }).statusCode === 404;
  }
  return false;
}

/**
 * Create a pending Resend contact (no segment, all topics opt_out, unsubscribed=true).
 * Returns the Resend contact ID.
 */
export async function createPendingContact(
  email: string,
  firstName: string | null,
  source: string,
): Promise<string> {
  const resend = getResendClient();
  const { data, error } = await resend.contacts.create({
    email,
    firstName: firstName || undefined,
    unsubscribed: true,
    audienceId: getResendSegmentId(),
  });
  if (error) throw new Error(`Resend contact create failed: ${error.message}`);
  return data!.id;
}

/**
 * Ensure a Resend contact exists. Handles stale/missing IDs gracefully.
 * If resendContactId is stale (404), creates a new contact.
 * Returns the current valid Resend contact ID.
 */
export async function ensureResendContact(
  email: string,
  firstName: string | null,
  resendContactId: string | null,
): Promise<string> {
  const resend = getResendClient();
  const audienceId = getResendSegmentId();

  if (resendContactId) {
    try {
      await resend.contacts.update({
        id: resendContactId,
        audienceId,
      });
      return resendContactId;
    } catch (err) {
      if (!is404(err)) throw err;
      // Fall through to create
    }
  }

  const { data, error } = await resend.contacts.create({
    email,
    firstName: firstName || undefined,
    unsubscribed: true,
    audienceId,
  });
  if (error) throw new Error(`Resend contact create failed: ${error.message}`);
  return data!.id;
}

/**
 * Confirm a contact: set unsubscribed=false and apply topic preferences.
 * Called after double opt-in confirmation succeeds.
 */
export async function confirmResendContact(
  resendContactId: string,
  email: string,
  firstName: string | null,
): Promise<string> {
  const resend = getResendClient();
  const audienceId = getResendSegmentId();

  try {
    await resend.contacts.update({
      id: resendContactId,
      audienceId,
      unsubscribed: false,
    });
    return resendContactId;
  } catch (err) {
    if (!is404(err)) throw err;
    // Contact was deleted from Resend, recreate
    const { data, error } = await resend.contacts.create({
      email,
      firstName: firstName || undefined,
      unsubscribed: false,
      audienceId,
    });
    if (error) throw new Error(`Resend contact create failed: ${error.message}`);
    return data!.id;
  }
}

/**
 * Mark a contact as unsubscribed in Resend.
 */
export async function unsubscribeResendContact(resendContactId: string): Promise<void> {
  const resend = getResendClient();
  const audienceId = getResendSegmentId();
  try {
    await resend.contacts.update({
      id: resendContactId,
      audienceId,
      unsubscribed: true,
    });
  } catch (err) {
    if (!is404(err)) throw err;
    // Already gone from Resend, nothing to do
  }
}
