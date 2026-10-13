-- Lynn: Grundschema (Themen, Einträge, Personal, Suche, Rollen)

create extension if not exists pg_trgm with schema extensions;

create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Rollen & Profile
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'editor', 'viewer');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text not null default '',
  role public.user_role not null default 'viewer',
  avatar_url text,
  created_at timestamptz not null default now()
);

create function private.user_role()
returns public.user_role
language sql stable security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create function private.is_editor()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(private.user_role() in ('admin', 'editor'), false)
$$;

create function private.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(private.user_role() = 'admin', false)
$$;

grant execute on function private.user_role(), private.is_editor(), private.is_admin() to authenticated;

-- Neues Konto -> Profil. Der allererste Nutzer wird Admin.
create function private.handle_new_user()
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
    case when exists (select 1 from public.profiles) then 'viewer'::public.user_role
         else 'admin'::public.user_role end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Nur Admins dürfen Rollen ändern.
create function private.guard_role_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and not private.is_admin() then
    raise exception 'Nur Admins dürfen Rollen ändern';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function private.guard_role_change();

-- ---------------------------------------------------------------------------
-- Themen & Einträge
-- ---------------------------------------------------------------------------
create table public.topics (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique,
  icon text not null default 'folder',
  color text not null default '#d97757',
  description text not null default '',
  sort_order integer not null default 0,
  archived boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id) on delete cascade,
  title text not null default 'Unbenannt',
  content_json jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  content_text text not null default '',
  pinned boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('german'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('german'::regconfig, coalesce(content_text, '')), 'B')
  ) stored
);

create index entries_topic_idx on public.entries (topic_id);
create index entries_updated_idx on public.entries (updated_at desc);
create index entries_search_idx on public.entries using gin (search_vector);
create index entries_title_trgm_idx on public.entries using gin (title extensions.gin_trgm_ops);
create index entries_created_by_idx on public.entries (created_by);
create index entries_updated_by_idx on public.entries (updated_by);
create index topics_created_by_idx on public.topics (created_by);

create table public.entry_versions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  title text not null,
  content_json jsonb not null,
  edited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index entry_versions_entry_idx on public.entry_versions (entry_id, created_at desc);
create index entry_versions_edited_by_idx on public.entry_versions (edited_by);

create function private.touch_updated()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_table_name = 'entries' then
    new.updated_by := coalesce(auth.uid(), new.updated_by);
  end if;
  return new;
end;
$$;

create trigger topics_touch before update on public.topics
  for each row execute function private.touch_updated();
create trigger entries_touch before update on public.entries
  for each row execute function private.touch_updated();

-- Snapshot der alten Fassung, höchstens alle 10 Minuten (Autosave erzeugt sonst Spam).
create function private.snapshot_entry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.content_json is distinct from old.content_json or new.title is distinct from old.title)
     and coalesce(
       (select max(created_at) from public.entry_versions where entry_id = old.id),
       '-infinity'::timestamptz
     ) < now() - interval '10 minutes' then
    insert into public.entry_versions (entry_id, title, content_json, edited_by)
    values (old.id, old.title, old.content_json, old.updated_by);
  end if;
  return new;
end;
$$;

create trigger entries_snapshot after update on public.entries
  for each row execute function private.snapshot_entry();

-- ---------------------------------------------------------------------------
-- Personal & Ansprechpartner
-- ---------------------------------------------------------------------------
create table public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position text not null default '',
  department text not null default '',
  email text not null default '',
  phone text not null default '',
  teams_url text not null default '',
  avatar_url text,
  bio text not null default '',
  tags text[] not null default '{}',
  profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index people_profile_idx on public.people (profile_id);
create index people_name_trgm_idx on public.people using gin (name extensions.gin_trgm_ops);

create table public.topic_contacts (
  topic_id uuid not null references public.topics (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  label text not null default 'Ansprechpartner',
  primary key (topic_id, person_id)
);

create index topic_contacts_person_idx on public.topic_contacts (person_id);

-- ---------------------------------------------------------------------------
-- Favoriten & KI-Nutzung
-- ---------------------------------------------------------------------------
create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, entry_id)
);

create index favorites_entry_idx on public.favorites (entry_id);

create table public.ai_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null default current_date,
  count integer not null default 0,
  primary key (user_id, day)
);

-- Zählt eine KI-Anfrage und liefert false, wenn das Tageslimit erreicht ist.
create function public.consume_ai_quota(daily_limit integer)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  used integer;
begin
  if auth.uid() is null then
    return false;
  end if;
  insert into public.ai_usage (user_id, day, count)
  values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count into used;
  return used <= daily_limit;
end;
$$;

revoke execute on function public.consume_ai_quota(integer) from public, anon;
grant execute on function public.consume_ai_quota(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Suche
-- ---------------------------------------------------------------------------
create function public.search_all(q text, topic_filter uuid default null, max_results integer default 30)
returns table (
  kind text,
  id uuid,
  topic_id uuid,
  topic_slug text,
  topic_name text,
  topic_color text,
  title text,
  snippet text,
  rank real
)
language sql stable
set search_path = public, extensions, pg_temp
as $$
  with input as (
    select
      trim(q) as raw,
      websearch_to_tsquery('german', q) as web,
      (
        select to_tsquery('german', string_agg(quote_literal(w) || ':*', ' & '))
        from regexp_split_to_table(trim(regexp_replace(q, '[^[:alnum:]äöüÄÖÜß\s-]', ' ', 'g')), '\s+') as w
        where w <> ''
      ) as prefix
  ),
  hits as (
    select
      'entry'::text as kind,
      e.id,
      t.id as topic_id,
      t.slug as topic_slug,
      t.name as topic_name,
      t.color as topic_color,
      e.title,
      ts_headline(
        'german', e.content_text, coalesce(i.prefix, i.web),
        'StartSel=⟦, StopSel=⟧, MaxFragments=2, MaxWords=22, MinWords=8, FragmentDelimiter=" … "'
      ) as snippet,
      (
        ts_rank(e.search_vector, i.web) * 2
        + coalesce(ts_rank(e.search_vector, i.prefix), 0)
        + similarity(e.title, i.raw)
      )::real as rank
    from public.entries e
    join public.topics t on t.id = e.topic_id
    cross join input i
    where not t.archived
      and (topic_filter is null or e.topic_id = topic_filter)
      and (
        e.search_vector @@ i.web
        or (i.prefix is not null and e.search_vector @@ i.prefix)
        or e.title % i.raw
        or e.content_text ilike '%' || i.raw || '%'
      )

    union all

    select
      'topic', t.id, t.id, t.slug, t.name, t.color, t.name, t.description,
      (similarity(t.name, i.raw) + case when t.name ilike '%' || i.raw || '%' then 1 else 0 end)::real
    from public.topics t
    cross join input i
    where not t.archived
      and topic_filter is null
      and (t.name ilike '%' || i.raw || '%' or t.name % i.raw or t.description ilike '%' || i.raw || '%')

    union all

    select
      'person', p.id, null, null, null, null, p.name,
      concat_ws(' · ', nullif(p.position, ''), nullif(p.department, ''),
                nullif(array_to_string(p.tags, ', '), '')),
      (
        similarity(p.name, i.raw)
        + case when p.name ilike '%' || i.raw || '%' then 1 else 0 end
        + case when array_to_string(p.tags, ' ') ilike '%' || i.raw || '%' then 0.8 else 0 end
        + case when exists (
            select 1 from public.topic_contacts tc
            join public.topics t2 on t2.id = tc.topic_id
            where tc.person_id = p.id and t2.name ilike '%' || i.raw || '%'
          ) then 0.6 else 0 end
      )::real
    from public.people p
    cross join input i
    where topic_filter is null
      and (
        p.name ilike '%' || i.raw || '%'
        or p.name % i.raw
        or p.position ilike '%' || i.raw || '%'
        or p.department ilike '%' || i.raw || '%'
        or p.bio ilike '%' || i.raw || '%'
        or array_to_string(p.tags, ' ') ilike '%' || i.raw || '%'
        or exists (
          select 1 from public.topic_contacts tc
          join public.topics t2 on t2.id = tc.topic_id
          where tc.person_id = p.id and t2.name ilike '%' || i.raw || '%'
        )
      )
  )
  select * from hits
  where (select raw from input) <> ''
  order by rank desc
  limit greatest(1, least(max_results, 100))
$$;

revoke execute on function public.search_all(text, uuid, integer) from public, anon;
grant execute on function public.search_all(text, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.topics enable row level security;
alter table public.entries enable row level security;
alter table public.entry_versions enable row level security;
alter table public.people enable row level security;
alter table public.topic_contacts enable row level security;
alter table public.favorites enable row level security;
alter table public.ai_usage enable row level security;

create policy "profiles: lesen" on public.profiles for select to authenticated using (true);
create policy "profiles: eigenes oder admin" on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()))
  with check (id = (select auth.uid()) or (select private.is_admin()));

create policy "topics: lesen" on public.topics for select to authenticated using (true);
create policy "topics: anlegen" on public.topics for insert to authenticated
  with check ((select private.is_editor()));
create policy "topics: bearbeiten" on public.topics for update to authenticated
  using ((select private.is_editor())) with check ((select private.is_editor()));
create policy "topics: löschen" on public.topics for delete to authenticated
  using ((select private.is_admin()));

create policy "entries: lesen" on public.entries for select to authenticated using (true);
create policy "entries: anlegen" on public.entries for insert to authenticated
  with check ((select private.is_editor()));
create policy "entries: bearbeiten" on public.entries for update to authenticated
  using ((select private.is_editor())) with check ((select private.is_editor()));
create policy "entries: löschen" on public.entries for delete to authenticated
  using ((select private.is_editor()));

create policy "versions: lesen" on public.entry_versions for select to authenticated using (true);
create policy "versions: anlegen" on public.entry_versions for insert to authenticated
  with check ((select private.is_editor()));

create policy "people: lesen" on public.people for select to authenticated using (true);
create policy "people: anlegen" on public.people for insert to authenticated
  with check ((select private.is_editor()));
create policy "people: bearbeiten" on public.people for update to authenticated
  using ((select private.is_editor())) with check ((select private.is_editor()));
create policy "people: löschen" on public.people for delete to authenticated
  using ((select private.is_editor()));

create policy "contacts: lesen" on public.topic_contacts for select to authenticated using (true);
create policy "contacts: anlegen" on public.topic_contacts for insert to authenticated
  with check ((select private.is_editor()));
create policy "contacts: bearbeiten" on public.topic_contacts for update to authenticated
  using ((select private.is_editor())) with check ((select private.is_editor()));
create policy "contacts: löschen" on public.topic_contacts for delete to authenticated
  using ((select private.is_editor()));

create policy "favorites: eigene lesen" on public.favorites for select to authenticated
  using (user_id = (select auth.uid()));
create policy "favorites: eigene anlegen" on public.favorites for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "favorites: eigene löschen" on public.favorites for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "ai_usage: eigene lesen" on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage: privater Bucket für Bilder (ausgeliefert über /media/... nach Login)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 10485760,
        array['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
on conflict (id) do nothing;

create policy "media: lesen" on storage.objects for select to authenticated
  using (bucket_id = 'media');
create policy "media: hochladen" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (select private.is_editor()));
create policy "media: löschen" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (select private.is_editor()));
