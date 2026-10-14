-- Direktes Setzen einer Schicht (für Laurens: beliebige Schicht an jedem Tag).
-- Bumpt die Version und protokolliert die Änderung wie ein Tausch.
create function public.roster_set_shift(
  week uuid, person text, day integer, value text, expected_version integer
)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  cur integer;
  w record;
  v_shifts jsonb;
  v_old text;
  v_value text := nullif(trim(coalesce(value, '')), '');
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if day not between 0 and 4 then
    raise exception 'invalid_day';
  end if;

  select version into cur from public.roster_meta where id = 1 for update;
  if cur is distinct from expected_version then
    raise exception 'version_conflict';
  end if;

  select * into w from public.roster_weeks where id = week for update;
  if not found or not (w.shifts ? person) then
    raise exception 'invalid_shift';
  end if;
  v_shifts := w.shifts;
  v_old := v_shifts -> person ->> day;

  v_shifts := jsonb_set(v_shifts, array[person, day::text], coalesce(to_jsonb(v_value), 'null'::jsonb));
  update public.roster_weeks set shifts = v_shifts, updated_at = now() where id = week;

  insert into public.roster_activity (created_by, note, swaps)
    values (auth.uid(), null, jsonb_build_array(jsonb_build_object(
      'weekRange', w.range, 'day', day, 'dateLabel', w.dates[day + 1],
      'personA', person, 'oldA', v_old, 'newA', v_value,
      'personB', '', 'oldB', null, 'newB', null)));

  update public.roster_meta set version = version + 1 where id = 1 returning version into cur;
  return cur;
end;
$$;

revoke execute on function public.roster_set_shift(uuid, text, integer, text, integer) from public, anon;
grant execute on function public.roster_set_shift(uuid, text, integer, text, integer) to authenticated;
