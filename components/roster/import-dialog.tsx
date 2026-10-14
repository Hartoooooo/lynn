"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { applyRosterImport, parseRosterFile } from "@/app/actions";
import { Button, Dialog } from "@/components/ui";
import { useToast } from "@/components/toast";
import type { ImportedWeek } from "@/lib/roster-import";

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [parsed, setParsed] = useState<{ weeks: ImportedWeek[]; names: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onFile(file: File) {
    setError(null);
    setParsed(null);
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const res = await parseRosterFile(fd);
      if (!res.ok) setError(res.message);
      else setParsed({ weeks: res.weeks, names: res.names });
    });
  }

  function apply() {
    if (!parsed) return;
    startTransition(async () => {
      const res = await applyRosterImport(parsed.weeks, parsed.names);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      toast(`${parsed.weeks.length} Wochen importiert`);
      router.refresh();
      onClose();
    });
  }

  return (
    <Dialog open sheet title="Dienstplan importieren" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <p className="text-muted">
          Excel im gleichen Format wie bisher: je Woche eine Kopfzeile (z. B. „19.10-23.10“, fünf Datumswerte, Hinweis), darunter eine Zeile pro
          Person. Vorhandene Wochen mit gleichem Startdatum werden ersetzt, der Tauschverlauf bleibt erhalten.
        </p>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-6 text-text-2 hover:border-accent/60">
          <FileSpreadsheet size={18} className="text-[#5fbf86]" />
          Excel-Datei auswählen
          <input
            type="file"
            accept=".xlsx"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) onFile(f);
            }}
          />
        </label>
        {pending && !parsed && (
          <p className="flex items-center gap-2 text-muted">
            <Loader2 size={14} className="animate-spin" /> Lese Datei …
          </p>
        )}
        {error && <p className="text-danger">{error}</p>}
        {parsed && (
          <div className="rounded-xl border border-border bg-surface px-4 py-3">
            <div className="font-medium text-text">
              {parsed.weeks.length} Wochen · {parsed.names.length} Personen
            </div>
            <div className="mt-1 text-muted">
              {parsed.weeks[0]?.range} bis {parsed.weeks.at(-1)?.range}
            </div>
            <div className="mt-1 text-[12.5px] text-faint">{parsed.names.join(", ")}</div>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" disabled={!parsed || pending} onClick={apply}>
            Übernehmen
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
