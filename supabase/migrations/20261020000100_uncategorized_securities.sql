-- Lynn: Nicht klassifizierbare Wertpapiere je Liste parken, um sie später
-- von Hand einzusortieren.

create table public.uncategorized_securities (
  id uuid primary key default gen_random_uuid(),
  dataset text not null default 'EIX_B',
  input text not null default '',
  isin text not null default '',
  wkn text not null default '',
  name text not null default '',
  kuerzel text not null default '',
  hebel integer,
  underlying_name text not null default '',
  underlying_isin text not null default '',
  quelle text not null default '',
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index uncat_dataset_idx on public.uncategorized_securities (dataset);
create unique index uncat_ds_isin_uniq on public.uncategorized_securities (dataset, isin) where isin <> '';

alter table public.uncategorized_securities enable row level security;

create policy "uncat: lesen" on public.uncategorized_securities for select to authenticated using (true);
create policy "uncat: anlegen" on public.uncategorized_securities for insert to authenticated
  with check ((select private.is_editor()));
create policy "uncat: bearbeiten" on public.uncategorized_securities for update to authenticated
  using ((select private.is_editor())) with check ((select private.is_editor()));
create policy "uncat: löschen" on public.uncategorized_securities for delete to authenticated
  using ((select private.is_editor()));
