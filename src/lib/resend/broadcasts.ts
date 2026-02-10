import 'server-only';

import { getResendClient } from './client';
import {
  getResendSegmentId,
  getResendFromEmail,
  getTopicId,
  type TopicKey,
} from './topics';

export async function createBroadcast(params: {
  subject: string;
  previewText?: string;
  html: string;
  topicKey: TopicKey;
}) {
  const resend = getResendClient() as any;
  const audienceId = getResendSegmentId();
  const topicId = getTopicId(params.topicKey);
  const payload = {
    audience_id: audienceId,
    from: getResendFromEmail(),
    subject: params.subject,
    ...(params.previewText !== undefined ? { preview_text: params.previewText } : {}),
    html: params.html,
    topic_id: topicId,
    tags: [
      {
        name: 'topic_key',
        value: params.topicKey,
      },
    ],
  };

  return resend.post('/broadcasts', payload);
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
