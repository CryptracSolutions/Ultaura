-- Newsletter hardening: topic filter index and operational retention cleanup.

CREATE INDEX IF NOT EXISTS idx_newsletter_topic_subscriptions_topic_subscriber_active
  ON ultaura_newsletter_topic_subscriptions (topic_key, subscriber_id)
  WHERE subscribed = true;

CREATE INDEX IF NOT EXISTS idx_newsletter_webhook_events_completed_at
  ON ultaura_newsletter_webhook_events (completed_at)
  WHERE completed_at IS NOT NULL;

CREATE OR REPLACE FUNCTION prune_newsletter_operational_data()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM ultaura_newsletter_rate_limits
  WHERE window_start < now() - interval '7 days';

  DELETE FROM ultaura_newsletter_webhook_events
  WHERE completed_at IS NOT NULL
    AND completed_at < now() - interval '30 days';
END;
$$;
