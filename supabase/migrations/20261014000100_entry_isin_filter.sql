-- Fester ISIN-Filter in einem Eintrag (kind = 'isin_filter'), ISINs in eigener Spalte.
alter table public.entries add column kind text, add column isin_items jsonb not null default '[]'::jsonb;

update public.entries
set kind = 'isin_filter',
    isin_items = coalesce((select n->'attrs'->'items' from jsonb_array_elements(content_json->'content') n where n->>'type' = 'isinFilter' limit 1), '[]'::jsonb),
    content_json = jsonb_build_object('type','doc','content', coalesce((select jsonb_agg(n) from jsonb_array_elements(content_json->'content') n where n->>'type' <> 'isinFilter'), '[]'::jsonb)),
    content_text = ''
where id = '278b2f16-1e2d-440a-9e23-a01c0425fd57';

-- ISINs im Suchtext halten, egal ob Editor-Text oder ISIN-Liste gespeichert wird.
create function private.isin_search_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'isin_filter' then
    new.content_text := regexp_replace(coalesce(new.content_text, ''), '\n?ISIN-Filter:.*$', '')
      || E'\nISIN-Filter: '
      || coalesce((select string_agg(i->>'isin', ' ') from jsonb_array_elements(new.isin_items) i), '');
  end if;
  return new;
end;
$$;

create trigger entries_isin_search before insert or update on public.entries
  for each row execute function private.isin_search_text();

update public.entries set isin_items = isin_items where kind = 'isin_filter';
