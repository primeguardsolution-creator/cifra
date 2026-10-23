-- Reserved @usernames: the in-app assistant (@maestro) and official-sounding names can never be claimed by a user,
-- so nobody can impersonate the assistant or the company. Safe to re-run.

create or replace function public.guard_reserved_username()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.username is not null
     and (tg_op = 'INSERT' or new.username is distinct from old.username)
     and lower(new.username) = any (array['maestro','cifra','soporte','ayuda','admin','oficial','support','help','official','botmaster','cifra_oficial']) then
    raise exception 'username_reserved';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_reserved_username on public.profiles;
create trigger profiles_reserved_username
  before insert or update of username on public.profiles
  for each row execute function public.guard_reserved_username();

-- Rate limit for the optional AI assistant (/api/assistant calls this with the user's own session before spending tokens).
create or replace function public.check_assistant_rate()
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.check_rate('assistant', 40, interval '1 hour');
end;
$$;

revoke execute on function public.check_assistant_rate() from public, anon;
grant execute on function public.check_assistant_rate() to authenticated;
