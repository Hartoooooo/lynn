import Link from "next/link";
import { FileText, Pin } from "lucide-react";
import { timeAgo } from "@/lib/utils";

export type EntryRowData = {
  id: string;
  title: string;
  updated_at: string;
  pinned?: boolean;
  excerpt?: string;
  topic: { name: string; slug: string; color: string } | null;
  editor?: { full_name: string } | null;
};

export function EntryRow({ entry, showTopic = true }: { entry: EntryRowData; showTopic?: boolean }) {
  if (!entry.topic) return null;
  return (
    <Link
      href={`/t/${entry.topic.slug}/${entry.id}`}
      className="group flex items-start gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-surface"
    >
      <FileText size={16} className="mt-[3px] shrink-0 text-faint group-hover:text-muted" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-text">{entry.title || "Unbenannt"}</span>
          {entry.pinned && <Pin size={12} className="shrink-0 text-accent" aria-label="Angepinnt" />}
        </div>
        {entry.excerpt && <p className="mt-0.5 line-clamp-2 text-[13.5px] text-muted">{entry.excerpt}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-faint">
          {showTopic && (
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: entry.topic.color }} />
              {entry.topic.name}
            </span>
          )}
          {showTopic && <span aria-hidden>·</span>}
          <span>
            {timeAgo(entry.updated_at)}
            {entry.editor?.full_name ? ` von ${entry.editor.full_name}` : ""}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between px-3">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-faint">{children}</h2>
      {action}
    </div>
  );
}
