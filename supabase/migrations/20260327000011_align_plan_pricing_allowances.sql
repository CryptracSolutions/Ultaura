-- Align plan pricing/allowances with runtime constants.

with plan_updates (
  id,
  monthly_price_cents,
  annual_price_cents,
  minutes_included,
  reminders_per_line
) as (
  values
    ('care', 1900, 18000, 200, 5),
    ('comfort', 4900, 47000, 600, 10),
    ('family', 9900, 95000, 1200, null::integer)
)
update ultaura_plans as p
set
  monthly_price_cents = u.monthly_price_cents,
  annual_price_cents = u.annual_price_cents,
  minutes_included = u.minutes_included,
  reminders_per_line = u.reminders_per_line
from plan_updates as u
where p.id = u.id
  and (
    p.monthly_price_cents is distinct from u.monthly_price_cents
    or p.annual_price_cents is distinct from u.annual_price_cents
    or p.minutes_included is distinct from u.minutes_included
    or p.reminders_per_line is distinct from u.reminders_per_line
  );

-- Trial limits are plan-driven; keep free_trial reminder limit aligned.
update ultaura_plans
set reminders_per_line = 5
where id = 'free_trial'
  and reminders_per_line is distinct from 5;

with account_minute_updates (plan_id, minutes_included) as (
  values
    ('care', 200),
    ('comfort', 600),
    ('family', 1200)
)
update ultaura_accounts as a
set minutes_included = u.minutes_included
from account_minute_updates as u
where a.plan_id = u.plan_id
  and a.status in ('active', 'trial', 'past_due')
  and a.minutes_included is distinct from u.minutes_included;
