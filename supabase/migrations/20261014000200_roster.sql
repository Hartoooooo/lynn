-- Dienstplan mit Schichttausch

create table public.roster_weeks (
  id uuid primary key default gen_random_uuid(),
  start_date date not null unique,
  range text not null,
  dates text[] not null,
  hint text,
  shifts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.roster_meta (
  id integer primary key default 1 check (id = 1),
  version integer not null default 0,
  names text[] not null default '{}'
);
insert into public.roster_meta default values;

create table public.roster_activity (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  note text,
  swaps jsonb not null
);

create index roster_activity_created_idx on public.roster_activity (created_at desc);
create index roster_activity_created_by_idx on public.roster_activity (created_by);

alter table public.roster_weeks enable row level security;
alter table public.roster_meta enable row level security;
alter table public.roster_activity enable row level security;

create policy "roster_weeks: lesen" on public.roster_weeks for select to authenticated using (true);
create policy "roster_meta: lesen" on public.roster_meta for select to authenticated using (true);
create policy "roster_activity: lesen" on public.roster_activity for select to authenticated using (true);

create function private.roster_tradeable(v text)
returns boolean language sql immutable set search_path = ''
as $$ select coalesce(v ~ '^\d{1,2}:\d{2}-', false) $$;

create function private.roster_available(v text)
returns boolean language sql immutable set search_path = ''
as $$ select v is null or v = '' or v in ('frei', 'boersenfrei') $$;

-- Tauscht Schichten atomar. Gleicher Slot: Tag A zwischen A und B.
-- Tagübergreifend (gleiche Woche): B übernimmt A's Dienst an Tag A, A übernimmt B's Dienst an Tag B.
create function public.roster_swap(
  week_a uuid, day_a integer, person_a text,
  week_b uuid, day_b integer, person_b text,
  note text, expected_version integer
)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  cur integer;
  w record;
  v_shifts jsonb;
  a_at_a text; b_at_a text; a_at_b text; b_at_b text;
  v_swaps jsonb;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select version into cur from public.roster_meta where id = 1 for update;
  if cur is distinct from expected_version then
    raise exception 'version_conflict';
  end if;

  if day_a not between 0 and 4 or day_b not between 0 and 4 or person_a = person_b then
    raise exception 'invalid_swap';
  end if;
  if week_a <> week_b then
    raise exception 'cross_week_not_supported';
  end if;

  select * into w from public.roster_weeks where id = week_a for update;
  if not found or not (w.shifts ? person_a) or not (w.shifts ? person_b) then
    raise exception 'invalid_swap';
  end if;
  v_shifts := w.shifts;

  a_at_a := v_shifts -> person_a ->> day_a;
  b_at_a := v_shifts -> person_b ->> day_a;
  if not private.roster_tradeable(a_at_a) then
    raise exception 'not_tradeable';
  end if;

  if day_a = day_b then
    if not private.roster_tradeable(b_at_a) then
      raise exception 'not_tradeable';
    end if;
    v_shifts := jsonb_set(v_shifts, array[person_a, day_a::text], coalesce(to_jsonb(b_at_a), 'null'::jsonb));
    v_shifts := jsonb_set(v_shifts, array[person_b, day_a::text], coalesce(to_jsonb(a_at_a), 'null'::jsonb));
    v_swaps := jsonb_build_array(jsonb_build_object(
      'weekRange', w.range, 'day', day_a, 'dateLabel', w.dates[day_a + 1],
      'personA', person_a, 'oldA', a_at_a, 'newA', b_at_a,
      'personB', person_b, 'oldB', b_at_a, 'newB', a_at_a));
  else
    a_at_b := v_shifts -> person_a ->> day_b;
    b_at_b := v_shifts -> person_b ->> day_b;
    if not private.roster_available(b_at_a)
       or not private.roster_tradeable(b_at_b)
       or not private.roster_available(a_at_b) then
      raise exception 'not_tradeable';
    end if;
    v_shifts := jsonb_set(v_shifts, array[person_a, day_a::text], coalesce(to_jsonb(b_at_a), 'null'::jsonb));
    v_shifts := jsonb_set(v_shifts, array[person_b, day_a::text], coalesce(to_jsonb(a_at_a), 'null'::jsonb));
    v_shifts := jsonb_set(v_shifts, array[person_a, day_b::text], coalesce(to_jsonb(b_at_b), 'null'::jsonb));
    v_shifts := jsonb_set(v_shifts, array[person_b, day_b::text], coalesce(to_jsonb(a_at_b), 'null'::jsonb));
    v_swaps := jsonb_build_array(
      jsonb_build_object(
        'weekRange', w.range, 'day', day_a, 'dateLabel', w.dates[day_a + 1],
        'personA', person_a, 'oldA', a_at_a, 'newA', b_at_a,
        'personB', person_b, 'oldB', b_at_a, 'newB', a_at_a),
      jsonb_build_object(
        'weekRange', w.range, 'day', day_b, 'dateLabel', w.dates[day_b + 1],
        'personA', person_a, 'oldA', a_at_b, 'newA', b_at_b,
        'personB', person_b, 'oldB', b_at_b, 'newB', a_at_b));
  end if;

  update public.roster_weeks set shifts = v_shifts, updated_at = now() where id = week_a;
  insert into public.roster_activity (created_by, note, swaps)
    values (auth.uid(), nullif(trim(roster_swap.note), ''), v_swaps);
  update public.roster_meta set version = version + 1 where id = 1 returning version into cur;
  return cur;
end;
$$;

-- Import (nur Admins): Wochen per start_date ersetzen/ergänzen, Verlauf bleibt.
create function public.roster_import(weeks jsonb, names text[])
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  wk jsonb;
  cur integer;
begin
  if not private.is_admin() then
    raise exception 'not_admin';
  end if;
  for wk in select * from jsonb_array_elements(roster_import.weeks) loop
    insert into public.roster_weeks (start_date, range, dates, hint, shifts)
    values (
      (wk ->> 'startDate')::date,
      wk ->> 'range',
      array(select jsonb_array_elements_text(wk -> 'dates')),
      nullif(trim(wk ->> 'hint'), ''),
      wk -> 'shifts'
    )
    on conflict (start_date) do update
      set range = excluded.range, dates = excluded.dates, hint = excluded.hint,
          shifts = excluded.shifts, updated_at = now();
  end loop;
  update public.roster_meta set names = roster_import.names, version = version + 1 where id = 1
    returning version into cur;
  return cur;
end;
$$;

revoke execute on function public.roster_swap(uuid, integer, text, uuid, integer, text, text, integer) from public, anon;
grant execute on function public.roster_swap(uuid, integer, text, uuid, integer, text, text, integer) to authenticated;
revoke execute on function public.roster_import(jsonb, text[]) from public, anon;
grant execute on function public.roster_import(jsonb, text[]) to authenticated;
