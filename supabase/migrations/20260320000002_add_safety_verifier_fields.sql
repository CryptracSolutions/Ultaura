-- Extend ultaura_safety_events.signals JSONB with verifier metadata and indexes.

COMMENT ON COLUMN ultaura_safety_events.signals IS 'Extended signals including:
  - source: "model" | "keyword_backstop" | "sweep" | "soft_signal"
  - verifier_result: "confirm" | "clear" | "uncertain" (null if not verified)
  - verifier_latency_ms: number (null if not verified)
  - imminent_risk: boolean (null if not assessed)
  - has_plan_or_means: boolean (null if not assessed)
  - rationale_codes: string[] (empty if not assessed)
  - context_window_stats: { turns: number, chars: number } (null if not captured)
';

CREATE INDEX IF NOT EXISTS idx_ultaura_safety_events_verifier_result
ON ultaura_safety_events((signals->>'verifier_result'), created_at DESC)
WHERE signals->>'verifier_result' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ultaura_safety_events_high_tier_unverified
ON ultaura_safety_events(created_at DESC)
WHERE tier = 'high' AND (signals->>'verifier_result') IS NULL;
