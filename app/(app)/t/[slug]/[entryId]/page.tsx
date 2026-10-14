import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { EntryView } from "@/components/entry/entry-view";
import { Toc } from "@/components/entry/toc";
import { IsinFilterPanel, type IsinItem } from "@/components/editor/isin-filter";
import type { Version } from "@/components/entry/versions-dialog";
import { ContactsPanel, type Contact } from "@/components/topic/contacts-panel";
import { getEntry } from "@/lib/queries";
import { canEdit, getSession } from "@/lib/session";

type Params = {
  params: Promise<{ slug: string; entryId: string }>;
  searchParams: Promise<{ neu?: string }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { entryId } = await params;
  if (!UUID.test(entryId)) return { title: "Eintrag" };
  const entry = await getEntry(entryId);
  return { title: entry?.title || "Unbenannt" };
}

export default async function EntryPage({ params, searchParams }: Params) {
  const { slug, entryId } = await params;
  const { neu } = await searchParams;
  if (!UUID.test(entryId)) notFound();
  const [{ supabase, profile, user }, entry] = await Promise.all([getSession(), getEntry(entryId)]);
  if (!entry || !entry.topic) notFound();
  if (entry.topic.slug !== slug) redirect(`/t/${entry.topic.slug}/${entry.id}`);

  const [favRes, versionsRes, contactsRes, siblingsRes, topicsRes] = await Promise.all([
    supabase.from("favorites").select("entry_id").eq("entry_id", entry.id).eq("user_id", user.id).maybeSingle(),
    supabase
      .from("entry_versions")
      .select("id, title, created_at, editor:profiles!entry_versions_edited_by_fkey(full_name)")
      .eq("entry_id", entry.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("topic_contacts")
      .select("label, person:people(id, name, position, email, phone, teams_url, avatar_url)")
      .eq("topic_id", entry.topic.id),
    supabase
      .from("entries")
      .select("id, title")
      .eq("topic_id", entry.topic.id)
      .neq("id", entry.id)
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(8),
    supabase.from("topics").select("id, name").eq("archived", false).order("sort_order"),
  ]);

  const editable = canEdit(profile.role);
  const siblings = siblingsRes.data ?? [];

  return (
    <div className="page-grid has-context">
      <div className="min-w-0">
        <EntryView
          fixed={entry.kind === "isin_filter"}
          header={
            entry.kind === "isin_filter" ? (
              <IsinFilterPanel
                entryId={entry.id}
                initialItems={(entry.isin_items ?? []) as unknown as IsinItem[]}
                canEdit={editable}
              />
            ) : null
          }
          key={entry.id}
          entry={entry}
          topic={entry.topic}
          topics={topicsRes.data ?? []}
          canEdit={editable}
          favorite={Boolean(favRes.data)}
          editorName={entry.editor?.full_name ?? null}
          versions={(versionsRes.data ?? []) as unknown as Version[]}
          isNew={neu === "1"}
        />
      </div>

      <aside className="page-context space-y-9">
        <Toc />
        <ContactsPanel contacts={(contactsRes.data ?? []) as unknown as Contact[]} canEdit={editable} />
        {siblings.length > 0 && (
          <section>
            <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-faint">
              Mehr in {entry.topic.name}
            </h2>
            <ul className="space-y-0.5">
              {siblings.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/t/${entry.topic!.slug}/${s.id}`}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13.5px] text-text-2 hover:bg-surface hover:text-text"
                  >
                    <FileText size={14} className="shrink-0 text-faint" />
                    <span className="truncate">{s.title || "Unbenannt"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}
