import Link from "next/link";
import { FolderPlus, Star } from "lucide-react";
import { EntryRow, SectionTitle, type EntryRowData } from "@/components/entry-row";
import { TopicIcon } from "@/components/topic-icon";
import { EmptyState } from "@/components/ui";
import { getSession } from "@/lib/session";

const ENTRY_FIELDS =
  "id, title, updated_at, pinned, content_text, topic:topics!inner(name, slug, color, archived), editor:profiles!entries_updated_by_fkey(full_name)" as const;

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("de-DE", { hour: "numeric", hour12: false, timeZone: "Europe/Berlin" }).format(new Date()),
  );
  if (hour < 11) return "Guten Morgen";
  if (hour < 18) return "Hallo";
  return "Guten Abend";
}

type Row = {
  id: string;
  title: string;
  updated_at: string;
  pinned: boolean;
  content_text: string;
  topic: { name: string; slug: string; color: string; archived: boolean } | null;
  editor: { full_name: string } | null;
};

function toRow(e: Row): EntryRowData {
  return { ...e, excerpt: e.content_text.slice(0, 180) };
}

export default async function HomePage() {
  const { supabase, profile, user } = await getSession();

  const [topicsRes, recentRes, pinnedRes, favRes] = await Promise.all([
    supabase
      .from("topics")
      .select("id, name, slug, icon, color, description, entries(count)")
      .eq("archived", false)
      .order("sort_order"),
    supabase
      .from("entries")
      .select(ENTRY_FIELDS)
      .eq("topic.archived", false)
      .order("updated_at", { ascending: false })
      .limit(8),
    supabase
      .from("entries")
      .select(ENTRY_FIELDS)
      .eq("pinned", true)
      .eq("topic.archived", false)
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("favorites")
      .select(`created_at, entry:entries!inner(${ENTRY_FIELDS})`)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const topics = topicsRes.data ?? [];
  const recent = ((recentRes.data ?? []) as unknown as Row[]).map(toRow);
  const pinned = ((pinnedRes.data ?? []) as unknown as Row[]).map(toRow);
  const favorites = ((favRes.data ?? []) as unknown as { entry: Row }[]).map((f) => toRow(f.entry));
  const firstName = (profile.full_name || "").split(" ")[0];

  return (
    <div className="mx-auto max-w-[800px] px-8 pt-14 max-[900px]:px-5">
      <header className="mb-10 animate-fade-up">
        <h1 className="font-serif text-[34px] font-medium leading-tight tracking-tight">
          {greeting()}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-2 text-muted">
          Was suchst du heute? Nutze die Suche unten oder stöbere in den Themen.
        </p>
      </header>

      {topics.length === 0 ? (
        <EmptyState icon={<FolderPlus size={28} />} title="Noch keine Themen">
          Lege links in der Seitenleiste über „Thema hinzufügen“ den ersten Themenbereich an.
        </EmptyState>
      ) : (
        <section className="mb-12">
          <SectionTitle>Themen</SectionTitle>
          <div className="grid grid-cols-2 gap-2.5 px-1 [@media(min-width:1100px)]:grid-cols-3">
            {topics.map((t) => {
              const count = (t.entries as unknown as { count: number }[])[0]?.count ?? 0;
              return (
                <Link
                  key={t.id}
                  href={`/t/${t.slug}`}
                  className="group rounded-xl border border-border bg-surface p-4 transition hover:border-border-strong hover:bg-surface-2"
                >
                  <span
                    className="mb-3 flex h-9 w-9 items-center justify-center rounded-[10px]"
                    style={{ background: `${t.color}22` }}
                  >
                    <TopicIcon name={t.icon} color={t.color} size={17} />
                  </span>
                  <div className="truncate font-medium text-text">{t.name}</div>
                  <div className="mt-0.5 text-[12.5px] text-faint">
                    {count} {count === 1 ? "Eintrag" : "Einträge"}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {pinned.length > 0 && (
        <section className="mb-10">
          <SectionTitle>Angepinnt</SectionTitle>
          <div>{pinned.map((e) => <EntryRow key={e.id} entry={e} />)}</div>
        </section>
      )}

      {favorites.length > 0 && (
        <section className="mb-10">
          <SectionTitle
            action={
              <Link href="/favoriten" className="text-[12px] text-muted hover:text-text">
                Alle anzeigen
              </Link>
            }
          >
            <span className="flex items-center gap-1.5">
              <Star size={12} /> Meine Favoriten
            </span>
          </SectionTitle>
          <div>{favorites.map((e) => <EntryRow key={e.id} entry={e} />)}</div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="mb-10">
          <SectionTitle>Zuletzt geändert</SectionTitle>
          <div>{recent.map((e) => <EntryRow key={e.id} entry={e} />)}</div>
        </section>
      )}
    </div>
  );
}
