-- Newsletter feature: subscribers, topic subscriptions, webhook events
-- All tables are SERVICE ROLE ONLY (no RLS policies = anon/authenticated get zero rows)

CREATE EXTENSION IF NOT EXISTS citext;

-- 1. Subscribers
CREATE TABLE ultaura_newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT NOT NULL UNIQUE,
  first_name TEXT,

  source TEXT NOT NULL DEFAULT 'unknown',
  source_url TEXT,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'unsubscribed', 'expired_pending')),

  confirmation_token_hash TEXT,
  confirmation_token_expires_at TIMESTAMPTZ,
  confirmation_token_consumed_at TIMESTAMPTZ,

  confirmed_at TIMESTAMPTZ,

  consent_ip INET,
  consent_user_agent TEXT,
  consent_timestamp TIMESTAMPTZ,
  confirmation_ip INET,
  confirmation_user_agent TEXT,

  pending_topics JSONB DEFAULT '["blog_digest","elder_care_tips","product_updates"]'::jsonb,

  resend_contact_id TEXT,

  unsubscribed_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  complained_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_newsletter_token_hash ON ultaura_newsletter_subscribers (confirmation_token_hash)
  WHERE confirmation_token_hash IS NOT NULL;
CREATE INDEX idx_newsletter_status ON ultaura_newsletter_subscribers (status);
CREATE INDEX idx_newsletter_resend_contact ON ultaura_newsletter_subscribers (resend_contact_id)
  WHERE resend_contact_id IS NOT NULL;

ALTER TABLE ultaura_newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- 2. Topic subscriptions
CREATE TABLE ultaura_newsletter_topic_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id UUID NOT NULL REFERENCES ultaura_newsletter_subscribers(id) ON DELETE CASCADE,
  topic_key TEXT NOT NULL
    CHECK (topic_key IN ('blog_digest', 'elder_care_tips', 'product_updates')),
  subscribed BOOLEAN NOT NULL DEFAULT true,
  subscribed_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_subscriber_topic UNIQUE (subscriber_id, topic_key)
);

CREATE INDEX idx_topic_subs_subscriber ON ultaura_newsletter_topic_subscriptions (subscriber_id);
CREATE INDEX idx_topic_subs_active ON ultaura_newsletter_topic_subscriptions (topic_key)
  WHERE subscribed = true;

ALTER TABLE ultaura_newsletter_topic_subscriptions ENABLE ROW LEVEL SECURITY;

-- 3. Webhook events (idempotency)
CREATE TABLE ultaura_newsletter_webhook_events (
  svix_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'processed', 'failed')),
  error_message TEXT,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_webhook_events_claimed_at ON ultaura_newsletter_webhook_events (claimed_at);

ALTER TABLE ultaura_newsletter_webhook_events ENABLE ROW LEVEL SECURITY;
