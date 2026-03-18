-- Lock search_path on all public functions that lack it.
-- Prevents search-path hijacking, especially on SECURITY DEFINER functions.
-- See: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- ============================================
-- SECURITY DEFINER functions (highest priority)
-- ============================================

-- Memory upsert — two overloads (14-param and 15-param)
ALTER FUNCTION public.upsert_ultaura_memory(uuid, uuid, ultaura_memory_type, text, bytea, bytea, bytea, text, text, numeric, text, ultaura_privacy_scope, text, uuid)
  SET search_path = public;
ALTER FUNCTION public.upsert_ultaura_memory(uuid, uuid, ultaura_memory_type, text, bytea, bytea, bytea, text, text, numeric, text, ultaura_privacy_scope, text, uuid, uuid)
  SET search_path = public;

-- Memory semantic search
ALTER FUNCTION public.match_memories_semantic(uuid, vector, int, float, float)
  SET search_path = public;

-- Memory access tracking
ALTER FUNCTION public.mark_memory_accessed(uuid)
  SET search_path = public;

-- Memory pinning
ALTER FUNCTION public.pin_memory(uuid, text)
  SET search_path = public;

-- Memory decay
ALTER FUNCTION public.calculate_memory_decay(uuid, numeric, numeric)
  SET search_path = public;
ALTER FUNCTION public.apply_memory_decay(uuid, numeric, numeric)
  SET search_path = public;

-- Memory deletion
ALTER FUNCTION public.delete_ultaura_memories_for_key(uuid, uuid, text)
  SET search_path = public;

-- Retention cleanup chain
ALTER FUNCTION public.get_retention_cutoff(uuid)
  SET search_path = public;
ALTER FUNCTION public.cleanup_account_retention(uuid)
  SET search_path = public;
ALTER FUNCTION public.run_retention_cleanup()
  SET search_path = public;

-- Account creation & usage
ALTER FUNCTION public.create_ultaura_account(bigint, text, text, uuid)
  SET search_path = public;
ALTER FUNCTION public.update_ultaura_account_usage(uuid)
  SET search_path = public;

-- Privacy/consent trigger functions
ALTER FUNCTION public.create_privacy_settings_for_account()
  SET search_path = public;
ALTER FUNCTION public.create_voice_consent_for_line()
  SET search_path = public;
ALTER FUNCTION public.create_topic_exclusions_for_line()
  SET search_path = public;
ALTER FUNCTION public.create_insight_privacy_for_line()
  SET search_path = public;

-- Health profile triggers & validators
ALTER FUNCTION public.enforce_health_consent_line_type_rules()
  SET search_path = public;
ALTER FUNCTION public.enforce_health_export_scope_immutability()
  SET search_path = public;
ALTER FUNCTION public.is_valid_health_export_scope_snapshot(jsonb)
  SET search_path = public;
ALTER FUNCTION public.normalize_ultaura_reminder_pause_sources()
  SET search_path = public;
ALTER FUNCTION public.enforce_health_reminder_source_context()
  SET search_path = public;
ALTER FUNCTION public.enforce_health_medication_link_source_context()
  SET search_path = public;

-- ============================================
-- SECURITY INVOKER functions (best practice)
-- ============================================

-- Auth/role helpers
ALTER FUNCTION public.assert_service_role()
  SET search_path = public;
ALTER FUNCTION public.can_update_user_role(bigint)
  SET search_path = public;
ALTER FUNCTION public.can_update_user_role(bigint, bigint)
  SET search_path = public;
ALTER FUNCTION public.get_role_for_authenticated_user(bigint)
  SET search_path = public;
ALTER FUNCTION public.get_role_for_user(bigint)
  SET search_path = public;
ALTER FUNCTION public.current_user_is_member_of_organization(bigint)
  SET search_path = public;

-- Ultaura access helper
ALTER FUNCTION public.can_access_ultaura_account(uuid)
  SET search_path = public;

-- Usage & billing helpers
ALTER FUNCTION public.get_ultaura_minutes_remaining(uuid)
  SET search_path = public;
ALTER FUNCTION public.get_ultaura_usage_summary(uuid)
  SET search_path = public;
ALTER FUNCTION public.is_ultaura_trial_active(uuid)
  SET search_path = public;
ALTER FUNCTION public.get_ultaura_line_usage(uuid)
  SET search_path = public;
ALTER FUNCTION public.get_ultaura_per_line_usage(uuid)
  SET search_path = public;
ALTER FUNCTION public.get_ultaura_total_usage(uuid)
  SET search_path = public;
ALTER FUNCTION public.get_ultaura_monthly_usage(uuid)
  SET search_path = public;

-- Document/feedback search
ALTER FUNCTION public.match_documents(vector, int, jsonb)
  SET search_path = public;
ALTER FUNCTION public.match_feedback_submissions(vector(384), float, int)
  SET search_path = public;

-- Newsletter & rate limiting
ALTER FUNCTION public.check_newsletter_rate_limit(text, timestamptz)
  SET search_path = public;
ALTER FUNCTION public.cleanup_old_rate_limit_events()
  SET search_path = public;
ALTER FUNCTION public.prune_newsletter_operational_data()
  SET search_path = public;

-- Notification limits
ALTER FUNCTION public.check_notification_recipient_limit()
  SET search_path = public;
ALTER FUNCTION public.check_notification_recipient_limit_on_reactivate()
  SET search_path = public;

-- Schedule helpers
ALTER FUNCTION public.is_line_on_vacation(uuid)
  SET search_path = public;
ALTER FUNCTION public.ultaura_validate_schedule_exception_scope()
  SET search_path = public;

-- Memory topic categorizer (IMMUTABLE, no table access, but silences linter)
ALTER FUNCTION public.categorize_memory_topic(text, text, ultaura_memory_type)
  SET search_path = public;
