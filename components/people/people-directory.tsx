"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, MessageSquare, Pencil, Phone, Search, UserPlus, Users } from "lucide-react";
import { TopicIcon } from "@/components/topic-icon";
import { Avatar, Button, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";
import { PersonDialog } from "./person-dialog";
import type { Person, TopicOption } from "./types";

function normalize(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

export function PeopleDirectory({
  people,
  topics,
  canEdit,
}: {
  people: Person[];
  topics: TopicOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("p");
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<Person | "new" | null>(null);

  useEffect(() => {
    if (!selectedId) return;
    document.getElementById(`person-${selectedId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedId]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return people.filter((p) => {
      if (topicFilter && !p.topic_contacts.some((c) => c.topic?.id === topicFilter)) return false;
      if (!q) return true;
      const hay = normalize(
        [p.name, p.position, p.department, p.bio, ...p.tags, ...p.topic_contacts.map((c) => c.topic?.name ?? "")].join(" "),
      );
      return q.split(/\s+/).every((w) => hay.includes(w));
    });
  }, [people, query, topicFilter]);

  const usedTopics = topics.filter((t) => people.some((p) => p.topic_contacts.some((c) => c.topic?.id === t.id)));

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[30px] font-medium tracking-tight">Personal</h1>
          <p className="mt-1 text-muted">Finde die richtige Ansprechperson für dein Thema.</p>
        </div>
        {canEdit && (
          <Button variant="primary" onClick={() => setEditing("new")}>
            <UserPlus size={16} /> Person
          </Button>
        )}
      </div>

      <div className="mt-8 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 focus-within:border-border-strong">
        <Search size={16} className="text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Wer kennt sich aus mit … (Name, Thema, Fachgebiet)"
          className="h-11 flex-1 bg-transparent text-[15px] text-text outline-none placeholder:text-faint"
          aria-label="Personal durchsuchen"
        />
      </div>

      {usedTopics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip active={!topicFilter} onClick={() => setTopicFilter(null)}>
            Alle
          </Chip>
          {usedTopics.map((t) => (
            <Chip key={t.id} active={topicFilter === t.id} onClick={() => setTopicFilter(topicFilter === t.id ? null : t.id)}>
              <TopicIcon name={t.icon} color={t.color} size={12} />
              {t.name}
            </Chip>
          ))}
        </div>
      )}

      <div className="mt-6">
        {filtered.length === 0 ? (
          <EmptyState icon={<Users size={28} />} title={people.length ? "Niemand gefunden" : "Noch kein Personal erfasst"}>
            {people.length ? "Versuch es mit einem anderen Begriff." : canEdit ? "Lege über „+ Person“ die erste Ansprechperson an." : null}
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-3 [@media(min-width:1100px)]:grid-cols-2">
            {filtered.map((p) => (
              <PersonCard
                key={p.id}
                person={p}
                selected={p.id === selectedId}
                canEdit={canEdit}
                onEdit={() => setEditing(p)}
                onSelectTag={(tag) => setQuery(tag)}
              />
            ))}
          </div>
        )}
      </div>

      {editing && (
        <PersonDialog
          person={editing === "new" ? null : editing}
          topics={topics}
          onClose={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12.5px] transition-colors",
        active ? "border-accent/50 bg-accent-soft text-text" : "border-border text-muted hover:border-border-strong hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

function PersonCard({
  person: p,
  selected,
  canEdit,
  onEdit,
  onSelectTag,
}: {
  person: Person;
  selected: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onSelectTag: (tag: string) => void;
}) {
  return (
    <div
      id={`person-${p.id}`}
      className={cn(
        "group relative rounded-2xl border bg-surface p-4 transition-colors",
        selected ? "border-accent/60 ring-1 ring-accent/30" : "border-border hover:border-border-strong",
      )}
    >
      {canEdit && (
        <button
          onClick={onEdit}
          className="absolute right-3 top-3 rounded-md p-1.5 text-faint opacity-0 transition hover:bg-surface-3 hover:text-text group-hover:opacity-100"
          aria-label={`${p.name} bearbeiten`}
        >
          <Pencil size={14} />
        </button>
      )}
      <div className="flex items-center gap-3">
        <Avatar name={p.name} url={p.avatar_url} size={44} />
        <div className="min-w-0">
          <div className="truncate font-medium text-text">{p.name}</div>
          <div className="truncate text-[13px] text-muted">{[p.position, p.department].filter(Boolean).join(" · ")}</div>
        </div>
      </div>

      {p.bio && <p className="mt-3 text-[13.5px] text-text-2">{p.bio}</p>}

      {p.topic_contacts.some((c) => c.topic) && (
        <div className="mt-3 space-y-1">
          {p.topic_contacts
            .filter((c) => c.topic)
            .map((c) => (
              <Link
                key={c.topic!.id}
                href={`/t/${c.topic!.slug}`}
                className="flex items-center gap-2 text-[13px] text-text-2 hover:text-text"
              >
                <TopicIcon name={c.topic!.icon} color={c.topic!.color} size={13} />
                <span className="truncate">{c.topic!.name}</span>
                <span className="shrink-0 text-faint">· {c.label}</span>
              </Link>
            ))}
        </div>
      )}

      {p.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {p.tags.map((t) => (
            <button
              key={t}
              onClick={() => onSelectTag(t)}
              className="rounded-md bg-surface-3 px-2 py-0.5 text-[12px] text-muted hover:text-text"
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {p.email && (
          <a href={`mailto:${p.email}`} className="contact-btn" title={p.email}>
            <Mail size={13} /> {p.email}
          </a>
        )}
        {p.phone && (
          <a href={`tel:${p.phone.replace(/\s/g, "")}`} className="contact-btn">
            <Phone size={13} /> {p.phone}
          </a>
        )}
        {p.teams_url && (
          <a href={p.teams_url} target="_blank" rel="noreferrer" className="contact-btn">
            <MessageSquare size={13} /> Teams
          </a>
        )}
      </div>
    </div>
  );
}
