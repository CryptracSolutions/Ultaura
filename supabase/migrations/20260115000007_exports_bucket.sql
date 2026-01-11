-- Storage bucket for data exports

insert into storage.buckets (id, name, public)
  values ('ultaura-exports', 'ultaura-exports', false)
  on conflict (id) do nothing;
