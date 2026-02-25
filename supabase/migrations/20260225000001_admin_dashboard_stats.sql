CREATE OR REPLACE FUNCTION public.get_admin_platform_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  result json;
  month_start timestamptz := date_trunc('month', now());
BEGIN
  SELECT json_build_object(
    'overage_payg_revenue_cents', (
      SELECT COALESCE(SUM(l.billable_minutes), 0) * 15
      FROM public.ultaura_minute_ledger AS l
      WHERE l.created_at >= month_start
        AND l.billable_type IN ('overage', 'payg')
    ),
    'monthly_subscribers', (
      SELECT COUNT(*)
      FROM public.ultaura_subscriptions AS s
      WHERE s.status = 'active' AND s.billing_interval = 'month'
    ),
    'annual_subscribers', (
      SELECT COUNT(*)
      FROM public.ultaura_subscriptions AS s
      WHERE s.status = 'active' AND s.billing_interval = 'year'
    ),
    'pending_cancellations', (
      SELECT COUNT(*)
      FROM public.ultaura_subscriptions AS s
      WHERE s.status = 'active' AND s.cancel_at_period_end
    ),
    'plan_distribution', (
      SELECT COALESCE(json_agg(row_to_json(pd)), '[]'::json)
      FROM (
        SELECT a.plan_id, COUNT(*) AS account_count
        FROM public.ultaura_accounts AS a
        WHERE a.status IN ('trial', 'active')
        GROUP BY a.plan_id
        ORDER BY COUNT(*) DESC
      ) AS pd
    ),
    'minutes_used_this_month', (
      SELECT COALESCE(SUM(l.billable_minutes), 0)
      FROM public.ultaura_minute_ledger AS l
      WHERE l.created_at >= month_start
    ),
    'minutes_allotted', (
      SELECT COALESCE(SUM(a.minutes_included), 0)
      FROM public.ultaura_accounts AS a
      WHERE a.status IN ('trial', 'active')
    ),
    'active_lines', (
      SELECT COUNT(*)
      FROM public.ultaura_lines AS l
      WHERE l.status = 'active'
    ),
    'total_lines', (
      SELECT COUNT(*)
      FROM public.ultaura_lines
    ),
    'calls_this_month', (
      SELECT COUNT(*)
      FROM public.ultaura_call_sessions AS c
      WHERE c.created_at >= month_start
    ),
    'calls_answered_this_month', (
      SELECT COUNT(*)
      FROM public.ultaura_call_sessions AS c
      WHERE c.created_at >= month_start
        AND c.status IN ('in_progress', 'completed')
        AND (c.end_reason IS NULL OR c.end_reason NOT IN ('no_answer', 'busy'))
    ),
    'avg_call_duration_seconds', (
      SELECT COALESCE(AVG(c.seconds_connected), 0)
      FROM public.ultaura_call_sessions AS c
      WHERE c.created_at >= month_start
        AND c.status = 'completed'
        AND c.seconds_connected > 0
    ),
    'twilio_costs_cents', (
      SELECT COALESCE(SUM(c.cost_estimate_cents_twilio), 0)
      FROM public.ultaura_call_sessions AS c
      WHERE c.created_at >= month_start
    ),
    'model_costs_cents', (
      SELECT COALESCE(SUM(c.cost_estimate_cents_model), 0)
      FROM public.ultaura_call_sessions AS c
      WHERE c.created_at >= month_start
    )
  ) INTO result;

  RETURN result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_admin_platform_stats() FROM public;
REVOKE ALL ON FUNCTION public.get_admin_platform_stats() FROM anon;
REVOKE ALL ON FUNCTION public.get_admin_platform_stats() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_platform_stats() TO service_role;
