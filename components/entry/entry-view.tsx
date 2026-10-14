"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { JSONContent } from "@tiptap/core";
import { Check, ChevronRight, CloudOff, FolderInput, History, Loader2, MoreHorizontal, Pin, PinOff, Star, Trash2 } from "lucide-react";
import { deleteEntry, moveEntry, saveEntry, setEntryPinned, toggleFavorite } from "@/app/actions";
import { Editor } from "@/components/editor/editor";
import { TopicIcon } from "@/components/topic-icon";
import { Button, Dialog, Menu, type MenuItem } from "@/components/ui";
import type { Json } from "@/lib/database.types";
import { cn, timeAgo } from "@/lib/utils";
import { VersionsDialog, type Version } from "./versions-dialog";

type SaveState = "saved" | "dirty" | "saving" | "error";

export function EntryView({
  entry,
  topic,
  topics,
  canEdit,
  favorite: initialFavorite,
  editorName,
  versions,
  isNew,
  fixed = false,
  header,
}: {
  entry: { id: string; title: string; content_json: Json; updated_at: string; pinned: boolean };
  topic: { id: string; name: string; slug: string; color: string; icon: string };
  topics: { id: string; name: string }[];
  canEdit: boolean;
  favorite: boolean;
  editorName: string | null;
  versions: Version[];
  isNew: boolean;
  /** Fester Eintrag (z. B. ISIN-Filter): nicht löschbar und nicht verschiebbar. */
  fixed?: boolean;
  header?: React.ReactNode;
}) {
  const [title, setTitle] = useState(entry.title);
  const [favorite, setFavorite] = useState(initialFavorite);
  const [pinned, setPinned] = useState(entry.pinned);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [updatedAt, setUpdatedAt] = useState(entry.updated_at);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"versions" | "move" | null>(null);
  const [, startTransition] = useTransition();

  const pending = useRef<{ title?: string; content_json?: Json; content_text?: string }>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const path = `/t/${topic.slug}/${entry.id}`;

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const patch = pending.current;
    if (!Object.keys(patch).length) return;
    pending.current = {};
    setSaveState("saving");
    try {
      const at = await saveEntry(entry.id, patch);
      setUpdatedAt(at);
      setSaveState(Object.keys(pending.current).length ? "dirty" : "saved");
    } catch {
      pending.current = { ...patch, ...pending.current };
      setSaveState("error");
    }
  }, [entry.id]);

  const queue = useCallback(
    (patch: typeof pending.current) => {
      pending.current = { ...pending.current, ...patch };
      setSaveState("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 900);
    },
    [flush],
  );

  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length) {
        void flush();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      void flush();
    };
  }, [flush]);

  const menuItems: MenuItem[] = [
    { label: "Versionsverlauf", icon: <History size={14} />, onSelect: () => setDialog("versions") },
  ];
  if (canEdit) {
    menuItems.push(
      {
        label: pinned ? "Nicht mehr anpinnen" : "Anpinnen",
        icon: pinned ? <PinOff size={14} /> : <Pin size={14} />,
        onSelect: () => {
          setPinned(!pinned);
          startTransition(() => setEntryPinned(entry.id, !pinned, path));
        },
      },
    );
  }
  if (canEdit && !fixed) {
    menuItems.push(
      { label: "In anderes Thema verschieben", icon: <FolderInput size={14} />, onSelect: () => setDialog("move") },
      "separator",
      {
        label: "Eintrag löschen",
        icon: <Trash2 size={14} />,
        danger: true,
        onSelect: () => {
          if (confirm(`„${title || "Unbenannt"}“ endgültig löschen?`)) {
            pending.current = {};
            startTransition(() => deleteEntry(entry.id, topic.slug));
          }
        },
      },
    );
  }

  return (
    <article className="animate-fade-up">
      <div className="mb-6 flex items-center gap-3">
        <nav className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted" aria-label="Brotkrumen">
          <Link href={`/t/${topic.slug}`} className="flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-surface hover:text-text">
            <TopicIcon name={topic.icon} color={topic.color} size={14} />
            <span className="truncate">{topic.name}</span>
          </Link>
          <ChevronRight size={13} className="shrink-0 text-faint" />
          <span className="truncate text-faint">{title || "Unbenannt"}</span>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {canEdit && <SaveIndicator state={saveState} updatedAt={updatedAt} onRetry={flush} />}
          <Button
            variant="ghost"
            size="icon"
            aria-label={favorite ? "Aus Favoriten entfernen" : "Zu Favoriten"}
            title={favorite ? "Aus Favoriten entfernen" : "Zu Favoriten"}
            onClick={() => {
              setFavorite(!favorite);
              startTransition(() => toggleFavorite(entry.id, !favorite));
            }}
          >
            <Star size={16} className={cn(favorite && "fill-accent text-accent")} />
          </Button>
          <Menu
            align="right"
            trigger={(p) => (
              <Button {...p} variant="ghost" size="icon" aria-label="Weitere Optionen">
                <MoreHorizontal size={17} />
              </Button>
            )}
            items={menuItems}
          />
        </div>
      </div>

      {canEdit ? (
        <textarea
          value={title}
          rows={1}
          autoFocus={isNew}
          placeholder="Titel"
          aria-label="Titel"
          onChange={(e) => {
            const v = e.target.value.replace(/\n/g, " ");
            setTitle(v);
            queue({ title: v });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (document.querySelector("#entry-content") as HTMLElement | null)?.focus();
            }
          }}
          className="field-sizing-content w-full resize-none bg-transparent font-serif text-[34px] font-medium leading-tight tracking-tight text-text outline-none placeholder:text-faint"
        />
      ) : (
        <h1 className="font-serif text-[34px] font-medium leading-tight tracking-tight">{title || "Unbenannt"}</h1>
      )}

      <div className="mb-8 mt-2 flex items-center gap-2 text-[12.5px] text-faint">
        {pinned && (
          <span className="flex items-center gap-1 text-accent">
            <Pin size={12} /> Angepinnt ·
          </span>
        )}
        Zuletzt bearbeitet {timeAgo(updatedAt)}
        {editorName ? ` von ${editorName}` : ""}
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-danger/40 bg-danger/10 px-4 py-2 text-sm text-danger">
          {error}
          <button onClick={() => setError(null)} className="text-xs underline">
            OK
          </button>
        </div>
      )}

      {header}

      <Editor
        entryId={entry.id}
        content={entry.content_json as JSONContent}
        editable={canEdit}
        onChange={(json, text) => queue({ content_json: json as Json, content_text: text })}
        onError={setError}
      />

      {dialog === "versions" && (
        <VersionsDialog
          entryId={entry.id}
          path={path}
          versions={versions}
          canEdit={canEdit}
          onClose={() => setDialog(null)}
          onRestored={() => window.location.reload()}
        />
      )}

      {dialog === "move" && (
        <Dialog open title="In anderes Thema verschieben" onClose={() => setDialog(null)}>
          <div className="space-y-1">
            {topics
              .filter((t) => t.id !== topic.id)
              .map((t) => (
                <button
                  key={t.id}
                  onClick={async () => {
                    await flush();
                    startTransition(() => moveEntry(entry.id, t.id));
                  }}
                  className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-text-2 hover:bg-surface-2 hover:text-text"
                >
                  {t.name}
                </button>
              ))}
          </div>
        </Dialog>
      )}
    </article>
  );
}

function SaveIndicator({ state, updatedAt, onRetry }: { state: SaveState; updatedAt: string; onRetry: () => void }) {
  if (state === "error") {
    return (
      <button onClick={onRetry} className="mr-1 flex items-center gap-1.5 text-[12px] text-danger" title="Erneut speichern">
        <CloudOff size={13} /> Nicht gespeichert
      </button>
    );
  }
  return (
    <span className="mr-1 flex items-center gap-1.5 text-[12px] text-faint" title={new Date(updatedAt).toLocaleString("de-DE")}>
      {state === "saved" ? <Check size={13} /> : <Loader2 size={13} className="animate-spin" />}
      {state === "saved" ? "Gespeichert" : "Speichert …"}
    </span>
  );
}
