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
