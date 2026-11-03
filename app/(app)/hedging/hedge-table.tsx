"use client";

import { useMemo, useState } from "react";
import { Search, ShieldCheck } from "lucide-react";
import type { HedgeRow } from "@/lib/hedge-data";
import { cn } from "@/lib/utils";

const QUALITY_ORDER = ["gut", "mittel", "unsicher (kurze Historie)", "schwach", "keine Daten"] as const;

const QUALITY_STYLE: Record<string, string> = {
  gut: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25",
  mittel: "bg-amber-500/15 text-amber-300 ring-amber-500/25",
  "unsicher (kurze Historie)": "bg-sky-500/15 text-sky-300 ring-sky-500/25",
  schwach: "bg-rose-500/15 text-rose-300 ring-rose-500/25",
  "keine Daten": "bg-surface-3 text-faint ring-border",
};

function QualityBadge({ value }: { value: string | null }) {
  const key = value ?? "keine Daten";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium ring-1 ring-inset whitespace-nowrap",
        QUALITY_STYLE[key] ?? QUALITY_STYLE["keine Daten"],
      )}
    >
      {key}
    </span>
  );
}

function formatFaktor(v: number | string | null) {
  if (v === null || v === undefined || v === "") return "–";
  if (typeof v === "number") return v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : v;
}

export function HedgeTable({ rows }: { rows: HedgeRow[] }) {
  const [query, setQuery] = useState("");
  const [quality, setQuality] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) {
      const k = r.qualitaet ?? "keine Daten";
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (quality && (r.qualitaet ?? "keine Daten") !== quality) return false;
      if (!q) return true;
      return [r.isin, r.kuerzel, r.name, r.hedgeTicker, r.hedgeIsin, r.waehrung, r.qualitaet]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, query, quality]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suche nach ISIN, Kürzel, Name, Hedge-Ticker …"
            aria-label="Produkte durchsuchen"
            className="h-10 w-full rounded-[10px] border border-border bg-surface pl-9 pr-3 text-[14px] text-text outline-none placeholder:text-faint focus:border-border-strong"
          />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <FilterChip label="Alle" count={rows.length} active={quality === null} onClick={() => setQuality(null)} />
        {QUALITY_ORDER.filter((q) => counts[q]).map((q) => (
          <FilterChip
            key={q}
            label={q}
            count={counts[q]}
            active={quality === q}
            onClick={() => setQuality(quality === q ? null : q)}
          />
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-[12px] uppercase tracking-[0.04em] text-muted">
              <th className="px-3 py-2.5 font-semibold">Unser Produkt</th>
              <th className="px-3 py-2.5 font-semibold">ISIN</th>
              <th className="px-3 py-2.5 font-semibold">Kürzel</th>
              <th className="px-3 py-2.5 font-semibold">Hedge-Ticker</th>
              <th className="px-3 py-2.5 font-semibold">Hedge-ISIN</th>
              <th className="px-3 py-2.5 text-right font-semibold">Hedge-Faktor</th>
              <th className="px-3 py-2.5 font-semibold">Währung</th>
              <th className="px-3 py-2.5 font-semibold">Hedge-Qualität</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr
                key={`${r.isin}-${i}`}
                className="border-b border-border/60 last:border-0 hover:bg-surface-2/60"
              >
                <td className="max-w-[220px] px-3 py-2.5 text-text-2">
                  <span className="block truncate" title={r.name ?? undefined}>
                    {r.name ?? "–"}
                  </span>
                </td>
                <td className="px-3 py-2.5 font-mono text-[12.5px] text-text">{r.isin}</td>
                <td className="px-3 py-2.5 font-medium text-text">{r.kuerzel ?? "–"}</td>
                <td className="px-3 py-2.5 font-mono text-[12.5px] text-text">{r.hedgeTicker ?? "–"}</td>
                <td className="px-3 py-2.5 font-mono text-[12.5px] text-text-2">{r.hedgeIsin ?? "–"}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[12.5px] text-text-2 tabular-nums">
                  {formatFaktor(r.faktor)}
                </td>
                <td className="px-3 py-2.5 text-text-2">{r.waehrung ?? "–"}</td>
                <td className="px-3 py-2.5">
                  <QualityBadge value={r.qualitaet} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-14 text-center text-muted">
            <ShieldCheck size={26} className="text-faint" />
            <p className="text-[14px]">Keine Produkte für diese Suche gefunden.</p>
          </div>
        )}
      </div>

      <p className="mt-3 text-[12.5px] text-faint">
        {filtered.length.toLocaleString("de-DE")} von {rows.length.toLocaleString("de-DE")} Produkten
      </p>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] transition-colors",
        active
          ? "border-border-strong bg-surface-3 text-text"
          : "border-border bg-surface text-text-2 hover:bg-surface-2 hover:text-text",
      )}
    >
      <span>{label}</span>
      <span className={cn("tabular-nums", active ? "text-muted" : "text-faint")}>{count}</span>
    </button>
  );
}
