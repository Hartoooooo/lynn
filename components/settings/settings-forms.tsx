"use client";

import { useState, useTransition } from "react";
import { ArchiveRestore, Check } from "lucide-react";
import { setTopicArchived, setUserRole, updateOwnName } from "@/app/actions";
import { Avatar, Button, Input } from "@/components/ui";
import type { UserRole } from "@/lib/database.types";
import { ROLE_LABEL } from "@/lib/utils";

export function NameForm({ initial }: { initial: string }) {
  const [name, setName] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          await updateOwnName(name);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        });
      }}
    >
      <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Anzeigename" required />
      <Button type="submit" disabled={pending || !name.trim() || name === initial}>
        {saved ? <Check size={15} /> : null} Speichern
      </Button>
    </form>
  );
}

export function UserRoles({
  users,
  currentUserId,
}: {
  users: { id: string; full_name: string; email: string | null; role: UserRole }[];
  currentUserId: string;
}) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {users.map((u) => (
          <li key={u.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar name={u.full_name || u.email || "?"} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-text">{u.full_name || "—"}</div>
              <div className="truncate text-[12px] text-faint">{u.email}</div>
            </div>
            <select
              defaultValue={u.role}
              disabled={u.id === currentUserId}
              onChange={(e) => {
                const role = e.target.value as UserRole;
                setError(null);
                startTransition(async () => {
                  try {
                    await setUserRole(u.id, role);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Fehler");
                  }
                });
              }}
              className="rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-[13px] text-text-2 disabled:opacity-60"
              aria-label={`Rolle von ${u.full_name}`}
            >
              {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

export function ArchivedTopics({ topics }: { topics: { id: string; name: string }[] }) {
  const [pending, startTransition] = useTransition();
  if (!topics.length) return <p className="text-sm text-muted">Keine archivierten Themen.</p>;
  return (
    <ul className="space-y-1.5">
      {topics.map((t) => (
        <li key={t.id} className="flex items-center justify-between rounded-xl border border-border px-4 py-2.5">
          <span className="text-sm text-text-2">{t.name}</span>
          <Button size="sm" disabled={pending} onClick={() => startTransition(() => setTopicArchived(t.id, false))}>
            <ArchiveRestore size={14} /> Wiederherstellen
          </Button>
        </li>
      ))}
    </ul>
  );
}
