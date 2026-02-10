-- Rate limiting table for newsletter endpoints
CREATE TABLE IF NOT EXISTS ultaura_newsletter_rate_limits (
  ip TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INT NOT NULL DEFAULT 1,
  PRIMARY KEY (ip, window_start)
);

CREATE INDEX idx_newsletter_rate_limits_window
  ON ultaura_newsletter_rate_limits (window_start);

-- No RLS needed — only accessed via admin/service client
ALTER TABLE ultaura_newsletter_rate_limits ENABLE ROW LEVEL SECURITY;

-- Atomic check-and-increment: returns the new count after incrementing.
-- Uses INSERT ... ON CONFLICT to avoid race conditions.
CREATE OR REPLACE FUNCTION check_newsletter_rate_limit(
  p_ip TEXT,
  p_window_start TIMESTAMPTZ
)
RETURNS INT
LANGUAGE sql
AS $$
  INSERT INTO ultaura_newsletter_rate_limits (ip, window_start, request_count)
  VALUES (p_ip, p_window_start, 1)
  ON CONFLICT (ip, window_start)
  DO UPDATE SET request_count = ultaura_newsletter_rate_limits.request_count + 1
  RETURNING request_count;
$$;
