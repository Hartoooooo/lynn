"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Inbox, Loader2, Trash2 } from "lucide-react";
import { assignUncategorized, deleteUncategorized } from "@/app/actions";
import { useToast } from "@/components/toast";
import { Button, EmptyState } from "@/components/ui";

export type UncategorizedRow = {
  id: string;
  input: string;
  isin: string;
  name: string;
  kuerzel: string;
  hebel: number | null;
  underlying_name: string;
  quelle: string;
};

export function UncategorizedView({
  rows: initial,
  categories,
  canEdit,
  datasetLabel,
}: {
  rows: UncategorizedRow[];
  categories: string[];
  canEdit: boolean;
  datasetLabel: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [draft, setDraft] = useState<Record<string, { category: string; subcategory: string }>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startAction] = useTransition();

  function setField(id: string, patch: Partial<{ category: string; subcategory: string }>) {
    setDraft((d) => {
      const cur = d[id] ?? { category: "", subcategory: "" };
      return { ...d, [id]: { ...cur, ...patch } };
    });
  }

  function assign(row: UncategorizedRow) {
    const d = draft[row.id];
    if (!d?.category) {
      toast("Bitte eine Oberkategorie wählen.", "error");
      return;
    }
    setPendingId(row.id);
    startAction(async () => {
      const res = await assignUncategorized(row.id, d.category, d.subcategory ?? "");
      setPendingId(null);
      if (!res.ok) {
        toast(res.message ?? "Einsortieren fehlgeschlagen.", "error");
        return;
      }
      setRows((rs) => rs.filter((r) => r.id !== row.id));
      toast(`„${row.name || row.isin}" nach ${d.category}${d.subcategory ? ` / ${d.subcategory}` : ""} einsortiert.`);
      router.refresh();
    });
  }

  function discard(row: UncategorizedRow) {
    setPendingId(row.id);
    startAction(async () => {
      const res = await deleteUncategorized(row.id);
      setPendingId(null);
      if (!res.ok) {
        toast(res.message ?? "Verwerfen fehlgeschlagen.", "error");
        return;
      }
      setRows((rs) => rs.filter((r) => r.id !== row.id));
      router.refresh();
    });
  }

  if (!rows.length) {
    return (
      <EmptyState icon={<Inbox size={28} />} title={`${datasetLabel}: nichts zum Einsortieren`}>
        Werte, die beim Kategorisieren nicht automatisch zugeordnet werden konnten, landen hier zum manuellen Einsortieren.
      </EmptyState>
    );
  }

  return (
    <div>
      <p className="mb-4 text-[13px] text-muted">
        {rows.length.toLocaleString("de-DE")} nicht zugeordnete Werte in {datasetLabel} – Oberkategorie (und optional
        Unterkategorie) wählen und einsortieren.
      </p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr className="bg-surface text-left text-text-2">
              <th className="px-3 py-2 font-semibold">Eingabe</th>
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 text-right font-semibold">Hebel</th>
              <th className="px-3 py-2 font-semibold">Quelle</th>
              {canEdit && <th className="px-3 py-2 font-semibold">Oberkategorie</th>}
              {canEdit && <th className="px-3 py-2 font-semibold">Unterkategorie</th>}
              {canEdit && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const busy = pendingId === r.id;
              const d = draft[r.id] ?? { category: "", subcategory: "" };
              return (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-[12.5px] text-muted">{r.input || r.isin}</td>
                  <td className="min-w-[200px] px-3 py-2 text-text">{r.name || <span className="text-faint">—</span>}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-text-2">
                    {r.hebel === null ? "" : `${r.hebel > 0 ? "+" : ""}${r.hebel}`}
                  </td>
                  <td className="px-3 py-2 text-[12px] text-faint">{r.quelle}</td>
                  {canEdit && (
                    <td className="px-3 py-2">
                      <select
                        value={d.category}
                        onChange={(e) => setField(r.id, { category: e.target.value })}
                        className="h-8 max-w-[180px] rounded-lg border border-border bg-bg px-2 text-[12.5px] text-text focus:border-accent focus:outline-none"
                      >
                        <option value="">— wählen —</option>
                        {categories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                  {canEdit && (
                    <td className="px-3 py-2">
                      <input
                        value={d.subcategory}
                        onChange={(e) => setField(r.id, { subcategory: e.target.value })}
                        placeholder="optional"
                        className="h-8 w-36 rounded-lg border border-border bg-bg px-2 text-[12.5px] text-text placeholder:text-faint focus:border-accent focus:outline-none"
                      />
                    </td>
                  )}
                  {canEdit && (
                    <td className="whitespace-nowrap px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Button variant="primary" size="sm" onClick={() => assign(r)} disabled={busy || !d.category}>
                          {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Einsortieren
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => discard(r)} disabled={busy} aria-label="Verwerfen">
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
