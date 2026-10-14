-- Handelsassistenz (HA): eigene, wöchentlich selbst eingetragene Zeiten (nicht tauschbar)
alter table public.roster_weeks add column ha_shifts jsonb not null default '{}'::jsonb;
alter table public.roster_meta add column ha_names text[] not null default '{Timon H,Niklas P,Lukas K}';

create function public.roster_set_ha(week uuid, person text, day integer, value text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_value text := nullif(trim(coalesce(value, '')), '');
  v_shifts jsonb;
  m text[];
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.roster_meta where id = 1 and person = any(ha_names)) then
    raise exception 'invalid_person';
  end if;
  if day not between 0 and 4 then
    raise exception 'invalid_day';
  end if;
  if v_value is not null and v_value not in ('frei', 'URLAUB') then
    m := regexp_match(v_value, '^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$');
    if m is null
       or m[1]::int > 23 or m[2]::int > 59 or m[3]::int > 23 or m[4]::int > 59
       or (m[3]::int * 60 + m[4]::int) <= (m[1]::int * 60 + m[2]::int) then
      raise exception 'invalid_time';
    end if;
  end if;

  select ha_shifts into v_shifts from public.roster_weeks where id = week for update;
  if not found then
    raise exception 'invalid_week';
  end if;
  if not (v_shifts ? person) then
    v_shifts := v_shifts || jsonb_build_object(person, '[null,null,null,null,null]'::jsonb);
  end if;
  v_shifts := jsonb_set(v_shifts, array[person, day::text], coalesce(to_jsonb(v_value), 'null'::jsonb));
  update public.roster_weeks set ha_shifts = v_shifts, updated_at = now() where id = week;
end;
$$;

revoke execute on function public.roster_set_ha(uuid, text, integer, text) from public, anon;
grant execute on function public.roster_set_ha(uuid, text, integer, text) to authenticated;

alter publication supabase_realtime add table public.roster_weeks;
