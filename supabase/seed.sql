-- Synthetic local database identities, not login accounts. No passwords or sessions.
insert into auth.users(id, email) values
  ('11111111-1111-4111-8111-111111111111', 'alice@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'bob@example.test');

insert into public.stories(id, owner_id, title, child_name, prompt, status, created_at, updated_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'Maya and the Moon Garden', 'Maya', 'A fictional explorer grows a garden on the moon.', 'complete', '2026-01-01T12:00:00Z', '2026-01-01T12:00:00Z'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '11111111-1111-4111-8111-111111111111', 'Nova Finds a Comet', 'Nova', 'A fictional explorer learns to ask for help.', 'draft', '2026-01-02T12:00:00Z', '2026-01-02T12:00:00Z'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '22222222-2222-4222-8222-222222222222', 'Leo and the Forest Map', 'Leo', 'A fictional fox shares a map with a new friend.', 'draft', '2026-01-03T12:00:00Z', '2026-01-03T12:00:00Z');

insert into public.story_pages(id, story_id, page_number, content, created_at) values
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 1, 'Maya packed a little seed and followed the moonlight. At the edge of a quiet crater, she found a place to plant it.', '2026-01-01T12:00:00Z'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 2, 'The seed needed water. Maya and a friendly moon rover collected tiny drops together, one careful trip at a time.', '2026-01-01T12:00:00Z'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 3, 'When a green leaf appeared, Maya smiled. Even the smallest garden could begin with a little patience and a friend.', '2026-01-01T12:00:00Z');

-- No asset metadata until actual private objects exist.

-- Disposable local reference only; deployment never applies this seed.
update private.resource_controls set initialized=true,writes_enabled=true,generation_enabled=true,uploads_enabled=true,images_enabled=true where singleton;
