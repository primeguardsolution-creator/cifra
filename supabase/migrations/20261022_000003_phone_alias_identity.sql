-- Phone identity without an SMS provider (beta).
-- The app signs people up with an internal alias  p<digits>@phone.example.com  (example.com is an IANA-reserved
-- domain: nobody can ever receive mail there, so password-reset emails cannot be hijacked). The phone number is
-- derived HERE, server-side, from that alias — never from client-supplied metadata — and every account must have one.
-- When real SMS verification is enabled later, users created with a real `phone` keep working unchanged.

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_digits text := nullif(regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g'), '');
begin
  if v_digits is null and new.email ~ '^p[0-9]{7,15}@phone\.example\.com$' then
    v_digits := substring(new.email from '^p([0-9]{7,15})@');
  end if;
  if v_digits is null then
    raise exception 'phone_required';
  end if;
  insert into public.profiles (id, display_name, phone, phone_verified)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 'Usuario CIFRA'), 120),
    '+' || v_digits,
    new.phone_confirmed_at is not null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- remove throw-away accounts created while probing which alias domains the server accepts
delete from auth.users where email ~ '^p34699000001@';
