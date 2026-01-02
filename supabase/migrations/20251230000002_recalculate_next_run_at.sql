-- Recalculate next_run_at values using correct timezone logic.
-- One-off schedules (COUNT=1) keep their existing date, but normalize timezone offset.

UPDATE ultaura_schedules
SET next_run_at = (
  WITH tz_now AS (
    SELECT
      id,
      timezone,
      time_of_day,
      days_of_week,
      rrule,
      next_run_at,
      (NOW() AT TIME ZONE timezone)::date AS local_date,
      (NOW() AT TIME ZONE timezone)::time AS local_time
    FROM ultaura_schedules s2
    WHERE s2.id = ultaura_schedules.id
  )
  SELECT
    CASE
      WHEN tz_now.rrule ILIKE '%COUNT=1%' AND tz_now.next_run_at IS NOT NULL
      THEN ((tz_now.next_run_at AT TIME ZONE tz_now.timezone)::date || ' ' || tz_now.time_of_day)::timestamp AT TIME ZONE tz_now.timezone
      WHEN tz_now.local_time < tz_now.time_of_day
           AND EXTRACT(DOW FROM tz_now.local_date) = ANY(tz_now.days_of_week)
      THEN (tz_now.local_date || ' ' || tz_now.time_of_day)::timestamp AT TIME ZONE tz_now.timezone
      ELSE (
        SELECT ((tz_now.local_date + i) || ' ' || tz_now.time_of_day)::timestamp AT TIME ZONE tz_now.timezone
        FROM generate_series(1, 7) AS i
        WHERE EXTRACT(DOW FROM tz_now.local_date + i) = ANY(tz_now.days_of_week)
        ORDER BY i
        LIMIT 1
      )
    END
  FROM tz_now
  WHERE tz_now.id = ultaura_schedules.id
)
WHERE enabled = true
  AND days_of_week IS NOT NULL
  AND array_length(days_of_week, 1) > 0
  AND (rrule NOT ILIKE '%COUNT=1%' OR next_run_at > NOW());

-- Update next_scheduled_call_at for lines based on the earliest upcoming schedule.
UPDATE ultaura_lines
SET next_scheduled_call_at = schedules.next_run_at
FROM (
  SELECT line_id, MIN(next_run_at) AS next_run_at
  FROM ultaura_schedules
  WHERE enabled = true
    AND next_run_at IS NOT NULL
    AND next_run_at > NOW()
  GROUP BY line_id
) AS schedules
WHERE ultaura_lines.id = schedules.line_id;

DO $$
BEGIN
  RAISE NOTICE 'Recalculated next_run_at for % schedules',
    (SELECT COUNT(*) FROM ultaura_schedules WHERE enabled = true);
END $$;
