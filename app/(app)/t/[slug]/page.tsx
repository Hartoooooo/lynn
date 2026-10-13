import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import { EntryRow, SectionTitle } from "@/components/entry-row";
import { ContactsPanel, type Contact } from "@/components/topic/contacts-panel";
import { TopicHeader } from "@/components/topic/topic-header";
import { EmptyState } from "@/components/ui";
import { canEdit, getSession, isAdmin } from "@/lib/session";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const { supabase } = await getSession();
  const { data } = await supabase.from("topics").select("name").eq("slug", slug).maybeSingle();
  return { title: data?.name ?? "Thema" };
}

export default async function TopicPage({ params }: Params) {
  const { slug } = await params;
  const { supabase, profile } = await getSession();

  const { data: topic } = await supabase
    .from("topics")
    .select("id, name, slug, icon, color, description, archived")
    .eq("slug", slug)
    .maybeSingle();
  if (!topic) notFound();

  const [entriesRes, contactsRes] = await Promise.all([
    supabase
      .from("entries")
      .select("id, title, updated_at, pinned, content_text, editor:profiles!entries_updated_by_fkey(full_name)")
      .eq("topic_id", topic.id)
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false }),
    supabase
      .from("topic_contacts")
      .select("label, person:people(id, name, position, email, phone, teams_url, avatar_url)")
      .eq("topic_id", topic.id),
  ]);

  const entries = entriesRes.data ?? [];
  const editable = canEdit(profile.role);

  return (
    <div className="page-grid has-context">
      <div className="min-w-0">
        {topic.archived && (
          <div className="mb-6 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-muted">
            Dieses Thema ist archiviert und erscheint nicht mehr in der Navigation.
          </div>
        )}
        <TopicHeader topic={topic} canEdit={editable} isAdmin={isAdmin(profile.role)} count={entries.length} />

        <section className="mt-10">
          {entries.length === 0 ? (
            <EmptyState icon={<FilePlus2 size={28} />} title="Noch keine Einträge">
              {editable ? "Lege über „+ Eintrag“ den ersten Inhalt an." : "Hier wurde noch nichts angelegt."}
            </EmptyState>
          ) : (
            <>
              <SectionTitle>
                {entries.length} {entries.length === 1 ? "Eintrag" : "Einträge"}
              </SectionTitle>
              <div className="-mx-0">
                {entries.map((e) => (
                  <EntryRow
                    key={e.id}
                    showTopic={false}
                    entry={{
                      ...e,
                      excerpt: e.content_text.slice(0, 200),
                      topic: { name: topic.name, slug: topic.slug, color: topic.color },
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      <aside className="page-context">
        <ContactsPanel contacts={(contactsRes.data ?? []) as unknown as Contact[]} canEdit={editable} />
      </aside>
    </div>
  );
}
