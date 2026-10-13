"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Plus, Trash2, X } from "lucide-react";
import { deletePerson, savePerson, type PersonInput } from "@/app/actions";
import { TopicIcon } from "@/components/topic-icon";
import { Avatar, Button, Dialog, Input, Label, Textarea } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { Person, TopicOption } from "./types";

const LABELS = ["Hauptansprechpartner", "Hauptansprechpartnerin", "Vertretung", "Experte", "Expertin", "Ansprechpartner"];

export function PersonDialog({
  person,
  topics,
  onClose,
}: {
  person: Person | null;
  topics: TopicOption[];
  onClose: () => void;
}) {
  const [form, setForm] = useState<PersonInput>({
    name: person?.name ?? "",
    position: person?.position ?? "",
    department: person?.department ?? "",
    email: person?.email ?? "",
    phone: person?.phone ?? "",
    teams_url: person?.teams_url ?? "",
    bio: person?.bio ?? "",
    tags: person?.tags ?? [],
    avatar_url: person?.avatar_url ?? null,
    topics: (person?.topic_contacts ?? [])
      .filter((c) => c.topic)
      .map((c) => ({ topic_id: c.topic!.id, label: c.label })),
  });
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof PersonInput>(key: K, value: PersonInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  function addTag(raw: string) {
    const tags = raw.split(",").map((t) => t.trim()).filter(Boolean);
    if (tags.length) set("tags", [...new Set([...form.tags, ...tags])]);
    setTagInput("");
  }

  async function uploadAvatar(file: File) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return setError("Bitte PNG, JPG oder WebP wählen");
    setUploading(true);
    const ext = file.type.split("/")[1]!.replace("jpeg", "jpg");
    const path = `people/${crypto.randomUUID()}.${ext}`;
    const { error } = await createClient().storage.from("media").upload(path, file, { contentType: file.type });
    setUploading(false);
    if (error) return setError(error.message);
    set("avatar_url", `/media/${path}`);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const finalForm = tagInput.trim() ? { ...form, tags: [...form.tags, ...tagInput.split(",")] } : form;
    startTransition(async () => {
      try {
        await savePerson(person?.id ?? null, finalForm);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
      }
    });
  }

  const unassigned = topics.filter((t) => !form.topics.some((a) => a.topic_id === t.id));

  return (
    <Dialog open wide title={person ? "Person bearbeiten" : "Person hinzufügen"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative rounded-full"
            aria-label="Foto hochladen"
          >
            <Avatar name={form.name || "?"} url={form.avatar_url} size={64} />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition group-hover:opacity-100">
              <Camera size={18} />
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void uploadAvatar(f);
            }}
          />
          <div className="flex-1">
            <Label htmlFor="p-name">Name</Label>
            <Input id="p-name" required autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
        </div>
        {uploading && <p className="text-xs text-muted">Foto wird hochgeladen …</p>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="p-pos">Position</Label>
            <Input id="p-pos" value={form.position} onChange={(e) => set("position", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="p-dep">Abteilung</Label>
            <Input id="p-dep" value={form.department} onChange={(e) => set("department", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="p-mail">E-Mail</Label>
            <Input id="p-mail" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="p-tel">Telefon</Label>
            <Input id="p-tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label htmlFor="p-teams">Teams-/Chat-Link</Label>
            <Input id="p-teams" type="url" placeholder="https://teams.microsoft.com/l/chat/…" value={form.teams_url} onChange={(e) => set("teams_url", e.target.value)} />
          </div>
        </div>

        <div>
          <Label htmlFor="p-tags">Fachgebiete / Stichworte</Label>
          <div className="flex flex-wrap items-center gap-1.5 rounded-[10px] border border-border bg-surface p-1.5 focus-within:border-accent">
            {form.tags.map((t) => (
              <span key={t} className="flex items-center gap-1 rounded-md bg-surface-3 px-2 py-0.5 text-[12.5px] text-text-2">
                {t}
                <button type="button" onClick={() => set("tags", form.tags.filter((x) => x !== t))} aria-label={`${t} entfernen`}>
                  <X size={12} className="text-faint hover:text-text" />
                </button>
              </span>
            ))}
            <input
              id="p-tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag(tagInput);
                } else if (e.key === "Backspace" && !tagInput && form.tags.length) {
                  set("tags", form.tags.slice(0, -1));
                }
              }}
              onBlur={() => addTag(tagInput)}
              placeholder={form.tags.length ? "" : "z. B. Xetra, Ordertypen (Enter)"}
              className="h-7 min-w-32 flex-1 bg-transparent px-1.5 text-sm text-text outline-none placeholder:text-faint"
            />
          </div>
        </div>

        <div>
          <Label>Ansprechpartner für Themen</Label>
          <div className="space-y-1.5">
            {form.topics.map((a, i) => {
              const t = topics.find((x) => x.id === a.topic_id);
              if (!t) return null;
              return (
                <div key={a.topic_id} className="flex items-center gap-2 rounded-[10px] border border-border bg-surface px-3 py-1.5">
                  <TopicIcon name={t.icon} color={t.color} size={14} />
                  <span className="min-w-0 flex-1 truncate text-sm">{t.name}</span>
                  <select
                    value={a.label}
                    onChange={(e) =>
                      set("topics", form.topics.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                    }
                    className="rounded-md border border-border bg-surface-2 px-2 py-1 text-[12.5px] text-text-2"
                    aria-label="Rolle"
                  >
                    {[...new Set([a.label, ...LABELS])].map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => set("topics", form.topics.filter((_, j) => j !== i))}
                    className="rounded p-1 text-faint hover:text-danger"
                    aria-label="Zuordnung entfernen"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
            {unassigned.length > 0 && (
              <div className="flex items-center gap-2">
                <Plus size={14} className="text-faint" />
                <select
                  value=""
                  onChange={(e) =>
                    e.target.value && set("topics", [...form.topics, { topic_id: e.target.value, label: "Ansprechpartner" }])
                  }
                  className="h-9 flex-1 rounded-[10px] border border-dashed border-border bg-transparent px-2 text-sm text-muted"
                  aria-label="Thema zuordnen"
                >
                  <option value="">Thema zuordnen …</option>
                  {unassigned.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="p-bio">Notiz</Label>
          <Textarea id="p-bio" rows={3} value={form.bio} onChange={(e) => set("bio", e.target.value)} placeholder="Wofür ist die Person die richtige Anlaufstelle?" />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex items-center gap-2 pt-1">
          {person && (
            <Button
              type="button"
              variant="danger"
              disabled={pending}
              onClick={() => {
                if (!confirm(`${person.name} wirklich entfernen?`)) return;
                startTransition(async () => {
                  await deletePerson(person.id);
                  onClose();
                });
              }}
            >
              <Trash2 size={14} /> Entfernen
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="submit" variant="primary" disabled={pending || uploading || !form.name.trim()}>
              Speichern
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
