"use client";

import { useState, useTransition } from "react";
import { Archive, MoreHorizontal, Palette, Plus, Trash2 } from "lucide-react";
import { createEntry, deleteTopic, setTopicArchived, updateTopic } from "@/app/actions";
import { TopicDialog } from "@/components/sidebar/topic-dialog";
import { TopicIcon } from "@/components/topic-icon";
import { Button, Menu, type MenuItem } from "@/components/ui";

type Topic = { id: string; name: string; slug: string; icon: string; color: string; description: string };

export function TopicHeader({ topic, canEdit, isAdmin, count }: { topic: Topic; canEdit: boolean; isAdmin: boolean; count: number }) {
  const [name, setName] = useState(topic.name);
  const [description, setDescription] = useState(topic.description);
  const [dialog, setDialog] = useState(false);
  const [pending, startTransition] = useTransition();

  function saveName(value: string) {
    const v = value.trim();
    if (!v) return setName(topic.name);
    if (v === topic.name) return;
    setName(v);
    startTransition(() => updateTopic(topic.id, { name: v }));
  }

  function saveDescription(value: string) {
    const v = value.trim();
    if (v === topic.description) return;
    setDescription(v);
    startTransition(() => updateTopic(topic.id, { description: v }));
  }

  const menuItems: MenuItem[] = [
    { label: "Symbol & Farbe", icon: <Palette size={14} />, onSelect: () => setDialog(true) },
  ];
  if (isAdmin) {
    menuItems.push(
      "separator",
      {
        label: "Archivieren",
        icon: <Archive size={14} />,
        onSelect: () =>
          startTransition(async () => {
            await setTopicArchived(topic.id, true);
            window.location.href = "/";
          }),
      },
      {
        label: "Thema löschen",
        icon: <Trash2 size={14} />,
        danger: true,
        onSelect: () => {
          if (confirm(`„${topic.name}“ und alle ${count} Einträge endgültig löschen?`)) {
            startTransition(() => deleteTopic(topic.id));
          }
        },
      },
    );
  }

  return (
    <header className="animate-fade-up">
      <div className="flex items-start gap-4">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${topic.color}22` }}
        >
          <TopicIcon name={topic.icon} color={topic.color} size={22} />
        </span>
        <div className="min-w-0 flex-1">
          {canEdit ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={(e) => saveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  setName(topic.name);
                  e.currentTarget.blur();
                }
              }}
              maxLength={80}
              aria-label="Themenname"
              className="-ml-1.5 w-full rounded-lg bg-transparent px-1.5 font-serif text-[30px] font-medium leading-tight tracking-tight text-text outline-none transition hover:bg-surface focus:bg-surface"
            />
          ) : (
            <h1 className="font-serif text-[30px] font-medium leading-tight tracking-tight">{name}</h1>
          )}
          {canEdit ? (
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={(e) => saveDescription(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              placeholder="Kurze Beschreibung hinzufügen …"
              aria-label="Beschreibung"
              className="-ml-1.5 mt-1 w-full rounded-lg bg-transparent px-1.5 py-0.5 text-muted outline-none transition placeholder:text-faint hover:bg-surface focus:bg-surface"
            />
          ) : (
            description && <p className="mt-1 text-muted">{description}</p>
          )}
        </div>
        {canEdit && (
          <div className="flex shrink-0 items-center gap-1.5 pt-1">
            <form action={createEntry.bind(null, topic.id, topic.slug)}>
              <Button variant="primary" type="submit" disabled={pending}>
                <Plus size={16} /> Eintrag
              </Button>
            </form>
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
        )}
      </div>
      {dialog && <TopicDialog open initial={topic} onClose={() => setDialog(false)} />}
    </header>
  );
}
