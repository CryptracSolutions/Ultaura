import 'server-only';

import { getResendClient } from './client';
import { getResendSegmentId, getResendFromEmail, type TopicKey } from './topics';

/**
 * Create a Resend broadcast for the newsletter audience.
 * Note: `topicKey` is accepted for future use but Resend broadcasts
 * send to the full audience. Topic filtering is handled by Resend
 * internally based on each contact's topic preferences.
 */
export async function createBroadcast(params: {
  subject: string;
  previewText?: string;
  html: string;
  topicKey: TopicKey;
}) {
  const resend = getResendClient();
  return resend.broadcasts.create({
    audienceId: getResendSegmentId(),
    from: getResendFromEmail(),
    subject: params.subject,
    previewText: params.previewText,
    html: params.html,
  });
}

export async function sendBroadcast(broadcastId: string) {
  const resend = getResendClient();
  return resend.broadcasts.send(broadcastId);
}

export async function scheduleBroadcast(broadcastId: string, scheduledAt: string) {
  const resend = getResendClient();
  return resend.broadcasts.send(broadcastId, { scheduledAt });
}

export async function listBroadcasts() {
  const resend = getResendClient();
  return resend.broadcasts.list();
}

export async function getBroadcast(broadcastId: string) {
  const resend = getResendClient();
  return resend.broadcasts.get(broadcastId);
}

export async function removeBroadcast(broadcastId: string) {
  const resend = getResendClient();
  return resend.broadcasts.remove(broadcastId);
}
