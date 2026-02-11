-- Add lease row for onboarding maintenance scheduler

insert into ultaura_scheduler_leases (id)
values ('onboarding-maintenance')
on conflict (id) do nothing;
