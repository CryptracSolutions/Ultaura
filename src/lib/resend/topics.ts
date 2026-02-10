import 'server-only';

export const TOPIC_KEYS = ['blog_digest', 'elder_care_tips', 'product_updates'] as const;
export type TopicKey = (typeof TOPIC_KEYS)[number];

export const TOPIC_LABELS: Record<TopicKey, string> = {
  blog_digest: 'Blog Digest',
  elder_care_tips: 'Elder Care Tips',
  product_updates: 'Product Updates',
};

export const TOPIC_DESCRIPTIONS: Record<TopicKey, string> = {
  blog_digest: 'New articles on elder care, delivered to your inbox',
  elder_care_tips: 'Weekly tips for caring for aging parents',
  product_updates: 'Ultaura feature updates and news',
};

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
