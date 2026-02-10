import 'server-only';

import { TOPIC_KEYS, type TopicKey } from './topic-metadata';
export { TOPIC_KEYS, TOPIC_LABELS, TOPIC_DESCRIPTIONS, type TopicKey } from './topic-metadata';

function getTopicId(key: TopicKey): string {
  const envMap: Record<TopicKey, string> = {
    blog_digest: 'RESEND_TOPIC_BLOG_DIGEST_ID',
    elder_care_tips: 'RESEND_TOPIC_ELDER_CARE_TIPS_ID',
    product_updates: 'RESEND_TOPIC_PRODUCT_UPDATES_ID',
  };
  const id = process.env[envMap[key]];
  if (!id) throw new Error(`Missing env var ${envMap[key]}`);
  return id;
}

export function getResendSegmentId(): string {
  const id = process.env.RESEND_SEGMENT_ID;
  if (!id) throw new Error('Missing RESEND_SEGMENT_ID');
  return id;
}

export function getResendFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL || 'Ultaura <newsletter@ultaura.com>';
}

/** Build topics array for Resend API. All opt_out by default. */
export function buildAllTopicsOptOut() {
  return TOPIC_KEYS.map((key) => ({
    id: getTopicId(key),
    subscription: 'opt_out' as const,
  }));
}

/** Build topics array with specific keys opted in. */
export function buildTopicsForSelection(selectedKeys: TopicKey[]) {
  return TOPIC_KEYS.map((key) => ({
    id: getTopicId(key),
    subscription: selectedKeys.includes(key) ? ('opt_in' as const) : ('opt_out' as const),
  }));
}

export { getTopicId };
