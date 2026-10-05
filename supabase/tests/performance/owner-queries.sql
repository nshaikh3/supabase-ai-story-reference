-- Fixed synthetic workload. No schema migrations, policy changes or committed
-- fixtures. EXPLAIN ANALYZE executes only the SELECT statements below.
\set ON_ERROR_STOP on
begin;
set local statement_timeout = '60s';
set local lock_timeout = '5s';
set local idle_in_transaction_session_timeout = '90s';
select json_build_object('kind','baseline','counts',json_build_array(
  (select count(*) from auth.users),(select count(*) from public.stories),
  (select count(*) from public.story_pages),(select count(*) from public.assets),
  (select count(*) from public.generation_jobs)));
insert into auth.users(id,email) values
 ('90000000-0000-4000-8000-000000000001','performance-alice@example.test'),
 ('90000000-0000-4000-8000-000000000002','performance-bob@example.test');
insert into public.stories(id,owner_id,title,child_name,prompt,status,created_at)
select ('60000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
 case when i <= 5000 then '90000000-0000-4000-8000-000000000001'::uuid else '90000000-0000-4000-8000-000000000002'::uuid end,
 'Synthetic performance story','Fictional explorer','A fictional journey for query measurement.','complete',
 '2026-01-01T00:00:00Z'::timestamptz + i * interval '1 second'
from generate_series(1,10000) i;
insert into public.story_pages(story_id,page_number,content)
select ('60000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,p,'Fictional performance fixture.'
from generate_series(1,10000) i cross join generate_series(1,5) p;
insert into public.assets(story_id,kind,storage_path,mime_type)
select id,'hero',owner_id::text || '/' || id::text || '/70000000-0000-4000-8000-000000000001.webp','image/webp'
from public.stories where id between '60000000-0000-4000-8000-000000000001' and '60000000-0000-4000-8000-000000010000';
-- Real trigger execution remains enabled. Its synthetic notifications roll back.
insert into public.generation_jobs(story_id,status,provider,started_at,completed_at)
select id,'complete','mock',created_at,created_at + interval '1 second'
from public.stories where id between '60000000-0000-4000-8000-000000000001' and '60000000-0000-4000-8000-000000010000';
insert into realtime.messages(id,topic,extension) values ('80000000-0000-4000-8000-000000000001','story:60000000-0000-4000-8000-000000005000','broadcast');
analyze public.stories;
analyze public.story_pages;
analyze public.assets;
analyze public.generation_jobs;

create function pg_temp.capture_plan(label text, statement text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
 execute 'explain (analyze, buffers, format json) ' || statement into result;
 return jsonb_build_object('kind','plan','name',label,'explain',result);
end;
$$;
grant execute on function pg_temp.capture_plan(text,text) to authenticated;
set local role authenticated;
set local row_security = on;
set local request.jwt.claims = '{"role":"authenticated","sub":"90000000-0000-4000-8000-000000000001"}';
set local realtime.topic = 'story:60000000-0000-4000-8000-000000005000';
select json_build_object('kind','context','serverVersion',current_setting('server_version'),
 'role',current_user,'bypassRls',(select rolbypassrls or rolsuper from pg_roles where rolname=current_user),
 'rowSecurity',current_setting('row_security'),'sequentialScans',current_setting('enable_seqscan'),
 'visibleStories',(select count(*) from public.stories),'visiblePages',(select count(*) from public.story_pages),
 'visibleAssets',(select count(*) from public.assets),'visibleJobs',(select count(*) from public.generation_jobs));

select pg_temp.capture_plan('dashboard_first',$q$
 select id,title,child_name,status,created_at from public.stories
 where owner_id='90000000-0000-4000-8000-000000000001'
 order by created_at desc,id desc limit 21$q$);
select pg_temp.capture_plan('dashboard_offset',$q$
 select id,title,child_name,status,created_at from public.stories
 where owner_id='90000000-0000-4000-8000-000000000001'
 order by created_at desc,id desc limit 21 offset 4900$q$);
-- Comparison only: the application currently uses offset pagination.
select pg_temp.capture_plan('dashboard_keyset_comparison',$q$
 select id,title,child_name,status,created_at from public.stories
 where owner_id='90000000-0000-4000-8000-000000000001'
 and (created_at,id) < ('2026-01-01T00:01:41Z','60000000-0000-4000-8000-000000000101'::uuid)
 order by created_at desc,id desc limit 21$q$);
select pg_temp.capture_plan('story_detail',$q$
 select id,title,child_name,prompt,status from public.stories
 where id='60000000-0000-4000-8000-000000005000' and owner_id='90000000-0000-4000-8000-000000000001'$q$);
select pg_temp.capture_plan('story_pages',$q$
 select id,page_number,content from public.story_pages where story_id='60000000-0000-4000-8000-000000005000' order by page_number$q$);
select pg_temp.capture_plan('story_asset',$q$
 select id from public.assets where story_id='60000000-0000-4000-8000-000000005000' and kind='hero'$q$);
select pg_temp.capture_plan('asset_path',$q$
 select storage_path,mime_type from public.assets
 where storage_path='90000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000005000/70000000-0000-4000-8000-000000000001.webp'$q$);
select pg_temp.capture_plan('job_history',$q$
 select id,status,provider,error_message,created_at from public.generation_jobs
 where story_id='60000000-0000-4000-8000-000000005000' order by created_at desc,id desc limit 3$q$);
select pg_temp.capture_plan('other_owner_pages',$q$
 select id,page_number,content from public.story_pages where story_id='60000000-0000-4000-8000-000000010000' order by page_number$q$);
-- v2.135.3 generates the probe ID, inserts topic/extension without a private flag,
-- then SELECTs by IDs under the caller's role and topic configuration.
select pg_temp.capture_plan('realtime_probe',$q$
 select id from realtime.messages where id in ('80000000-0000-4000-8000-000000000001')$q$);
set local request.jwt.claims = '{"role":"authenticated","sub":"90000000-0000-4000-8000-000000000002"}';
select pg_temp.capture_plan('other_owner_realtime_probe',$q$
 select id from realtime.messages where id in ('80000000-0000-4000-8000-000000000001')$q$);
rollback;
-- Rebuild baseline planner statistics after the rolled-back bulk inserts.
analyze public.stories;
analyze public.story_pages;
analyze public.assets;
analyze public.generation_jobs;
select json_build_object('kind','cleanup','counts',json_build_array(
  (select count(*) from auth.users),(select count(*) from public.stories),
  (select count(*) from public.story_pages),(select count(*) from public.assets),
  (select count(*) from public.generation_jobs)),
 'fixtureUsers',(select count(*) from auth.users where id in ('90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002')));
