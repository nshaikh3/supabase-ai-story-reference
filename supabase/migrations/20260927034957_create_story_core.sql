-- Phase 1: no application client access until owner policies ship in Phase 2.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated;

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  child_name text not null,
  prompt text not null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stories_title_check check (btrim(title) <> '' and char_length(title) <= 120),
  constraint stories_child_name_check check (btrim(child_name) <> '' and char_length(child_name) <= 80),
  constraint stories_prompt_check check (btrim(prompt) <> '' and char_length(prompt) <= 2000),
  constraint stories_status_check check (status in ('draft', 'queued', 'generating', 'complete', 'failed'))
);

create index stories_owner_created_idx on public.stories(owner_id, created_at desc, id desc);
alter table public.stories enable row level security;
revoke all on public.stories from public, anon, authenticated;
comment on table public.stories is 'User-owned stories. Phase 1 denies all client access; owner policies arrive in Phase 2.';

create table public.story_pages (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  page_number integer not null,
  content text not null,
  created_at timestamptz not null default now(),
  constraint story_pages_page_number_check check (page_number > 0),
  constraint story_pages_content_check check (btrim(content) <> '' and char_length(content) <= 8000),
  constraint story_pages_story_page_key unique (story_id, page_number)
);

alter table public.story_pages enable row level security;
revoke all on public.story_pages from public, anon, authenticated;
comment on table public.story_pages is 'Ownership is inherited through story_id; there is no duplicated user_id.';

create function private.set_story_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.statement_timestamp();
  return new;
end;
$$;

revoke all on function private.set_story_updated_at() from public, anon, authenticated;
create trigger stories_set_updated_at
before update on public.stories
for each row execute function private.set_story_updated_at();

commit;
