import { cache } from "react";
import { getAuth } from "@/lib/session";

// Pro Request gecacht: generateMetadata und Seite teilen sich dieselbe Abfrage.

/** Thema samt Einträgen in einer Abfrage. */
export const getTopicWithEntries = cache(async (slug: string) => {
  const { supabase } = await getAuth();
  const { data } = await supabase
    .from("topics")
    .select(
      "id, name, slug, icon, color, description, archived, entries(id, title, updated_at, pinned, content_text, editor:profiles!entries_updated_by_fkey(full_name))",
    )
    .eq("slug", slug)
    .order("pinned", { referencedTable: "entries", ascending: false })
    .order("updated_at", { referencedTable: "entries", ascending: false })
    .maybeSingle();
  return data;
});

export const getEntry = cache(async (entryId: string) => {
  const { supabase } = await getAuth();
  const { data } = await supabase
    .from("entries")
    .select(
      "id, title, content_json, updated_at, pinned, topic_id, kind, isin_items, topic:topics(id, name, slug, color, icon), editor:profiles!entries_updated_by_fkey(full_name)",
    )
    .eq("id", entryId)
    .maybeSingle();
  return data;
});
