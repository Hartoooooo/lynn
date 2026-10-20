-- Lynn: mehrere Wertpapier-Listen (EIX B / EIX M / HAM) bei gemeinsamem
-- Kategorien-Grundgerüst. Die Wertpapiere werden pro Liste (dataset) getrennt.

alter table public.securities add column if not exists dataset text not null default 'EIX_B';

create index if not exists securities_dataset_idx on public.securities (dataset, category_id);

-- Eindeutigkeit jetzt je Liste: dieselbe ISIN darf in EIX B und EIX M vorkommen.
drop index if exists public.securities_cat_isin_uniq;
create unique index if not exists securities_ds_cat_isin_uniq
  on public.securities (dataset, category_id, isin) where isin <> '';

-- Kategorie-Übersicht mit Zählungen für genau eine Liste.
create or replace function public.security_overview(p_dataset text)
returns table (id uuid, name text, slug text, sort_order integer, total bigint, subcategory_count bigint)
language sql stable
set search_path = public, pg_temp
as $$
  select
    c.id, c.name, c.slug, c.sort_order,
    count(s.id) as total,
    count(distinct nullif(s.subcategory, '')) as subcategory_count
  from public.security_categories c
  left join public.securities s on s.category_id = c.id and s.dataset = p_dataset
  group by c.id, c.name, c.slug, c.sort_order
  order by c.sort_order;
$$;

revoke execute on function public.security_overview(text) from public, anon;
grant execute on function public.security_overview(text) to authenticated;

-- Gesamtanzahl je Liste (für die Listenauswahl).
create or replace function public.security_dataset_counts()
returns table (dataset text, total bigint)
language sql stable
set search_path = public, pg_temp
as $$
  select dataset, count(*) as total from public.securities group by dataset;
$$;

revoke execute on function public.security_dataset_counts() from public, anon;
grant execute on function public.security_dataset_counts() to authenticated;
