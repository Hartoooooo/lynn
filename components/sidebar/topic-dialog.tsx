"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { createTopic, updateTopic } from "@/app/actions";
import { TOPIC_COLORS, TOPIC_ICONS, TopicIcon } from "@/components/topic-icon";
import { Button, Dialog, Input, Label } from "@/components/ui";
import { cn } from "@/lib/utils";

export type TopicDraft = { id?: string; name: string; icon: string; color: string };

export function TopicDialog({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: TopicDraft;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<TopicDraft>(initial ?? { name: "", icon: "folder", color: TOPIC_COLORS[0]! });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editing = Boolean(initial?.id);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        if (editing) {
          await updateTopic(initial!.id!, { name: draft.name, icon: draft.icon, color: draft.color });
          onClose();
        } else {
          const slug = await createTopic(draft);
          onClose();
          router.push(`/t/${slug}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Speichern");
      }
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title={editing ? "Thema bearbeiten" : "Neues Thema"}>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <Label htmlFor="topic-name">Name</Label>
          <div className="flex items-center gap-2">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-border bg-surface"
              aria-hidden
            >
              <TopicIcon name={draft.icon} color={draft.color} size={18} />
            </span>
            <Input
              id="topic-name"
              autoFocus
              required
              maxLength={80}
              value={draft.name}
              placeholder="z. B. Ordertypen"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
        </div>

        <div>
          <Label>Symbol</Label>
          <div className="grid grid-cols-8 gap-1.5">
            {Object.keys(TOPIC_ICONS).map((key) => (
              <button
                type="button"
                key={key}
                onClick={() => setDraft({ ...draft, icon: key })}
                aria-label={key}
                aria-pressed={draft.icon === key}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-lg border transition-colors",
                  draft.icon === key
                    ? "border-accent bg-accent-soft"
                    : "border-transparent hover:border-border hover:bg-surface-2",
                )}
              >
                <TopicIcon name={key} size={16} className={draft.icon === key ? "text-text" : "text-muted"} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Farbe</Label>
          <div className="flex flex-wrap gap-2">
            {TOPIC_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setDraft({ ...draft, color: c })}
                aria-label={`Farbe ${c}`}
                aria-pressed={draft.color === c}
                className="flex h-7 w-7 items-center justify-center rounded-full ring-offset-2 ring-offset-sidebar transition"
                style={{ background: c, boxShadow: draft.color === c ? `0 0 0 2px var(--sidebar), 0 0 0 4px ${c}` : undefined }}
              >
                {draft.color === c && <Check size={14} className="text-[#1f1e1d]" />}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" variant="primary" disabled={pending || !draft.name.trim()}>
            {editing ? "Speichern" : "Thema anlegen"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
