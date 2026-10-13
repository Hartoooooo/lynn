import type { Metadata } from "next";
import { Star } from "lucide-react";
import { EntryRow } from "@/components/entry-row";
import { EmptyState } from "@/components/ui";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Favoriten" };

type Row = {
  entry: {
    id: string;
    title: string;
    updated_at: string;
    pinned: boolean;
    content_text: string;
    topic: { name: string; slug: string; color: string } | null;
    editor: { full_name: string } | null;
  };
};

export default async function FavoritesPage() {
  const { supabase, user } = await getSession();
  const { data } = await supabase
    .from("favorites")
    .select(
      "created_at, entry:entries!inner(id, title, updated_at, pinned, content_text, topic:topics(name, slug, color), editor:profiles!entries_updated_by_fkey(full_name))",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="mx-auto max-w-[800px] px-8 pt-12 max-[900px]:px-5">
      <h1 className="font-serif text-[30px] font-medium tracking-tight">Favoriten</h1>
      <p className="mb-8 mt-1 text-muted">Deine gemerkten Einträge – markiere Einträge mit dem Stern.</p>
      {rows.length === 0 ? (
        <EmptyState icon={<Star size={28} />} title="Noch keine Favoriten">
          Öffne einen Eintrag und klicke oben rechts auf den Stern.
        </EmptyState>
      ) : (
        rows.map((r) => <EntryRow key={r.entry.id} entry={{ ...r.entry, excerpt: r.entry.content_text.slice(0, 180) }} />)
      )}
    </div>
  );
}
