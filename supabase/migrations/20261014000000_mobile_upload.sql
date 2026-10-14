-- Foto-Upload per Handy: Der Desktop erzeugt eine kurzlebige Sitzung (QR-Code),
-- das Handy darf ohne Login nur in den Ordner mobile/<sitzung>/ hochladen.

create table public.mobile_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes'
);

create index mobile_upload_sessions_entry_idx on public.mobile_upload_sessions (entry_id);
create index mobile_upload_sessions_created_by_idx on public.mobile_upload_sessions (created_by);

alter table public.mobile_upload_sessions enable row level security;

create policy "mobile: eigene lesen" on public.mobile_upload_sessions for select to authenticated
  using (created_by = (select auth.uid()));
create policy "mobile: anlegen" on public.mobile_upload_sessions for insert to authenticated
  with check (created_by = (select auth.uid()) and (select private.is_editor()));
create policy "mobile: eigene beenden" on public.mobile_upload_sessions for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));

-- Gültigkeit einer Sitzung (für die Storage-Policy, auch ohne Login aufrufbar).
create function private.mobile_session_valid(session text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.mobile_upload_sessions
    where id::text = session and expires_at > now()
  )
$$;

grant usage on schema private to anon;
grant execute on function private.mobile_session_valid(text) to anon, authenticated;

-- Ablaufzeit für die Handy-Seite (null = unbekannt oder abgelaufen).
create function public.mobile_session_expires(session uuid)
returns timestamptz
language sql stable security definer
set search_path = ''
as $$
  select expires_at from public.mobile_upload_sessions
  where id = session and expires_at > now()
$$;

revoke execute on function public.mobile_session_expires(uuid) from public;
grant execute on function public.mobile_session_expires(uuid) to anon, authenticated;

-- Handy (ohne Login) darf nur in mobile/<gültige-sitzung>/ hochladen, nichts lesen.
create policy "media: handy-upload" on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'mobile'
    and private.mobile_session_valid((storage.foldername(name))[2])
  );
