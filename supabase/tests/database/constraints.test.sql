begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

select throws_ok($$insert into public.stories(title,child_name,prompt) values ('Test','Nova','A map')$$, '23502', null, 'Missing owner is rejected without a JWT');
select throws_ok($$insert into public.stories(owner_id,title,child_name,prompt) values ('99999999-9999-4999-8999-999999999999','Test','Nova','A map')$$, '23503', null, 'An owner must exist in Auth');
select throws_ok($$insert into public.stories(owner_id,title,child_name,prompt) values ('11111111-1111-4111-8111-111111111111',' ','Nova','A map')$$, '23514', null, 'Blank title is rejected');
select throws_ok($$insert into public.stories(owner_id,title,child_name,prompt) values ('11111111-1111-4111-8111-111111111111',repeat('x',121),'Nova','A map')$$, '23514', null, 'Oversized title is rejected');
select throws_ok($$insert into public.stories(owner_id,title,child_name,prompt) values ('11111111-1111-4111-8111-111111111111','Test',repeat('x',81),'A map')$$, '23514', null, 'Oversized fictional name is rejected');
select throws_ok($$insert into public.stories(owner_id,title,child_name,prompt) values ('11111111-1111-4111-8111-111111111111','Test','Nova',repeat('x',2001))$$, '23514', null, 'Oversized prompt is rejected');
select throws_ok($$update public.stories set status='unknown' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'$$, '23514', null, 'Unknown status is rejected');
select throws_ok($$insert into public.story_pages(story_id,page_number,content) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',0,'Text')$$, '23514', null, 'Page numbers are positive');
select throws_ok($$insert into public.story_pages(story_id,page_number,content) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',1,'Text')$$, '23505', null, 'Duplicate page position is rejected');
select throws_ok($$insert into public.story_pages(story_id,page_number,content) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',4,repeat('x',8001))$$, '23514', null, 'Oversized page is rejected');
select throws_ok($$insert into public.story_pages(story_id,page_number,content) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',4,' ')$$, '23514', null, 'Blank page is rejected');
select throws_ok($$insert into public.story_pages(story_id,page_number,content) values ('99999999-9999-4999-8999-999999999999',1,'Text')$$, '23503', null, 'Orphan page is rejected');
select throws_ok($$insert into public.assets(story_id,kind,storage_path,mime_type) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','hero','https://example.test/image.png','image/png')$$, '23514', null, 'Asset paths cannot be public URLs');
select throws_ok($$insert into public.assets(story_id,kind,storage_path,mime_type) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','hero','11111111-1111-4111-8111-111111111111/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1/dddddddd-dddd-4ddd-8ddd-dddddddddddd.png','image/png')$$, '23514', null, 'Asset path must name its parent story');

insert into public.assets(id,story_id,kind,storage_path,mime_type) values
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','hero','11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/dddddddd-dddd-4ddd-8ddd-dddddddddddd.png','image/png');
select throws_ok($$update public.assets set mime_type='image/svg+xml'$$, '23514', null, 'Unsupported image type is rejected');
select throws_ok($$update public.assets set kind='video'$$, '23514', null, 'Unknown asset kind is rejected');
select throws_ok($$insert into public.assets(story_id,kind,storage_path,mime_type) select story_id,kind,storage_path,mime_type from public.assets$$, '23505', null, 'Duplicate object reference is rejected');

select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
insert into public.stories(id,title,child_name,prompt) values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Default owner','Nova','A map');
select is((select owner_id from public.stories where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'), '11111111-1111-4111-8111-111111111111'::uuid, 'Owner default uses the request identity');
select is((select status from public.stories where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'), 'draft', 'Story defaults to draft');
update public.stories set title='Updated title' where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
select ok((select updated_at > '2026-01-02T12:00:00Z'::timestamptz from public.stories where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'), 'Update advances updated_at');
select is((select created_at from public.stories where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'), '2026-01-02T12:00:00Z'::timestamptz, 'Update preserves created_at');

delete from public.stories where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
select is((select count(*) from public.story_pages), 0::bigint, 'Deleting story cascades to its pages');
select is((select count(*) from public.assets), 0::bigint, 'Deleting story cascades to asset metadata');
select is((select count(*) from public.stories where owner_id='22222222-2222-4222-8222-222222222222'), 1::bigint, 'Bob remains unaffected');
delete from auth.users where id='11111111-1111-4111-8111-111111111111';
select is((select count(*) from public.stories where owner_id='11111111-1111-4111-8111-111111111111'), 0::bigint, 'Deleting Auth identity cascades to its stories');

select * from finish();
rollback;
