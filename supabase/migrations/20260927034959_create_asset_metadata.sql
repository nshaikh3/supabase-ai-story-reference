-- Object operations and private bucket policies are introduced together in Phase 3.
begin;

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  kind text not null,
  storage_path text not null,
  mime_type text not null,
  created_at timestamptz not null default now(),
  constraint assets_kind_check check (kind in ('hero', 'reference', 'generated')),
  constraint assets_mime_type_check check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  constraint assets_storage_path_check check (
    char_length(storage_path) <= 512
    and storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$'
    and split_part(storage_path, '/', 2) = story_id::text
  ),
  constraint assets_storage_path_key unique (storage_path)
);

create index assets_story_id_idx on public.assets(story_id);
alter table public.assets enable row level security;
revoke all on public.assets from public, anon, authenticated;
comment on table public.assets is 'Private object metadata. Parent ownership and Storage object authorization must both be checked before writes are enabled.';

commit;
