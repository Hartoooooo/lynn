-- Rollenänderung: in der App nur durch Admins; direkte DB-/Service-Zugriffe (ohne auth.uid) bleiben erlaubt.
create or replace function private.guard_role_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not private.is_admin() then
    raise exception 'Nur Admins dürfen Rollen ändern';
  end if;
  return new;
end;
$$;

-- Neues Konto wird Admin, solange es noch keinen Admin gibt.
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when exists (select 1 from public.profiles where role = 'admin') then 'viewer'::public.user_role
         else 'admin'::public.user_role end
  );
  return new;
end;
$$;
