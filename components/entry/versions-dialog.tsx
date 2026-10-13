"use client";

import { useTransition } from "react";
import { History, RotateCcw } from "lucide-react";
import { restoreVersion } from "@/app/actions";
import { Button, Dialog, EmptyState } from "@/components/ui";

export type Version = { id: string; title: string; created_at: string; editor: { full_name: string } | null };

export function VersionsDialog({
  entryId,
  path,
  versions,
  canEdit,
  onClose,
  onRestored,
}: {
  entryId: string;
  path: string;
  versions: Version[];
  canEdit: boolean;
  onClose: () => void;
  onRestored: () => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open title="Versionsverlauf" onClose={onClose}>
      {versions.length === 0 ? (
        <EmptyState icon={<History size={24} />} title="Noch keine früheren Versionen">
          Beim Bearbeiten wird höchstens alle 10 Minuten automatisch eine Version gesichert.
        </EmptyState>
      ) : (
        <ul className="space-y-1">
          {versions.map((v) => (
            <li key={v.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-text">{v.title || "Unbenannt"}</div>
                <div className="text-[12px] text-faint">
                  {new Date(v.created_at).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}
                  {v.editor?.full_name ? ` · ${v.editor.full_name}` : ""}
                </div>
              </div>
              {canEdit && (
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm("Diese Version wiederherstellen? Der aktuelle Stand wird als Version gesichert.")) return;
                    startTransition(async () => {
                      await restoreVersion(entryId, v.id, path);
                      onRestored();
                    });
                  }}
                >
                  <RotateCcw size={13} /> Wiederherstellen
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
