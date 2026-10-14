-- Beispieldaten für Lynn (idempotent: nur ausführen, wenn noch keine Themen existieren)

do $$
declare
  t_handel uuid; t_order uuid; t_kosten uuid; t_compliance uuid; t_it uuid;
begin
  if exists (select 1 from public.topics) then
    return;
  end if;

  insert into public.topics (name, slug, icon, color, description, sort_order) values
    ('Handelszeiten & Börsenplätze', 'handelszeiten', 'clock', '#d97757', 'Öffnungszeiten, Feiertage und Handelsplätze', 0)
    returning id into t_handel;
  insert into public.topics (name, slug, icon, color, description, sort_order) values
    ('Ordertypen', 'ordertypen', 'list-ordered', '#6a9bcc', 'Limit, Stop, Trailing und Co.', 1)
    returning id into t_order;
  insert into public.topics (name, slug, icon, color, description, sort_order) values
    ('Gebühren & Kosten', 'gebuehren', 'receipt', '#8fb573', 'Entgelte, Spreads und Fremdkosten', 2)
    returning id into t_kosten;
  insert into public.topics (name, slug, icon, color, description, sort_order) values
    ('Compliance', 'compliance', 'shield-check', '#c99a4b', 'Regeln, Meldepflichten und Prüfprozesse', 3)
    returning id into t_compliance;
  insert into public.topics (name, slug, icon, color, description, sort_order) values
    ('IT & Systeme', 'it-systeme', 'server', '#a58bd0', 'Handelssysteme, Zugänge und Störungen', 4)
    returning id into t_it;

  insert into public.entries (topic_id, title, content_text, content_json, pinned) values
  (t_handel, 'Xetra Handelszeiten',
   'Der Xetra-Handel läuft von 9:00 bis 17:30 Uhr. Die Eröffnungsauktion beginnt um 8:50 Uhr, die Schlussauktion um 17:30 Uhr. An Börsenfeiertagen findet kein Handel statt.',
   jsonb_build_object('type','doc','content', jsonb_build_array(
     jsonb_build_object('type','heading','attrs',jsonb_build_object('level',2),'content',jsonb_build_array(jsonb_build_object('type','text','text','Übersicht'))),
     jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text','Der Xetra-Handel läuft von 9:00 bis 17:30 Uhr. Die Eröffnungsauktion beginnt um 8:50 Uhr, die Schlussauktion um 17:30 Uhr.'))),
     jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text','An Börsenfeiertagen findet kein Handel statt.')))
   )), true),
  (t_handel, 'Börsenfeiertage 2026',
   'Kein Handel an Neujahr, Karfreitag, Ostermontag, 1. Mai, Heiligabend, 1. und 2. Weihnachtsfeiertag sowie Silvester.',
   jsonb_build_object('type','doc','content', jsonb_build_array(
     jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text','Kein Handel an Neujahr, Karfreitag, Ostermontag, 1. Mai, Heiligabend, 1. und 2. Weihnachtsfeiertag sowie Silvester.')))
   )), false),
  (t_order, 'Stop-Loss vs. Stop-Limit',
   'Eine Stop-Loss-Order wird bei Erreichen des Stopkurses zur Market-Order. Eine Stop-Limit-Order wird zur Limit-Order und garantiert keinen Ausführungspreis unterhalb des Limits.',
   jsonb_build_object('type','doc','content', jsonb_build_array(
     jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text','Eine Stop-Loss-Order wird bei Erreichen des Stopkurses zur Market-Order.'))),
     jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text','Eine Stop-Limit-Order wird zur Limit-Order und garantiert keinen Ausführungspreis unterhalb des Limits.')))
   )), true),
  (t_kosten, 'Ordergebühren Übersicht',
   'Pro Order fällt ein Grundentgelt an, dazu kommen Börsenentgelte und gegebenenfalls Fremdspesen des Handelsplatzes.',
   jsonb_build_object('type','doc','content', jsonb_build_array(
     jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text','Pro Order fällt ein Grundentgelt an, dazu kommen Börsenentgelte und gegebenenfalls Fremdspesen des Handelsplatzes.')))
   )), false),
  (t_compliance, 'Mitarbeitergeschäfte melden',
   'Eigene Wertpapiergeschäfte von Mitarbeitern müssen vor Ausführung bei Compliance angezeigt werden. Sperrfristen und Insiderlisten sind zu beachten.',
   jsonb_build_object('type','doc','content', jsonb_build_array(
     jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text','Eigene Wertpapiergeschäfte von Mitarbeitern müssen vor Ausführung bei Compliance angezeigt werden. Sperrfristen und Insiderlisten sind zu beachten.')))
   )), false),
  (t_it, 'Störung im Ordersystem melden',
   'Bei Ausfall des Ordersystems sofort die IT-Hotline anrufen und den Vorfall im Ticketsystem dokumentieren. Notfall-Orders laufen über das Telefonbuch-Verfahren.',
   jsonb_build_object('type','doc','content', jsonb_build_array(
     jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text','Bei Ausfall des Ordersystems sofort die IT-Hotline anrufen und den Vorfall im Ticketsystem dokumentieren.'))),
     jsonb_build_object('type','paragraph','content',jsonb_build_array(jsonb_build_object('type','text','text','Notfall-Orders laufen über das Telefonbuch-Verfahren.')))
   )), false);

end;
$$;
