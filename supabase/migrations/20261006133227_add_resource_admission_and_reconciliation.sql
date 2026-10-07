-- Local hardening: owner-context admission, bounded work and immutable paths.
begin;
create table private.resource_controls (
  singleton boolean primary key default true check (singleton),
  initialized boolean not null default false,
  writes_enabled boolean not null default false,
  generation_enabled boolean not null default false,
  uploads_enabled boolean not null default false,
  images_enabled boolean not null default false
);
insert into private.resource_controls(singleton) values (true);
create table private.resource_limits (
  action text primary key check (action in ('story','edit','generation','asset','image')),
  owner_limit integer not null check (owner_limit between 1 and 100000),
  global_limit integer not null check (global_limit between 1 and 1000000),
  window_seconds integer not null check (window_seconds in (60,86400))
);
insert into private.resource_limits values ('story',20,500,86400),('edit',120,1200,60),('generation',20,100,86400),('asset',10,200,86400),('image',120,1200,60);
create table private.resource_usage (
  action text not null references private.resource_limits(action),
  subject text not null,
  window_start timestamptz not null,
  used integer not null check (used > 0),
  primary key(action,subject,window_start)
);
create index resource_usage_expiry_idx on private.resource_usage(window_start);
create table private.image_processing_leases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  expires_at timestamptz not null default (clock_timestamp() + interval '60 seconds')
);
create index image_processing_leases_owner_idx on private.image_processing_leases(owner_id,expires_at);
create table private.generation_execution_leases (
  job_id uuid primary key,
  owner_id uuid not null,
  expires_at timestamptz not null
);
create index generation_execution_leases_owner_idx on private.generation_execution_leases(owner_id,expires_at);
-- No FK cascade: deleting a story/account must not free work still executing.
create table private.asset_paths (
  storage_path text primary key,
  owner_id uuid not null,
  retired_at timestamptz
);
insert into private.asset_paths(storage_path,owner_id)
  select a.storage_path,s.owner_id from public.assets a join public.stories s on s.id=a.story_id;
alter table private.resource_controls enable row level security;
alter table private.resource_limits enable row level security;
alter table private.resource_usage enable row level security;
alter table private.image_processing_leases enable row level security;
alter table private.generation_execution_leases enable row level security;
alter table private.asset_paths enable row level security;
revoke all on private.resource_controls,private.resource_limits,private.resource_usage,private.image_processing_leases,private.generation_execution_leases,private.asset_paths from public,anon,authenticated,service_role;

-- Serialize short admissions on one private row. No network I/O occurs in these
-- transactions. Fixed UTC windows bound successful issuance, not failed traffic.
create function private.admit_resource(p_action text,p_owner uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare controls private.resource_controls; limits private.resource_limits; bucket timestamptz; subject_key text; cap integer;
begin
  if p_owner is null or p_owner is distinct from auth.uid() then raise exception 'Resource unavailable' using errcode='42501'; end if;
  select * into controls from private.resource_controls where singleton for update;
  if not found or not controls.initialized or
    (p_action in ('story','edit') and not controls.writes_enabled) or
    (p_action='generation' and not controls.generation_enabled) or
    (p_action='asset' and not controls.uploads_enabled) or
    (p_action='image' and not controls.images_enabled) then
    raise exception 'This operation is temporarily paused' using errcode='PT503';
  end if;
  select * into limits from private.resource_limits where action=p_action;
  if not found then raise exception 'Invalid resource action' using errcode='22023'; end if;
  bucket := to_timestamp(floor(extract(epoch from statement_timestamp()) / limits.window_seconds) * limits.window_seconds);
  foreach subject_key in array array['global',p_owner::text] loop
    cap := case when subject_key='global' then limits.global_limit else limits.owner_limit end;
    insert into private.resource_usage(action,subject,window_start,used) values(p_action,subject_key,bucket,1)
      on conflict(action,subject,window_start) do update set used=private.resource_usage.used+1
      where private.resource_usage.used < cap;
    if not found then raise exception 'Resource limit reached. Please try later.' using errcode='PT429'; end if;
  end loop;
end;
$$;
revoke all on function private.admit_resource(text,uuid) from public,anon,authenticated,service_role;

create function private.admit_story_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Actual SQL session role, never current_user inside a definer or JWT claims.
  -- Privileged migrations/seed/operator fixtures are not application requests.
  if current_setting('role') in ('none','postgres','supabase_admin') then return new; end if;
  if tg_op='INSERT' then
    perform private.admit_resource('story',new.owner_id);
    if (select count(*) from public.stories) >= 1000 or (select count(*) from public.stories where owner_id=new.owner_id) >= 50 then
      raise exception 'Story capacity reached. Remove a story before creating another.' using errcode='PT429';
    end if;
  elsif (new.title,new.child_name,new.prompt) is distinct from (old.title,old.child_name,old.prompt) then
    perform private.admit_resource('edit',new.owner_id);
  end if;
  return new;
end;
$$;
revoke all on function private.admit_story_write() from public,anon,authenticated,service_role;
create trigger story_resource_admission before insert or update on public.stories for each row execute function private.admit_story_write();

create function private.admit_generation_work() returns trigger
language plpgsql security definer set search_path = '' as $$
declare owner uuid;
begin
  if tg_op='UPDATE' and new.status in ('complete','failed') then
    delete from private.generation_execution_leases where job_id=new.id;
    return new;
  end if;
  if current_setting('role') in ('none','postgres','supabase_admin') then return new; end if;
  select owner_id into owner from public.stories where id=new.story_id and owner_id=auth.uid();
  if owner is null then raise exception 'Story unavailable' using errcode='42501'; end if;
  if tg_op='INSERT' then
    perform private.admit_resource('generation',owner);
  elsif new.status='generating' and old.status='queued' then
    perform 1 from private.resource_controls where singleton and initialized and generation_enabled for update;
    if not found then raise exception 'This operation is temporarily paused' using errcode='PT503'; end if;
    delete from private.generation_execution_leases where expires_at <= clock_timestamp();
    if (select count(*) from private.generation_execution_leases) >= 8 or (select count(*) from private.generation_execution_leases where owner_id=owner) >= 3 then
      raise exception 'Generation capacity is busy. Please try later.' using errcode='PT429';
    end if;
    insert into private.generation_execution_leases(job_id,owner_id,expires_at) values(new.id,owner,new.lease_expires_at);
  end if;
  return new;
end;
$$;
revoke all on function private.admit_generation_work() from public,anon,authenticated,service_role;
create trigger generation_resource_admission before insert or update on public.generation_jobs for each row execute function private.admit_generation_work();

create function private.reserve_asset_path() returns trigger
language plpgsql security definer set search_path = '' as $$
declare owner uuid;
begin
  select owner_id into owner from public.stories where id=new.story_id;
  if current_setting('role') not in ('none','postgres','supabase_admin') then
    if owner is distinct from auth.uid() or split_part(new.storage_path,'/',1) is distinct from auth.uid()::text or new.kind <> 'hero' then
      raise exception 'Image unavailable' using errcode='42501';
    end if;
    perform private.admit_resource('asset',owner);
  end if;
  -- Table constraints and parent FK still validate invalid privileged fixtures.
  if owner is not null then
    insert into private.asset_paths(storage_path,owner_id) values(new.storage_path,owner) on conflict do nothing;
    if not found then raise exception 'Image path cannot be reused' using errcode='23505'; end if;
  end if;
  return new;
end;
$$;
create function private.retire_asset_path() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update private.asset_paths set retired_at=clock_timestamp() where storage_path=old.storage_path;
  return old;
end;
$$;
revoke all on function private.reserve_asset_path(),private.retire_asset_path() from public,anon,authenticated,service_role;
create trigger assets_reserve_path before insert on public.assets for each row execute function private.reserve_asset_path();
create trigger assets_retire_path after delete on public.assets for each row execute function private.retire_asset_path();

create function private.uploads_enabled() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and coalesce((select initialized and uploads_enabled from private.resource_controls where singleton),false);
$$;
revoke all on function private.uploads_enabled() from public,anon,service_role;
grant execute on function private.uploads_enabled() to authenticated;
alter policy story_assets_insert_owner on storage.objects with check (
  bucket_id='story-assets' and (select private.uploads_enabled())
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists(select 1 from public.assets where assets.storage_path=name and assets.kind='hero')
);

create function private.admit_image_processing(p_story_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid; owner uuid := auth.uid();
begin
  if owner is null or not exists(select 1 from public.stories where id=p_story_id and owner_id=owner) then
    raise exception 'Image unavailable' using errcode='42501';
  end if;
  perform private.admit_resource('image',owner);
  delete from private.image_processing_leases where expires_at <= clock_timestamp();
  if (select count(*) from private.image_processing_leases) >= 8 or (select count(*) from private.image_processing_leases where owner_id=owner) >= 2 then
    raise exception 'Image processing is busy. Please try later.' using errcode='PT429';
  end if;
  insert into private.image_processing_leases(owner_id) values(owner) returning id into result;
  return result;
end;
$$;
create function private.release_image_processing(p_lease_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Image unavailable' using errcode='42501'; end if;
  delete from private.image_processing_leases where id=p_lease_id and owner_id=auth.uid();
end;
$$;
create function public.admit_image_processing(p_story_id uuid) returns uuid language sql security invoker set search_path = '' as $$ select private.admit_image_processing(p_story_id); $$;
create function public.release_image_processing(p_lease_id uuid) returns void language sql security invoker set search_path = '' as $$ select private.release_image_processing(p_lease_id); $$;
revoke all on function private.admit_image_processing(uuid),private.release_image_processing(uuid),public.admit_image_processing(uuid),public.release_image_processing(uuid) from public,anon,service_role;
grant execute on function private.admit_image_processing(uuid),private.release_image_processing(uuid),public.admit_image_processing(uuid),public.release_image_processing(uuid) to authenticated;

-- Protected operator claim. The unique registry arbitrates a race with INSERT
-- reservations; retired names can never become attached to a new valid asset.
create function private.retire_orphan_reservation(p_name text,p_owner uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_owner is null or split_part(p_name,'/',1) is distinct from p_owner::text then return false; end if;
  insert into private.asset_paths(storage_path,owner_id,retired_at) values(p_name,p_owner,clock_timestamp()) on conflict do nothing;
  return exists(select 1 from private.asset_paths where storage_path=p_name and owner_id=p_owner and retired_at is not null);
end;
$$;
revoke all on function private.retire_orphan_reservation(text,uuid) from public,anon,authenticated,service_role;
create function private.claim_orphan_path(p_name text,p_object_id uuid,p_version text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare object_owner text; owner uuid;
begin
  if p_name !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$' then return false; end if;
  owner := split_part(p_name,'/',1)::uuid;
  select owner_id into object_owner from storage.objects where bucket_id='story-assets' and name=p_name and id=p_object_id and version is not distinct from p_version and created_at < clock_timestamp()-interval '24 hours';
  if not found or object_owner is distinct from owner::text or exists(select 1 from public.assets where storage_path=p_name) or
    exists(select 1 from public.generation_jobs where story_id=split_part(p_name,'/',2)::uuid and status in ('queued','generating') and lease_expires_at > clock_timestamp()) then return false; end if;
  return private.retire_orphan_reservation(p_name,owner);
end;
$$;
revoke all on function private.claim_orphan_path(text,uuid,text) from public,anon,authenticated,service_role;
comment on table private.asset_paths is 'Immutable issued paths and retirement tombstones; never cascade away. Reconciliation deletes bytes only through Storage API.';
comment on table private.resource_controls is 'Fail-closed by default. Protected operator initializes explicitly; local seed enables only the disposable reference.';
commit;
