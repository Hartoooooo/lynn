"use client";

import { useMemo, useState } from "react";
import { Search, ShieldCheck } from "lucide-react";
import type { HedgeRow } from "@/lib/hedge-data";
import { cn } from "@/lib/utils";

type SourceFilter = "all" | "etf" | "hebel";

const QUALITY_ORDER = ["gut", "mittel", "unsicher (kurze Historie)", "schwach", "keine Daten"] as const;

const QUALITY_STYLE: Record<string, string> = {
  gut: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25",
  mittel: "bg-amber-500/15 text-amber-300 ring-amber-500/25",
  "unsicher (kurze Historie)": "bg-sky-500/15 text-sky-300 ring-sky-500/25",
  schwach: "bg-rose-500/15 text-rose-300 ring-rose-500/25",
  "keine Daten": "bg-surface-3 text-faint ring-border",
};

function QualityBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-faint">–</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium ring-1 ring-inset whitespace-nowrap",
        QUALITY_STYLE[value] ?? QUALITY_STYLE["keine Daten"],
      )}
    >
      {value}
    </span>
  );
}

function LeverageBadge({ hebel }: { hebel: number | string | null }) {
  if (hebel === null || hebel === "") return null;
  const n = typeof hebel === "number" ? hebel : Number(hebel);
  if (!Number.isFinite(n)) return null;
  const isShort = n < 0;
  const label = `${n > 0 ? "" : "−"}${Math.abs(n)}×`;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums ring-1 ring-inset",
        isShort ? "bg-rose-500/15 text-rose-300 ring-rose-500/25" : "bg-sky-500/15 text-sky-300 ring-sky-500/25",
      )}
      title={isShort ? "Short / inverser Hebel" : "Hebel"}
    >
      {label}
    </span>
  );
}

function correlationColor(r: number) {
  const a = Math.abs(r);
  if (a >= 0.9) return "text-emerald-300";
  if (a >= 0.75) return "text-amber-300";
  return "text-rose-300";
}

function formatFaktor(v: number | string | null) {
  if (v === null || v === undefined || v === "") return "–";
  if (typeof v === "number") return v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : v;
}

export function HedgeTable({ rows }: { rows: HedgeRow[] }) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [quality, setQuality] = useState<string | null>(null);

  const sourceCounts = useMemo(() => {
    let etf = 0;
    let hebel = 0;
    for (const r of rows) {
      if (r.source === "hebel") hebel++;
      else etf++;
    }
    return { all: rows.length, etf, hebel };
  }, [rows]);

  const sourceRows = useMemo(
    () => (source === "all" ? rows : rows.filter((r) => r.source === source)),
    [rows, source],
  );

  const qualityCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of sourceRows) {
      if (!r.qualitaet) continue;
      c[r.qualitaet] = (c[r.qualitaet] ?? 0) + 1;
    }
    return c;
  }, [sourceRows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sourceRows.filter((r) => {
      if (quality && (r.qualitaet ?? "keine Daten") !== quality) return false;
      if (!q) return true;
      return [r.isin, r.kuerzel, r.name, r.underlying, r.underlyingIsin, r.hedgeTicker, r.hedgeIsin, r.waehrung, r.qualitaet]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [sourceRows, query, quality]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suche nach ISIN, Kürzel, Name, Underlying, Hedge-Ticker …"
            aria-label="Produkte durchsuchen"
            className="h-10 w-full rounded-[10px] border border-border bg-surface pl-9 pr-3 text-[14px] text-text outline-none placeholder:text-faint focus:border-border-strong"
          />
        </div>
      </div>

      {/* Produktgruppe */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        <FilterChip
          label="Alle Produkte"
          count={sourceCounts.all}
          active={source === "all"}
          onClick={() => {
            setSource("all");
            setQuality(null);
          }}
        />
        <FilterChip
          label="Index-ETFs"
          count={sourceCounts.etf}
          active={source === "etf"}
          onClick={() => {
            setSource("etf");
            setQuality(null);
          }}
        />
        <FilterChip
          label="Hebel & Krypto"
          count={sourceCounts.hebel}
          active={source === "hebel"}
          onClick={() => {
            setSource("hebel");
            setQuality(null);
          }}
        />
      </div>

      {/* Hedge-Qualität (nur sinnvoll, wenn Qualitätsdaten vorhanden) */}
      {Object.keys(qualityCounts).length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <FilterChip label="Alle Qualitäten" count={sourceRows.length} active={quality === null} onClick={() => setQuality(null)} />
          {QUALITY_ORDER.filter((q) => qualityCounts[q]).map((q) => (
            <FilterChip
              key={q}
              label={q}
              count={qualityCounts[q]}
              active={quality === q}
              onClick={() => setQuality(quality === q ? null : q)}
            />
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-left text-[12px] uppercase tracking-[0.04em] text-muted">
              <th className="px-3 py-2.5 font-semibold">Unser Produkt</th>
              <th className="px-3 py-2.5 font-semibold">ISIN</th>
              <th className="px-3 py-2.5 font-semibold">Kürzel</th>
              <th className="px-3 py-2.5 font-semibold">Underlying / Referenz</th>
              <th className="px-3 py-2.5 font-semibold">Hedge-Ticker</th>
              <th className="px-3 py-2.5 font-semibold">Hedge-ISIN</th>
              <th className="px-3 py-2.5 text-right font-semibold">Hedge-Faktor</th>
              <th className="px-3 py-2.5 text-right font-semibold">Gleichlauf R</th>
              <th className="px-3 py-2.5 font-semibold">Währung</th>
              <th className="px-3 py-2.5 font-semibold">Hedge-Qualität</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={`${r.isin}-${i}`} className="border-b border-border/60 last:border-0 hover:bg-surface-2/60">
                <td className="max-w-[220px] px-3 py-2.5 text-text-2">
                  <div className="flex items-center gap-1.5">
                    <span className="min-w-0 truncate" title={r.name ?? undefined}>
                      {r.name ?? "–"}
                    </span>
                    <LeverageBadge hebel={r.hebel} />
                  </div>
                </td>
                <td className="px-3 py-2.5 font-mono text-[12.5px] text-text">{r.isin}</td>
                <td className="px-3 py-2.5 font-medium text-text">{r.kuerzel ?? "–"}</td>
                <td className="max-w-[240px] px-3 py-2.5">
                  {r.underlying ? (
                    <div className="min-w-0">
                      <span className="block truncate text-text-2" title={r.underlying}>
                        {r.underlying}
                      </span>
                      {r.underlyingIsin && (
                        <span className="mt-0.5 inline-flex items-center gap-1 font-mono text-[11.5px] text-accent">
                          <span className="rounded bg-accent-soft px-1 py-px text-[9.5px] font-sans font-semibold uppercase not-italic tracking-wide">
                            Aktie
                          </span>
                          {r.underlyingIsin}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-faint">–</span>
                  )}
                </td>
                <td className="px-3 py-2.5 font-mono text-[12.5px] text-text">{r.hedgeTicker ?? "–"}</td>
                <td className="px-3 py-2.5 font-mono text-[12.5px] text-text-2">{r.hedgeIsin ?? "–"}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[12.5px] text-text-2 tabular-nums">
                  {formatFaktor(r.faktor)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-[12.5px] tabular-nums">
                  {r.gleichlauf !== null ? (
                    <span className={correlationColor(r.gleichlauf)}>{formatFaktor(r.gleichlauf)}</span>
                  ) : (
                    <span className="text-faint">–</span>
                  )}
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
