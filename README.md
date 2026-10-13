# Lynn

Die zentrale Wissensbasis für den Aktienplatz: Themenbereiche mit Einträgen (Text und Bilder), eine Suchleiste mit optionaler KI-Suche und ein Personalverzeichnis mit Ansprechpartnern pro Thema.

Gebaut für **Hochkant-Monitore** (1080×1920, 1440×2560). Auf Quer-Monitoren ab 1400 px Breite erscheint rechts eine zusätzliche Kontextspalte mit Inhaltsverzeichnis, Ansprechpartnern und verwandten Einträgen.

## Funktionen

- **Themenbereiche**: Ihr legt sie selbst an, benennt sie direkt in der Seitenleiste oder in der Überschrift um, wählt Symbol und Farbe und sortiert per Drag & Drop. Admins können Themen archivieren und löschen.
- **Einträge**: Editor mit Überschriften, Listen, Tabellen, Links und Zitaten. Bilder lassen sich per Drag & Drop, Einfügen oder Button hochladen. Änderungen werden automatisch gespeichert, der Versionsverlauf lässt sich wiederherstellen. Dazu kommen Anpinnen, Favoriten und Verschieben in ein anderes Thema.
- **Suche** (unten, `Strg K` oder `/`):
  - *Standard*: Volltextsuche über Einträge, Themen und Personal. Sie nutzt die deutsche Wortstammsuche, verzeiht Tippfehler, hebt Treffer hervor und lässt sich auf das aktuelle Thema einschränken.
  - *KI-Schalter*: Claude durchsucht die Wissensbasis selbstständig und antwortet mit Quellen-Links. Der Schalter ist nur aktiv, wenn `ANTHROPIC_API_KEY` gesetzt ist. Es gibt ein Tageslimit pro Nutzer.
- **Personal**: Ansprechpartner mit Foto, Kontaktdaten, Teams-Link, Fachgebieten und Themenzuordnung (z. B. Hauptansprechpartner oder Vertretung). Die Suche beantwortet „Wer kennt sich aus mit …?“.
- **Rollen**: Admin, Editor und Leser. Das erste Konto wird automatisch Admin, alle weiteren starten als Leser. Rollen vergebt ihr unter *Einstellungen*.

## Technik

- Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4
- Supabase: Postgres mit Row Level Security, Auth per Magic-Link, privater Storage-Bucket `media`
- Tiptap 3 (Editor), dnd-kit (Sortierung), lucide-react (Icons)
- Anthropic SDK für die KI-Suche (Standardmodell `claude-opus-5-5` mit niedrigem Effort und serverseitigem Fallback)

```
app/(app)/            Seiten nach dem Login (Start, Themen, Einträge, Personal, Favoriten, Einstellungen)
app/(auth)/login      Anmeldung per Magic-Link
app/api/ai-search     KI-Suche (Claude + Such-Tool, Streaming als NDJSON)
app/media/[...path]   Liefert Bilder aus dem privaten Bucket nur an angemeldete Nutzer
app/actions.ts        Server Actions (Themen, Einträge, Personal, Rollen)
components/           UI-Bausteine (Sidebar, Suchleiste, Editor, Personal …)
supabase/migrations/  Datenbankschema, RLS, Such-Funktion search_all
supabase/seed.sql     Beispieldaten
```

## Einrichtung

1. Abhängigkeiten installieren: `npm install`
2. `.env.example` nach `.env.local` kopieren und ausfüllen. Die Werte für Supabase findet ihr unter *Project Settings → API*.
3. Migrationen aus `supabase/migrations/` in dieser Reihenfolge einspielen (SQL-Editor oder `supabase db push`), optional danach `supabase/seed.sql`.
4. In Supabase unter *Authentication → URL Configuration* die Site-URL und die Redirect-URL `https://<eure-domain>/auth/callback` eintragen (lokal: `http://localhost:3000/auth/callback`).
5. Entwicklungsserver starten: `npm run dev`

> Das Supabase-Projekt **lynn** (Region eu-central-1, Frankfurt) ist bereits angelegt. Schema und Beispieldaten sind eingespielt.

### Deployment auf Vercel

Repository in Vercel importieren und diese Umgebungsvariablen setzen:

| Variable | Pflicht | Beschreibung |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ja | Supabase-Projekt-URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ja | Publishable/Anon-Key |
| `ANTHROPIC_API_KEY` | nein | Schaltet die KI-Suche frei |
| `ANTHROPIC_MODEL` | nein | Standard: `claude-opus-5-5` |
| `AI_DAILY_LIMIT` | nein | KI-Anfragen pro Nutzer und Tag (Standard 50) |

### Zugang einschränken

Die Anmeldung ist für jede E-Mail-Adresse offen, neue Konten sind aber nur Leser. Wer den Zugang auf die eigene Firma beschränken will:

- in Supabase unter *Authentication → Providers → Email* „Allow new users to sign up“ deaktivieren und Nutzer einladen, oder
- einen Auth-Hook nutzen, der nur die eigene E-Mail-Domain zulässt.

Für den produktiven Mailversand der Magic-Links empfiehlt sich ein eigener SMTP-Server (*Authentication → SMTP Settings*), weil der eingebaute Versand stark limitiert ist.

## Skripte

- `npm run dev`: Entwicklungsserver
- `npm run build`: Produktions-Build inklusive Typprüfung
- `npm run lint`: ESLint

## Ideen für später

- Ankündigungs-Banner auf der Startseite, z. B. für Handelszeiten, Feiertage oder Systemänderungen
- Glossar mit automatisch verlinkten Fachbegriffen
- „Veraltet?“-Hinweis mit Verantwortlichen und einem „Geprüft“-Button
- Vorlagen für Einträge (Prozess, Checkliste, FAQ)
- Dateianhänge (PDF, Excel) mit Vorschau
- Benachrichtigungen für abonnierte Themen und ein Audit-Log
- Markt-Widgets (Ticker, Handelskalender)
