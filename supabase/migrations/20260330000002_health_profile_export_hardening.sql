-- =============================================================
-- Health Profile Export Hardening
-- Phase 1.6: Export visibility + authenticated download foundations
-- =============================================================

-- Step 1: Extend ultaura_data_export_requests with Health export columns.
alter table ultaura_data_export_requests
  add column if not exists visibility_scope text not null default 'standard_account'
    check (visibility_scope in ('standard_account', 'health_owner_only')),
  add column if not exists includes_health_profile boolean not null default false,
  add column if not exists requested_scope_snapshot jsonb,
  add column if not exists artifact_storage_path text,
  add column if not exists artifact_extension text,
  add column if not exists artifact_content_type text,
  add column if not exists invalidated_at timestamptz;

-- Step 2: Snapshot shape validation function.
create or replace function is_valid_health_export_scope_snapshot(payload jsonb)
returns boolean
language sql
immutable
as $$
  select
    jsonb_typeof(payload) = 'object'
    and (payload ? 'requestedFormat')
    and (payload ? 'visibilityScope')
    and (payload ? 'healthInclusionMode')
    and (payload ? 'includesHealthProfile')
    and (payload ? 'includesDocumentFiles')
    and (payload ? 'deliveredArtifactFormat')
    and (payload->>'requestedFormat') in ('json', 'csv')
    and (payload->>'visibilityScope') in ('standard_account', 'health_owner_only')
    and (payload->>'healthInclusionMode') = 'automatic_when_present'
    and jsonb_typeof(payload->'includesHealthProfile') = 'boolean'
    and jsonb_typeof(payload->'includesDocumentFiles') = 'boolean'
    and (payload->>'deliveredArtifactFormat') in ('zip', 'requested_format_native');
$$;

-- Step 3: Health document files stub (returns false until documents table exists).
create or replace function has_exportable_health_document_files(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select false;
$$;

-- Step 4: Health profile data detection (foundation-safe: conditions, medications, item_history only).
create or replace function has_exportable_health_profile_data(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from ultaura_health_conditions c
      where c.account_id = target_account_id
        and c.deleted_at is null
    )
    or exists (
      select 1
      from ultaura_health_medications m
      where m.account_id = target_account_id
        and m.deleted_at is null
    )
    or exists (
      select 1
      from ultaura_health_item_history h
      where h.account_id = target_account_id
    );
$$;

-- Step 5: Backfill existing rows before adding NOT NULL constraint.
update ultaura_data_export_requests
set requested_scope_snapshot = jsonb_build_object(
  'requestedFormat', format::text,
  'visibilityScope', 'standard_account',
  'healthInclusionMode', 'automatic_when_present',
  'includesHealthProfile', false,
  'includesDocumentFiles', false,
  'deliveredArtifactFormat', 'requested_format_native'
)
where requested_scope_snapshot is null;

-- Step 6: Now lock the column as NOT NULL.
alter table ultaura_data_export_requests
  alter column requested_scope_snapshot set not null;

-- Step 7: Add shape validation constraint.
alter table ultaura_data_export_requests
  add constraint chk_health_export_scope_snapshot_shape
  check (
    is_valid_health_export_scope_snapshot(requested_scope_snapshot)
  );

-- Step 8: Immutability enforcement trigger function.
create or replace function enforce_health_export_scope_immutability()
returns trigger
language plpgsql
as $$
begin
  if new.requested_scope_snapshot is null then
    raise exception 'export request scope invalid';
  end if;

  if (new.requested_scope_snapshot->>'requestedFormat') is distinct from new.format::text then
    raise exception 'export request scope invalid';
  end if;

  if (new.requested_scope_snapshot->>'visibilityScope') is distinct from new.visibility_scope then
    raise exception 'export request scope invalid';
  end if;

  if ((new.requested_scope_snapshot->>'includesHealthProfile')::boolean is distinct from new.includes_health_profile) then
    raise exception 'export request scope invalid';
  end if;

  if tg_op = 'INSERT' then
    if new.includes_health_profile is distinct from has_exportable_health_profile_data(new.account_id) then
      raise exception 'export request scope invalid';
    end if;

    if ((new.requested_scope_snapshot->>'includesDocumentFiles')::boolean is distinct from has_exportable_health_document_files(new.account_id)) then
      raise exception 'export request scope invalid';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if old.requested_scope_snapshot is distinct from new.requested_scope_snapshot then
      raise exception 'export request scope invalid';
    end if;

    if old.visibility_scope is distinct from new.visibility_scope then
      raise exception 'export request scope invalid';
    end if;

    if old.includes_health_profile is distinct from new.includes_health_profile then
      raise exception 'export request scope invalid';
    end if;
  end if;

  if new.includes_health_profile and new.visibility_scope <> 'health_owner_only' then
    raise exception 'export request scope invalid';
  end if;

  if new.includes_health_profile and (new.requested_scope_snapshot->>'deliveredArtifactFormat') <> 'zip' then
    raise exception 'export request scope invalid';
  end if;

  if not new.includes_health_profile and (new.requested_scope_snapshot->>'deliveredArtifactFormat') <> 'requested_format_native' then
    raise exception 'export request scope invalid';
  end if;

  if new.includes_health_profile and new.download_url is not null then
    raise exception 'export request scope invalid';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_health_export_scope_immutability on ultaura_data_export_requests;
create trigger trg_enforce_health_export_scope_immutability
before insert or update on ultaura_data_export_requests
for each row execute function enforce_health_export_scope_immutability();

-- Step 9: Replace RLS policies with dual-mode (standard_account / health_owner_only).
drop policy if exists "Users can view export requests for their accounts"
  on ultaura_data_export_requests;
drop policy if exists "Users can insert export requests for their accounts"
  on ultaura_data_export_requests;
drop policy if exists export_requests_health_owner_select
  on ultaura_data_export_requests;
drop policy if exists export_requests_health_owner_insert
  on ultaura_data_export_requests;
drop policy if exists export_requests_standard_member_insert
  on ultaura_data_export_requests;
drop policy if exists export_requests_health_owner_update
  on ultaura_data_export_requests;
drop policy if exists export_requests_health_owner_delete
  on ultaura_data_export_requests;

create policy export_requests_health_owner_select
  on ultaura_data_export_requests for select
  using (
    (
      visibility_scope = 'standard_account'
      and can_access_ultaura_account(account_id)
    ) or (
      visibility_scope = 'health_owner_only'
      and is_ultaura_account_owner(account_id)
    )
  );

create policy export_requests_standard_member_insert
  on ultaura_data_export_requests for insert
  with check (
    visibility_scope = 'standard_account'
    and can_access_ultaura_account(account_id)
    and coalesce(includes_health_profile, false) = false
  );

create policy export_requests_health_owner_insert
  on ultaura_data_export_requests for insert
  with check (
    visibility_scope = 'health_owner_only'
    and includes_health_profile = true
    and is_ultaura_account_owner(account_id)
  );
