"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Database, Loader2, Sparkles, XCircle } from "lucide-react";
import { saveClassifications, type ClassificationInput } from "@/app/actions";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

type ApiResult = {
  input: string;
  isin: string;
  name: string;
  ueber: string | null;
  unter: string;
  hebel: number | null;
  underlying: string;
  quelle: string;
  exists: boolean;
};

type Row = ApiResult & { include: boolean; category: string; subcategory: string };

export function ClassifyPanel({ categories, canEdit }: { categories: string[]; canEdit: boolean }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [saving, startSave] = useTransition();

  async function classify() {
    const inputs = text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    if (!inputs.length) {
      toast("Bitte mindestens eine ISIN oder ein Kürzel eingeben.", "error");
      return;
    }
    setClassifying(true);
    setRows(null);
    try {
      const res = await fetch("/api/kategorien/klassifizieren", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs }),
      });
      const data = (await res.json()) as { results?: ApiResult[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Klassifizierung fehlgeschlagen.");
      const mapped: Row[] = (data.results ?? []).map((r) => ({
        ...r,
        include: Boolean(r.ueber) && !r.exists,
        category: r.ueber ?? "",
        subcategory: r.unter,
      }));
      setRows(mapped);
      if (!mapped.length) toast("Keine Ergebnisse.", "error");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Klassifizierung fehlgeschlagen.", "error");
    } finally {
      setClassifying(false);
    }
  }

  function save() {
    if (!rows) return;
    const items: ClassificationInput[] = rows
      .filter((r) => r.include && r.category)
      .map((r) => ({
        isin: r.isin,
        wkn: "",
        name: r.name,
        kuerzel: "",
        categoryName: r.category,
        subcategory: r.subcategory,
        hebel: r.hebel,
        underlyingName: r.underlying,
        underlyingIsin: "",
      }));
    if (!items.length) {
      toast("Keine Einträge zum Speichern ausgewählt.", "error");
      return;
    }
    startSave(async () => {
      const res = await saveClassifications(items);
      if (res.ok) {
        toast(
          `${res.inserted} gespeichert${res.skipped ? `, ${res.skipped} übersprungen (bereits vorhanden)` : ""}.`,
        );
        // Gespeicherte als vorhanden markieren.
        setRows((rs) =>
          rs
            ? rs.map((r) => (r.include && r.category ? { ...r, exists: true, include: false } : r))
            : rs,
        );
      } else {
        toast(res.message ?? "Speichern fehlgeschlagen.", "error");
      }
    });
  }

  const selectable = rows?.some((r) => r.ueber || r.exists);
  const selectedCount = rows?.filter((r) => r.include && r.category).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <label htmlFor="isins" className="mb-1.5 block text-[13px] font-medium text-muted">
          ISINs oder Kürzel (durch Leerzeichen, Komma oder Zeilenumbruch getrennt)
        </label>
        <textarea
          id="isins"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder={"IE00B4L5Y983\nXS2472196687\nUS37954Y8710"}
          className="w-full resize-y rounded-[10px] border border-border bg-bg px-3 py-2 font-mono text-[13px] text-text placeholder:text-faint focus:border-accent focus:outline-none"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[12.5px] text-faint">
            Klassifizierung nach denselben Regeln wie <span className="font-mono">klassifizierer.py</span> – bereits erfasste ISINs
            übernehmen ihre gespeicherte Kategorie.
          </p>
          <Button variant="primary" onClick={classify} disabled={classifying}>
            {classifying ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Klassifizieren
          </Button>
        </div>
      </div>

      {rows && rows.length > 0 && (
        <div className="rounded-2xl border border-border">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h2 className="text-[15px] font-semibold">Ergebnisse ({rows.length})</h2>
            {canEdit ? (
              <Button variant="primary" size="sm" onClick={save} disabled={saving || selectedCount === 0}>
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Database size={15} />}
                {selectedCount > 0 ? `${selectedCount} speichern` : "In Datenbank speichern"}
              </Button>
            ) : (
              <span className="text-[12.5px] text-faint">Nur Redakteure können speichern.</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-surface text-left text-text-2">
                  {canEdit && <th className="w-10 px-3 py-2" />}
                  <th className="px-3 py-2 font-semibold">Eingabe</th>
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">Oberkategorie</th>
                  <th className="px-3 py-2 font-semibold">Unterkategorie</th>
                  <th className="px-3 py-2 text-right font-semibold">Hebel</th>
                  <th className="px-3 py-2 font-semibold">Quelle</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.input}-${i}`} className="border-t border-border align-top">
                    {canEdit && (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={r.include}
                          disabled={r.exists || !r.category}
                          onChange={(e) =>
                            setRows((rs) => rs?.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)) ?? rs)
                          }
                          className="mt-0.5 size-4 accent-[var(--accent)]"
                          aria-label={`${r.input} speichern`}
                        />
                      </td>
                    )}
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-[12.5px] text-muted">{r.input}</td>
                    <td className="min-w-[200px] px-3 py-2 text-text">{r.name || <span className="text-faint">—</span>}</td>
                    <td className="px-3 py-2">
                      {canEdit ? (
                        <select
                          value={r.category}
                          onChange={(e) =>
                            setRows((rs) =>
                              rs?.map((x, j) =>
                                j === i ? { ...x, category: e.target.value, include: Boolean(e.target.value) && !x.exists } : x,
                              ) ?? rs,
                            )
                          }
                          disabled={r.exists}
                          className="h-8 max-w-[180px] rounded-lg border border-border bg-bg px-2 text-[12.5px] text-text focus:border-accent focus:outline-none disabled:opacity-60"
                        >
                          <option value="">— nicht zuordnen —</option>
                          {categories.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      ) : r.category ? (
                        r.category
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {canEdit ? (
                        <input
                          value={r.subcategory}
                          onChange={(e) =>
                            setRows((rs) => rs?.map((x, j) => (j === i ? { ...x, subcategory: e.target.value } : x)) ?? rs)
                          }
                          disabled={r.exists}
                          placeholder="—"
                          className="h-8 w-36 rounded-lg border border-border bg-bg px-2 text-[12.5px] text-text placeholder:text-faint focus:border-accent focus:outline-none disabled:opacity-60"
                        />
                      ) : (
                        r.subcategory || <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-text-2">
                      {r.hebel === null ? "" : `${r.hebel > 0 ? "+" : ""}${r.hebel}`}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-[12px]",
                          r.exists ? "text-success" : r.ueber ? "text-text-2" : "text-faint",
                        )}
                      >
                        {r.exists ? (
                          <CheckCircle2 size={13} />
                        ) : r.ueber ? (
                          <Sparkles size={13} />
                        ) : (
                          <XCircle size={13} />
                        )}
                        {r.quelle}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!selectable && (
            <p className="px-4 py-3 text-[12.5px] text-faint">
              Keine automatische Zuordnung möglich – Oberkategorie manuell wählen, um zu speichern.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
