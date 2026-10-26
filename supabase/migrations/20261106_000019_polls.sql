-- Migration 19: polls ("Encuestas") inside chats. Anyone who can write in a chat can ask a question with 2 to 6 options (single or multiple
-- choice). The poll travels as a normal message; votes are private (everyone sees the counts, nobody sees who voted what). Safe to re-run.
create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  question text not null check (char_length(question) between 1 and 200),
  multiple boolean not null default false,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  position smallint not null,
  label text not null check (char_length(label) between 1 and 100)
);
create table if not exists public.poll_votes (
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, option_id, user_id)
);
create index if not exists poll_options_poll_idx on public.poll_options (poll_id, position);
create index if not exists poll_votes_user_idx on public.poll_votes (poll_id, user_id);
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
revoke all on public.polls, public.poll_options, public.poll_votes from anon, authenticated;

alter table public.messages add column if not exists poll_id uuid references public.polls(id) on delete set null;

create or replace function public.create_poll(p_conv uuid, p_question text, p_options text[], p_multiple boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := (select auth.uid());
  q text := btrim(coalesce(p_question, ''));
  opts text[] := array(select btrim(o) from unnest(coalesce(p_options, '{}')) as o where btrim(o) <> '');
  pid uuid; mid uuid; i integer;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if not public.can_send_to_conversation(p_conv) then raise exception 'forbidden'; end if;
  if exists (select 1 from public.conversations where id = p_conv and incognito) then raise exception 'not_supported'; end if;
  if char_length(q) < 1 or char_length(q) > 200 then raise exception 'invalid_question'; end if;
  if coalesce(array_length(opts, 1), 0) < 2 or array_length(opts, 1) > 6 then raise exception 'invalid_options'; end if;
  if exists (select 1 from unnest(opts) o where char_length(o) > 100) then raise exception 'invalid_options'; end if;
  perform public.check_rate('create_poll', 30, interval '1 hour');
  insert into public.polls (conversation_id, created_by, question, multiple) values (p_conv, me, q, coalesce(p_multiple, false)) returning id into pid;
  for i in 1 .. array_length(opts, 1) loop
    insert into public.poll_options (poll_id, position, label) values (pid, i, opts[i]);
  end loop;
  insert into public.messages (conversation_id, sender_id, body, poll_id) values (p_conv, me, chr(128202) || ' ' || q, pid) returning id into mid;
  return pid;
end;
$$;

-- one vote on or off. Single-choice polls replace your previous answer.
create or replace function public.vote_poll(p_poll uuid, p_option uuid, p_on boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := (select auth.uid()); p public.polls;
begin
  select * into p from public.polls where id = p_poll;
  if p.id is null or not public.can_access_conversation(p.conversation_id) then raise exception 'forbidden'; end if;
  if p.closed_at is not null then raise exception 'poll_closed'; end if;
  if not exists (select 1 from public.poll_options where id = p_option and poll_id = p_poll) then raise exception 'invalid_option'; end if;
  perform public.check_rate('vote_poll', 120, interval '1 hour');
  if p_on then
    if not p.multiple then delete from public.poll_votes where poll_id = p_poll and user_id = me and option_id <> p_option; end if;
    insert into public.poll_votes (poll_id, option_id, user_id) values (p_poll, p_option, me) on conflict do nothing;
  else
    delete from public.poll_votes where poll_id = p_poll and option_id = p_option and user_id = me;
  end if;
end;
$$;

create or replace function public.close_poll(p_poll uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.polls set closed_at = now() where id = p_poll and created_by = (select auth.uid()) and closed_at is null;
  if not found then raise exception 'forbidden'; end if;
end;
$$;

-- polls with their counts and the caller's own votes, for a list of poll ids (only polls of chats the caller can read)
create or replace function public.get_polls(p_ids uuid[])
returns table (id uuid, conversation_id uuid, question text, multiple boolean, closed boolean, mine_created boolean, options jsonb, voters integer)
language sql stable security definer set search_path = public as $$
  select p.id, p.conversation_id, p.question, p.multiple, p.closed_at is not null, p.created_by = (select auth.uid()),
    (select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'votes', (select count(*) from public.poll_votes v where v.option_id = o.id),
       'mine', exists (select 1 from public.poll_votes v where v.option_id = o.id and v.user_id = (select auth.uid()))) order by o.position)
     from public.poll_options o where o.poll_id = p.id),
    (select count(distinct v.user_id)::integer from public.poll_votes v where v.poll_id = p.id)
  from public.polls p
  where p.id = any (p_ids) and public.can_access_conversation(p.conversation_id);
$$;

revoke execute on function public.create_poll(uuid, text, text[], boolean), public.vote_poll(uuid, uuid, boolean), public.close_poll(uuid), public.get_polls(uuid[]) from public, anon;
grant execute on function public.create_poll(uuid, text, text[], boolean), public.vote_poll(uuid, uuid, boolean), public.close_poll(uuid), public.get_polls(uuid[]) to authenticated;
