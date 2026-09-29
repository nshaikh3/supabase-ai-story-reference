-- Phase 2: ownership filters rows; column grants protect server-managed fields.
begin;

revoke all on public.stories, public.story_pages, public.assets from public, anon, authenticated;
grant select, delete on public.stories to authenticated;
grant insert (title, child_name, prompt) on public.stories to authenticated;
grant update (title, child_name, prompt) on public.stories to authenticated;
grant select on public.story_pages, public.assets to authenticated;

create policy stories_select_owner on public.stories
  for select to authenticated
  using (owner_id = (select auth.uid()));
create policy stories_insert_owner on public.stories
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and status = 'draft');
create policy stories_update_owner on public.stories
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy stories_delete_owner on public.stories
  for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy story_pages_select_owner on public.story_pages
  for select to authenticated
  using (exists (
    select 1 from public.stories
    where stories.id = story_pages.story_id and stories.owner_id = (select auth.uid())
  ));
create policy assets_select_owner on public.assets
  for select to authenticated
  using (exists (
    select 1 from public.stories
    where stories.id = assets.story_id and stories.owner_id = (select auth.uid())
  ));

comment on table public.stories is 'Owners may manage story details. Identity, ownership, status and timestamps are server-managed; RLS and column grants are both required.';
comment on table public.story_pages is 'Owners may read generated pages through the parent story. Client writes are denied.';
comment on table public.assets is 'Owners may read metadata through the parent story. Client writes remain denied until private Storage authorization ships.';

commit;
