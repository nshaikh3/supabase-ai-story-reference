-- Phase 4: owner enqueue/read; Edge-only lifecycle writes with the caller's JWT.
begin;
create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  job_type text not null default 'story' check (job_type = 'story'),
  status text not null default 'queued' check (status in ('queued','generating','complete','failed')),
  provider text check (provider in ('mock','gemini')),
  error_code text check (error_code in ('provider_timeout','provider_unavailable','invalid_output','database_write_failed','configuration_error','interrupted')),
  error_message text check (length(error_message) <= 200),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  lease_expires_at timestamptz not null default (now() + interval '2 minutes'),
  constraint generation_jobs_lifecycle_check check (
    (status = 'queued' and started_at is null and completed_at is null and provider is null and error_code is null and error_message is null) or
    (status = 'generating' and started_at is not null and completed_at is null and provider is not null and error_code is null and error_message is null) or
    (status = 'complete' and started_at is not null and completed_at is not null and provider is not null and error_code is null and error_message is null) or
    (status = 'failed' and completed_at is not null and error_code is not null and error_message is not null)
  )
);
create index generation_jobs_story_created_idx on public.generation_jobs(story_id, created_at desc, id desc);
create unique index generation_jobs_one_active_idx on public.generation_jobs(story_id) where status in ('queued','generating');
alter table public.generation_jobs enable row level security;
revoke all on public.generation_jobs from public, anon, authenticated;
grant select on public.generation_jobs to authenticated;
create policy generation_jobs_select_owner on public.generation_jobs for select to authenticated
  using (exists (select 1 from public.stories where stories.id = generation_jobs.story_id and stories.owner_id = (select auth.uid())));

-- Only a hash is stored here. Local setup provisions a random 256-bit Edge secret.
-- No service-role client or credential is used by application/Edge code.
create table private.generation_worker_key (
  singleton boolean primary key default true check (singleton),
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$')
);
alter table private.generation_worker_key enable row level security;
revoke all on private.generation_worker_key from public, anon, authenticated, service_role;

create function private.require_generation_worker() returns void
language plpgsql security definer set search_path = '' as $$
declare token text := current_setting('request.headers', true)::jsonb ->> 'x-generation-worker';
begin
  if auth.uid() is null or token is null or length(token) <> 64 or not exists (
    select 1 from private.generation_worker_key where key_hash = encode(extensions.digest(token, 'sha256'), 'hex')
  ) then raise exception 'Worker authorization required' using errcode = '42501'; end if;
end;
$$;
revoke all on function private.require_generation_worker() from public, anon, authenticated, service_role;

create function private.enqueue_generation(p_story_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare story public.stories; job public.generation_jobs; result uuid;
begin
  select * into story from public.stories where id = p_story_id and owner_id = auth.uid() for update;
  if not found then raise exception 'Story unavailable' using errcode = '42501'; end if;
  if story.status = 'complete' then return null; end if;
  select * into job from public.generation_jobs where story_id = p_story_id and status in ('queued','generating') for update;
  if found then
    if job.lease_expires_at > clock_timestamp() then return job.id; end if;
    update public.generation_jobs set status = 'failed', completed_at = clock_timestamp(), error_code = 'interrupted', error_message = 'Generation was interrupted. Please retry.' where id = job.id;
  end if;
  -- A bounded local demo: retries require an explicit request and stop at three attempts.
  if (select count(*) from public.generation_jobs where story_id = p_story_id) >= 3 then
    update public.stories set status = 'failed' where id = p_story_id;
    return null;
  end if;
  insert into public.generation_jobs(story_id) values (p_story_id) returning id into result;
  update public.stories set status = 'queued' where id = p_story_id;
  return result;
end;
$$;

create function private.claim_generation(p_job_id uuid, p_provider text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_story_id uuid;
begin
  perform private.require_generation_worker();
  if p_provider is null or p_provider not in ('mock','gemini') then raise exception 'Invalid provider' using errcode = '22023'; end if;
  select s.id into v_story_id from public.stories s join public.generation_jobs j on j.story_id = s.id
    where j.id = p_job_id and s.owner_id = auth.uid() for update of s;
  if not found then return false; end if;
  update public.generation_jobs set status = 'generating', provider = p_provider, started_at = clock_timestamp(), lease_expires_at = clock_timestamp() + interval '2 minutes'
    where id = p_job_id and status = 'queued' and lease_expires_at > clock_timestamp();
  if not found then return false; end if;
  update public.stories set status = 'generating' where id = v_story_id;
  return true;
end;
$$;

create function private.finish_generation(p_job_id uuid, p_pages jsonb, p_error_code text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_story_id uuid; page jsonb; position integer := 0; safe_message text;
begin
  perform private.require_generation_worker();
  select s.id into v_story_id from public.stories s join public.generation_jobs j on j.story_id = s.id
    where j.id = p_job_id and s.owner_id = auth.uid() for update of s;
  if not found then return false; end if;
  perform 1 from public.generation_jobs where id = p_job_id and status = 'generating' and lease_expires_at > clock_timestamp() for update;
  if not found then return false; end if;
  if p_error_code is not null then
    safe_message := case p_error_code
      when 'provider_timeout' then 'The story provider took too long. Please retry.'
      when 'provider_unavailable' then 'The story provider is unavailable. Please retry later.'
      when 'invalid_output' then 'The provider returned an unusable story. Please retry.'
      when 'database_write_failed' then 'We could not save the generated story. Please retry.'
      when 'configuration_error' then 'Generation is not configured. Contact the project maintainer.'
      else null end;
    if safe_message is null or p_pages is not null then raise exception 'Invalid failure' using errcode = '22023'; end if;
    update public.generation_jobs set status = 'failed', completed_at = clock_timestamp(), error_code = p_error_code, error_message = safe_message where id = p_job_id;
    update public.stories set status = 'failed' where id = v_story_id;
  else
    if p_pages is null or jsonb_typeof(p_pages) <> 'array' then raise exception 'Invalid pages' using errcode = '22023'; end if;
    if jsonb_array_length(p_pages) <> 5 then raise exception 'Expected five pages' using errcode = '22023'; end if;
    for page in select value from jsonb_array_elements(p_pages) loop
      position := position + 1;
      if jsonb_typeof(page) <> 'object' or jsonb_typeof(page->'page') is distinct from 'number' or page->>'page' <> position::text or
        jsonb_typeof(page->'text') is distinct from 'string' or length(btrim(page->>'text')) not between 1 and 4000 then
        raise exception 'Invalid page' using errcode = '22023';
      end if;
    end loop;
    -- Validation, all pages and both terminal statuses commit or roll back together.
    delete from public.story_pages where story_pages.story_id = v_story_id;
    insert into public.story_pages(story_id, page_number, content)
      select v_story_id, (value->>'page')::integer, value->>'text' from jsonb_array_elements(p_pages);
    update public.generation_jobs set status = 'complete', completed_at = clock_timestamp() where id = p_job_id;
    update public.stories set status = 'complete' where id = v_story_id;
  end if;
  return true;
end;
$$;

grant usage on schema private to authenticated;
-- Exposed functions are invokers; elevated implementations stay unexposed, with
-- explicit uid/ownership checks and a worker gate on every result-writing path.
create function public.enqueue_generation(p_story_id uuid) returns uuid language sql security invoker set search_path = '' as $$ select private.enqueue_generation(p_story_id); $$;
create function public.claim_generation(p_job_id uuid, p_provider text) returns boolean language sql security invoker set search_path = '' as $$ select private.claim_generation(p_job_id,p_provider); $$;
create function public.finish_generation(p_job_id uuid, p_pages jsonb default null, p_error_code text default null) returns boolean language sql security invoker set search_path = '' as $$ select private.finish_generation(p_job_id,p_pages,p_error_code); $$;
revoke all on function private.enqueue_generation(uuid), private.claim_generation(uuid,text), private.finish_generation(uuid,jsonb,text), public.enqueue_generation(uuid), public.claim_generation(uuid,text), public.finish_generation(uuid,jsonb,text) from public, anon, service_role;
grant execute on function private.enqueue_generation(uuid), private.claim_generation(uuid,text), private.finish_generation(uuid,jsonb,text), public.enqueue_generation(uuid), public.claim_generation(uuid,text), public.finish_generation(uuid,jsonb,text) to authenticated;

create function private.guard_generation_input() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if old.status in ('queued','generating','complete') and (new.title,new.child_name,new.prompt) is distinct from (old.title,old.child_name,old.prompt) then
    raise exception 'Story details are locked after generation starts' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_generation_input() from public, anon, authenticated, service_role;
create trigger guard_generation_input before update on public.stories for each row execute function private.guard_generation_input();
comment on table public.generation_jobs is 'Owner-readable history. Only controlled RPCs may enqueue, claim and finish. Two-minute leases, one active job per story, three attempts per story.';
commit;
