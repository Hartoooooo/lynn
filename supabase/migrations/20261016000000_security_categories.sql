-- Lynn: Wertpapier-Kategorien (aus der EIX_B-Kategorienliste)
-- Jedes Excel-Blatt = eine Oberkategorie, der Text in Spalte A = Unterkategorie.

create table public.security_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 80),
  slug text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.securities (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.security_categories (id) on delete cascade,
  subcategory text not null default '',
  wkn text not null default '',
  name text not null default '',
  isin text not null default '',
  kuerzel text not null default '',
  hebel integer,
  underlying_name text not null default '',
  underlying_isin text not null default '',
  -- Herkunft des Eintrags: 'excel' (Importliste) oder 'klassifizierer' (automatisch zugeordnet)
  source text not null default 'excel',
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index securities_category_idx on public.securities (category_id);
create index securities_isin_idx on public.securities (isin);
create index securities_subcat_idx on public.securities (category_id, subcategory);
create index securities_name_trgm_idx on public.securities using gin (name extensions.gin_trgm_ops);
-- Pro Oberkategorie keine doppelte ISIN (eine ISIN darf aber in mehreren Kategorien vorkommen).
create unique index securities_cat_isin_uniq on public.securities (category_id, isin) where isin <> '';

-- ---------------------------------------------------------------------------
-- Row Level Security: lesen alle Angemeldeten, schreiben nur Redakteure/Admins
-- ---------------------------------------------------------------------------
alter table public.security_categories enable row level security;
alter table public.securities enable row level security;

create policy "security_categories: lesen" on public.security_categories for select to authenticated using (true);
create policy "security_categories: anlegen" on public.security_categories for insert to authenticated
  with check ((select private.is_editor()));
create policy "security_categories: bearbeiten" on public.security_categories for update to authenticated
  using ((select private.is_editor())) with check ((select private.is_editor()));
create policy "security_categories: löschen" on public.security_categories for delete to authenticated
  using ((select private.is_admin()));

create policy "securities: lesen" on public.securities for select to authenticated using (true);
create policy "securities: anlegen" on public.securities for insert to authenticated
  with check ((select private.is_editor()));
create policy "securities: bearbeiten" on public.securities for update to authenticated
  using ((select private.is_editor())) with check ((select private.is_editor()));
create policy "securities: löschen" on public.securities for delete to authenticated
  using ((select private.is_editor()));

-- Übersicht mit Zählungen je Kategorie (für die Kachelansicht).
create view public.security_category_overview
  with (security_invoker = on)
as
  select
    c.id,
    c.name,
    c.slug,
    c.sort_order,
    count(s.id) as total,
    count(distinct nullif(s.subcategory, '')) as subcategory_count
  from public.security_categories c
  left join public.securities s on s.category_id = c.id
  group by c.id, c.name, c.slug, c.sort_order;

grant select on public.security_category_overview to authenticated;
