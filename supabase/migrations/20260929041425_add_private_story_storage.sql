-- Private Storage and immutable owner-authorized image reservations.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('story-assets', 'story-assets', false, 2097152, array['image/png', 'image/jpeg', 'image/webp']);

create unique index assets_one_hero_per_story_idx on public.assets(story_id) where kind = 'hero';
grant insert (story_id, kind, storage_path, mime_type) on public.assets to authenticated;
grant delete on public.assets to authenticated;

create policy assets_insert_owner on public.assets for insert to authenticated
with check (
  kind = 'hero'
  and split_part(storage_path, '/', 1) = (select auth.uid())::text
  and exists (select 1 from public.stories where stories.id = assets.story_id and stories.owner_id = (select auth.uid()))
);
create policy assets_delete_owner on public.assets for delete to authenticated
using (exists (select 1 from public.stories where stories.id = assets.story_id and stories.owner_id = (select auth.uid())));

-- Metadata is reserved before upload, so an interrupted upload remains removable.
-- No UPDATE policy: objects and metadata use new random names, never upsert/move.
create policy story_assets_select_owner on storage.objects for select to authenticated
using (
  bucket_id = 'story-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.assets where assets.storage_path = name)
);
create policy story_assets_insert_owner on storage.objects for insert to authenticated
with check (
  bucket_id = 'story-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.assets where assets.storage_path = name and assets.kind = 'hero')
);
create policy story_assets_delete_owner on storage.objects for delete to authenticated
using (
  bucket_id = 'story-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.assets where assets.storage_path = name)
);

-- Inspect managed Storage metadata only; delete bytes through the Storage API.
-- Definer is necessary during parent cascades (the parent is no longer RLS-visible).
-- No arguments, no dynamic SQL, fixed search_path, no client execute privilege.
create function private.guard_asset_object_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from storage.objects where bucket_id = 'story-assets' and name = old.storage_path) then
    raise exception 'Remove the stored image before deleting its metadata or story.' using errcode = '23503';
  end if;
  return old;
end;
$$;
revoke all on function private.guard_asset_object_delete() from public, anon, authenticated;
create trigger assets_require_object_removal before delete on public.assets
for each row execute function private.guard_asset_object_delete();

comment on table public.assets is 'Owner-created immutable hero image reservations. Remove objects through Storage before metadata or story deletion. Cross-service cleanup is retryable, not atomic.';
comment on function private.guard_asset_object_delete() is 'Blocks deletion of metadata with a committed Storage object, including parent cascades. Does not coordinate in-flight Storage uploads; see SECURITY.md.';
commit;
