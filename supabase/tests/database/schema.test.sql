begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select has_table('public', 'stories', 'Stories table exists');
select has_table('public', 'story_pages', 'Pages table exists');
select has_table('public', 'assets', 'Asset metadata table exists');
select col_type_is('public', 'stories', 'id', 'uuid', 'Story IDs are UUIDs');
select col_type_is('public', 'stories', 'created_at', 'timestamp with time zone', 'Creation timestamps carry timezone');
select col_not_null('public', 'stories', 'owner_id', 'Every story has an owner');
select col_has_default('public', 'stories', 'owner_id', 'Owner defaults to authenticated context');
select col_has_default('public', 'stories', 'status', 'New stories default to draft');
select hasnt_column('public', 'story_pages', 'owner_id', 'Pages do not duplicate ownership');
select hasnt_column('public', 'assets', 'owner_id', 'Assets do not duplicate ownership');
select has_index('public', 'stories', 'stories_owner_created_idx', 'Dashboard has an owner/order index');
select has_index('public', 'story_pages', 'story_pages_story_page_key', 'Page uniqueness also indexes the parent FK');
select has_index('public', 'assets', 'assets_story_id_idx', 'Asset parent FK is indexed');
select is((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('stories', 'story_pages', 'assets') and c.relrowsecurity), 3::bigint, 'RLS enabled on every application table');
select is((select count(*) from pg_policies where schemaname = 'public' and tablename in ('stories', 'story_pages', 'assets')), 8::bigint, 'Eight operation-specific owner policies');
select ok(not (select prosecdef from pg_proc where oid = 'private.set_story_updated_at()'::regprocedure), 'Timestamp helper runs as invoker');
select is((select proconfig[1] from pg_proc where oid = 'private.set_story_updated_at()'::regprocedure), 'search_path=""', 'Helper has an empty search path');
select ok(not has_function_privilege('anon', 'private.set_story_updated_at()', 'EXECUTE'), 'Anonymous role cannot invoke private helper');
select ok(not has_function_privilege('authenticated', 'private.set_story_updated_at()', 'EXECUTE'), 'Authenticated role cannot invoke private helper');

select * from finish();
rollback;
