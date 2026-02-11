-- Seed persisted checkpoint row for onboarding reconciliation sweeps.

insert into ultaura_system_settings (key, value)
values (
  'onboarding_reconcile_checkpoint',
  '{"checkpoint": null, "updated_at": null}'::jsonb
)
on conflict (key) do nothing;
