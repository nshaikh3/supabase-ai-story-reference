-- The Realtime service owns realtime.messages and enables RLS. Manage its
-- policies only; do not alter managed tables/grants or add application tables
-- to a Postgres Changes publication.
create policy story_owner_receives_generation
on realtime.messages for select to authenticated
using (
  extension = 'broadcast'
  and topic = (select realtime.topic())
  and exists (
    select 1 from public.stories s
    where s.owner_id = (select auth.uid())
      and s.id = (select case
        when realtime.topic() ~ '^story:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then substring(realtime.topic() from 7)::uuid
        else null::uuid
      end)
  )
);
-- Do not filter on the stored `private` flag here: Realtime's authorization
-- probe inserts only topic/extension (private defaults false). Privacy is set
-- explicitly by both the producer and channel, independently of this owner check.
-- No INSERT policy: clients cannot forge status broadcasts or send Presence.

create function private.broadcast_generation_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    perform realtime.send(
      jsonb_build_object('story_id', new.story_id, 'job_id', new.id, 'status', new.status),
      'generation_status',
      'story:' || new.story_id::text,
      true
    );
  end if;
  return null;
end;
$$;
-- Lifecycle mutations already execute through the narrow private worker RPCs.
-- The trigger inherits that context and adds no new elevated function.
revoke all on function private.broadcast_generation_status() from public, anon, authenticated, service_role;
create trigger generation_status_broadcast
after insert or update of status on public.generation_jobs
for each row execute function private.broadcast_generation_status();
