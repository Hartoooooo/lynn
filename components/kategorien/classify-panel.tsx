"use client";

import { useRef, useState, useTransition } from "react";
import { CheckCircle2, Database, Loader2, Play, Sparkles, Square, XCircle } from "lucide-react";
import { saveClassifications, saveUncategorized, type ClassificationInput, type UncategorizedInput } from "@/app/actions";
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
type Phase = "idle" | "running" | "paused" | "done";

const BATCH = 20; // Tokens pro API-Aufruf
const PAUSE_AT = 500; // Stopp (zum Prüfen/Speichern) nach so vielen Ergebnissen

export function ClassifyPanel({
  categories,
  canEdit,
  dataset,
  datasetLabel,
}: {
  categories: string[];
  canEdit: boolean;
  dataset: string;
  datasetLabel: string;
}) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);
  const [savedTotal, setSavedTotal] = useState(0);
  const [saving, startSave] = useTransition();

  const queueRef = useRef<string[]>([]);
  const cursorRef = useRef(0);
  const rowsRef = useRef<Row[]>([]);
  const stopRef = useRef(false);

  async function classifyBatch(slice: string[]): Promise<Row[]> {
    const res = await fetch("/api/kategorien/klassifizieren", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: slice }),
    });
    const data = (await res.json()) as { results?: ApiResult[]; error?: string };
    if (!res.ok) throw new Error(data.error || "Klassifizierung fehlgeschlagen.");
    return (data.results ?? []).map((r) => ({
      ...r,
      include: Boolean(r.ueber) && !r.exists,
      category: r.ueber ?? "",
      subcategory: r.unter,
    }));
  }

  async function drive() {
    setPhase("running");
    try {
      while (!stopRef.current && cursorRef.current < queueRef.current.length && rowsRef.current.length < PAUSE_AT) {
        const slice = queueRef.current.slice(cursorRef.current, cursorRef.current + BATCH);
        const got = await classifyBatch(slice);
        rowsRef.current = [...rowsRef.current, ...got];
        cursorRef.current += slice.length;
        setRows(rowsRef.current);
        setProcessed(cursorRef.current);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Klassifizierung fehlgeschlagen.", "error");
      setPhase("paused");
      return;
    }
    if (stopRef.current) {
      setPhase("paused");
      return;
    }
    setPhase(cursorRef.current >= queueRef.current.length && rowsRef.current.length === 0 ? "done" : "paused");
  }

  function start() {
    const tokens = [
      ...new Set(
        text
          .split(/[\s,;]+/)
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean),
      ),
    ];
    if (!tokens.length) {
      toast("Bitte mindestens eine ISIN oder ein Kürzel eingeben.", "error");
      return;
    }
    queueRef.current = tokens;
    cursorRef.current = 0;
    rowsRef.current = [];
    stopRef.current = false;
    setRows([]);
    setProcessed(0);
    setTotal(tokens.length);
    setSavedTotal(0);
    drive();
  }

  function stop() {
    stopRef.current = true;
  }

  function saveAndContinue() {
    const items: ClassificationInput[] = rowsRef.current
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
    // Nicht zuordenbare Werte (keine Kategorie, nicht bereits erfasst) werden zum späteren Einsortieren geparkt.
    const parked: UncategorizedInput[] = rowsRef.current
      .filter((r) => !r.category && !r.exists)
      .map((r) => ({
        input: r.input,
        isin: r.isin,
        wkn: "",
        name: r.name,
        kuerzel: "",
        hebel: r.hebel,
        underlyingName: r.underlying,
        underlyingIsin: "",
        quelle: r.quelle,
      }));
    if (!items.length && !parked.length) {
      toast("Keine Einträge zum Speichern.", "error");
      return;
    }
    startSave(async () => {
      const msg: string[] = [];
      if (items.length) {
        const res = await saveClassifications(items, dataset);
        if (!res.ok) {
          toast(res.message ?? "Speichern fehlgeschlagen.", "error");
          return;
        }
        setSavedTotal((n) => n + res.inserted);
        msg.push(`${res.inserted} gespeichert`);
        if (res.skipped) msg.push(`${res.skipped} übersprungen`);
      }
      if (parked.length) {
        const res2 = await saveUncategorized(parked, dataset);
        if (!res2.ok) {
          toast(res2.message ?? "Parken fehlgeschlagen.", "error");
          return;
        }
        if (res2.inserted) msg.push(`${res2.inserted} geparkt`);
      }
      toast(`${msg.join(", ")} (${datasetLabel}).`);
      rowsRef.current = [];
      setRows([]);
      if (cursorRef.current < queueRef.current.length) {
        stopRef.current = false;
        drive();
      } else {
        setPhase("done");
      }
    });
  }

  function reset() {
    stopRef.current = true;
    queueRef.current = [];
    cursorRef.current = 0;
    rowsRef.current = [];
    setRows([]);
    setProcessed(0);
    setTotal(0);
    setPhase("idle");
  }

  const selectedCount = rows.filter((r) => r.include && r.category).length;
  const parkCount = rows.filter((r) => !r.category && !r.exists).length;
  const pct = total ? Math.round((processed / total) * 100) : 0;
  const busy = phase === "running";
  const inFlight = phase === "running" || phase === "paused" || saving;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <label htmlFor="isins" className="block text-[13px] font-medium text-muted">
            ISINs oder Kürzel (durch Leerzeichen, Komma oder Zeilenumbruch getrennt)
          </label>
          <span className="shrink-0 rounded-md bg-surface-3 px-2 py-0.5 text-[11.5px] font-medium text-muted">
            Ziel: {datasetLabel}
          </span>
        </div>
        <textarea
          id="isins"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          disabled={inFlight}
          placeholder={"IE00B4L5Y983\nXS2472196687\nUS37954Y8710\n… beliebig viele – Stopp alle 500 zum Prüfen & Speichern"}
          className="w-full resize-y rounded-[10px] border border-border bg-bg px-3 py-2 font-mono text-[13px] text-text placeholder:text-faint focus:border-accent focus:outline-none disabled:opacity-60"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[12.5px] text-faint">
            Läuft fortlaufend nach den Regeln von <span className="font-mono">klassifizierer.py</span> und pausiert alle{" "}
            {PAUSE_AT} Ergebnisse.
          </p>
          {phase === "idle" || phase === "done" ? (
            <Button variant="primary" onClick={start}>
              <Play size={16} /> Start
            </Button>
          ) : busy ? (
            <Button variant="secondary" onClick={stop}>
              <Square size={14} /> Stopp
            </Button>
          ) : (
            <Button variant="ghost" onClick={reset}>
              Zurücksetzen
            </Button>
          )}
        </div>

        {/* Fortschrittsbalken */}
        {(phase === "running" || phase === "paused") && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[12px] text-muted">
              <span className="flex items-center gap-2">
                {busy && <Loader2 size={13} className="animate-spin text-accent" />}
                {processed.toLocaleString("de-DE")} / {total.toLocaleString("de-DE")} klassifiziert
                {savedTotal > 0 && <span className="text-faint">· {savedTotal.toLocaleString("de-DE")} gespeichert</span>}
              </span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      {phase === "done" && rows.length === 0 && (
        <div className="rounded-2xl border border-border bg-surface px-5 py-4 text-[13.5px] text-text-2">
          Fertig – {savedTotal.toLocaleString("de-DE")} Einträge in {datasetLabel} gespeichert.
        </div>
      )}

      {rows.length > 0 && (
        <div className="rounded-2xl border border-border">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="mr-auto">
              <h2 className="text-[15px] font-semibold">
                {phase === "paused" ? `Pausiert – ${rows.length} Ergebnisse prüfen` : `Ergebnisse (${rows.length})`}
              </h2>
              <p className="text-[12px] text-faint">
                {selectedCount} zuordenbar{parkCount > 0 && ` · ${parkCount} werden geparkt`}
              </p>
            </div>
            {canEdit ? (
              <Button
                variant="primary"
                size="sm"
                onClick={saveAndContinue}
                disabled={saving || busy || (selectedCount === 0 && parkCount === 0)}
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Database size={15} />}
                {cursorRef.current < queueRef.current.length ? "Speichern & weiter" : "Speichern"}
              </Button>
            ) : (
              <span className="text-[12.5px] text-faint">Nur Redakteure können speichern.</span>
            )}
          </div>
          <div className="max-h-[60dvh] overflow-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead className="sticky top-0 bg-surface">
                <tr className="text-left text-text-2">
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
                            setRows((rs) => rs.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))
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
                              rs.map((x, j) =>
                                j === i ? { ...x, category: e.target.value, include: Boolean(e.target.value) && !x.exists } : x,
                              ),
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
                            setRows((rs) => rs.map((x, j) => (j === i ? { ...x, subcategory: e.target.value } : x)))
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
                        {r.exists ? <CheckCircle2 size={13} /> : r.ueber ? <Sparkles size={13} /> : <XCircle size={13} />}
                        {r.quelle}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
