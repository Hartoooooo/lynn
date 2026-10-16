"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Download, FileSpreadsheet, FolderTree, Loader2, Search, Upload } from "lucide-react";
import { importKategorien } from "@/app/actions";
import { useToast } from "@/components/toast";
import { Button, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";

export type CategoryOverview = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  total: number;
  subcategory_count: number;
};

export type Security = {
  id: string;
  subcategory: string;
  wkn: string;
  name: string;
  isin: string;
  kuerzel: string;
  hebel: number | null;
  underlying_name: string;
  underlying_isin: string;
  source: string;
};

const COLS = [
  { key: "wkn", label: "WKN" },
  { key: "name", label: "Name" },
  { key: "isin", label: "ISIN" },
  { key: "kuerzel", label: "Kürzel" },
  { key: "hebel", label: "Hebel" },
  { key: "underlying_name", label: "Underlying" },
  { key: "underlying_isin", label: "Underlying-ISIN" },
] as const;

type ColKey = (typeof COLS)[number]["key"];

function csvDownload(filename: string, header: string[], rows: string[][]) {
  const esc = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const body = [header, ...rows].map((r) => r.map(esc).join(";")).join("\r\n");
  // BOM, damit Excel Umlaute korrekt erkennt.
  const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CategoriesView({
  overview,
  selected,
  rows,
  canEdit,
}: {
  overview: CategoryOverview[];
  selected: CategoryOverview | null;
  rows: Security[];
  canEdit: boolean;
}) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [importing, startImport] = useTransition();

  const totalAll = overview.reduce((sum, c) => sum + c.total, 0);

  function runImport() {
    startImport(async () => {
      const res = await importKategorien();
      if (res.ok) {
        toast(
          `Importliste geladen: ${res.inserted} Einträge${res.skipped ? `, ${res.skipped} bereits vorhanden` : ""}.`,
        );
      } else {
        toast(res.message ?? "Import fehlgeschlagen.", "error");
      }
    });
  }

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.isin, r.wkn, r.kuerzel, r.subcategory, r.underlying_name, r.underlying_isin]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, q]);

  // Welche Spalten haben in dieser Kategorie überhaupt Werte?
  const visibleCols = useMemo<ColKey[]>(() => {
    const has = (key: ColKey) =>
      rows.some((r) => {
        const v = r[key];
        return v !== null && v !== undefined && String(v).trim() !== "";
      });
    return COLS.filter((c) => (c.key === "wkn" || c.key === "name" || c.key === "isin" || c.key === "kuerzel" ? true : has(c.key))).map(
      (c) => c.key,
    );
  }, [rows]);

  const hasSubcats = (selected?.subcategory_count ?? 0) > 0;

  // Nach Unterkategorie gruppieren (Reihenfolge wie geliefert, sortiert).
  const groups = useMemo(() => {
    const map = new Map<string, Security[]>();
    for (const r of filtered) {
      const key = r.subcategory || "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "de"));
  }, [filtered]);

  function exportCategoryCsv() {
    if (!selected) return;
    const header = ["Unterkategorie", ...visibleCols.map((k) => COLS.find((c) => c.key === k)!.label)];
    const body = filtered.map((r) => [
      r.subcategory,
      ...visibleCols.map((k) => (r[k] === null || r[k] === undefined ? "" : String(r[k]))),
    ]);
    csvDownload(`${selected.slug}.csv`, header, body);
  }

  const importButton = canEdit ? (
    <Button variant={totalAll === 0 ? "primary" : "secondary"} size="sm" onClick={runImport} disabled={importing}>
      {importing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
      {totalAll === 0 ? "Importliste laden" : "Liste aktualisieren"}
    </Button>
  ) : null;

  return (
    <div>
      {totalAll === 0 ? (
        <div className="mb-8">
          <EmptyState icon={<FolderTree size={28} />} title="Noch keine Wertpapiere importiert">
            {canEdit ? (
              <div className="mt-3 flex flex-col items-center gap-2">
                <span>Lade die beigefügte Kategorienliste (4006 Einträge) in die Datenbank.</span>
                {importButton}
              </div>
            ) : (
              "Ein Redakteur muss die Kategorienliste noch importieren."
            )}
          </EmptyState>
        </div>
      ) : (
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-[13px] text-muted">
            {overview.length} Oberkategorien · {totalAll.toLocaleString("de-DE")} Einträge
          </span>
          {importButton}
        </div>
      )}

      {totalAll > 0 && (
      <>
      {/* Kategorie-Kacheln */}
      <div className="mb-8 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {overview.map((c) => {
          const active = selected?.id === c.id;
          return (
            <Link
              key={c.id}
              href={`/kategorien?k=${c.slug}`}
              scroll={false}
              className={cn(
                "group rounded-xl border p-3.5 transition-colors",
                active
                  ? "border-accent/60 bg-accent-soft"
                  : "border-border bg-surface hover:border-border-strong hover:bg-surface-2",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <FolderTree size={17} className={cn("mt-0.5 shrink-0", active ? "text-accent" : "text-faint")} />
                <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[11px] font-medium text-muted">{c.total}</span>
              </div>
              <div className="mt-2 text-[13.5px] font-medium leading-tight text-text">{c.name}</div>
              {c.subcategory_count > 0 && (
                <div className="mt-0.5 text-[11.5px] text-faint">{c.subcategory_count} Unterkategorien</div>
              )}
            </Link>
          );
        })}
      </div>

      {!selected ? (
        <EmptyState icon={<FolderTree size={28} />} title="Noch keine Kategorien">
          Sobald die Kategorienliste importiert ist, erscheinen hier alle Oberkategorien.
        </EmptyState>
      ) : (
        <>
          {/* Werkzeugleiste */}
          <div className="sticky top-0 z-10 -mx-1 mb-4 flex flex-wrap items-center gap-2 bg-bg/90 px-1 py-2 backdrop-blur">
            <h2 className="mr-auto font-serif text-[22px] font-medium tracking-tight">{selected.name}</h2>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="In Kategorie suchen …"
                className="h-9 w-48 rounded-[10px] border border-border bg-surface pl-8 pr-3 text-sm text-text placeholder:text-faint focus:border-accent focus:outline-none max-sm:w-36"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={exportCategoryCsv} title="Diese Kategorie als CSV">
              <Download size={15} /> CSV
            </Button>
            <a
              href={`/api/kategorien/export?scope=${selected.slug}&format=xlsx`}
              className="inline-flex h-8 items-center justify-center gap-2 rounded-[10px] border border-border bg-surface-2 px-2.5 text-[13px] font-medium text-text-2 transition-colors hover:bg-surface-3 hover:text-text"
              title="Diese Kategorie als Excel"
            >
              <FileSpreadsheet size={15} /> Excel
            </a>
            <a
              href={`/api/kategorien/export?scope=all&format=xlsx`}
              className="inline-flex h-8 items-center justify-center gap-2 rounded-[10px] border border-border bg-surface-2 px-2.5 text-[13px] font-medium text-text-2 transition-colors hover:bg-surface-3 hover:text-text"
              title="Alle Kategorien als Excel-Arbeitsmappe"
            >
              <FileSpreadsheet size={15} /> Alle
            </a>
          </div>

          <p className="mb-4 text-[13px] text-muted">
            {filtered.length.toLocaleString("de-DE")} von {rows.length.toLocaleString("de-DE")} Einträgen
          </p>

          {groups.length === 0 ? (
            <EmptyState icon={<Search size={26} />} title="Keine Treffer">
              Für „{query}“ wurde in dieser Kategorie nichts gefunden.
            </EmptyState>
          ) : (
            <div className="space-y-8">
              {groups.map(([sub, items]) => (
                <section key={sub || "_"}>
                  {hasSubcats && (
                    <div className="mb-2 flex items-center gap-2">
                      <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-text-2">
                        {sub || "Ohne Unterkategorie"}
                      </h3>
                      <span className="text-[11.5px] text-faint">{items.length}</span>
                    </div>
                  )}
                  <SecurityTable cols={visibleCols} items={items} />
                </section>
              ))}
            </div>
          )}
        </>
      )}
      </>
      )}
    </div>
  );
}

function SecurityTable({ cols, items }: { cols: ColKey[]; items: Security[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr className="bg-surface text-left">
            {cols.map((k) => (
              <th
                key={k}
                className={cn(
                  "whitespace-nowrap px-3 py-2 font-semibold text-text-2",
                  k === "hebel" && "text-right",
                )}
              >
                {COLS.find((c) => c.key === k)!.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id} className="border-t border-border hover:bg-surface-2/50">
              {cols.map((k) => (
                <td
                  key={k}
                  className={cn(
                    "px-3 py-2 align-top text-text-2",
                    k === "name" && "min-w-[220px] font-medium text-text",
                    (k === "isin" || k === "underlying_isin" || k === "wkn") && "whitespace-nowrap font-mono text-[12.5px] text-muted",
                    k === "hebel" && "text-right tabular-nums",
                  )}
                >
                  {k === "hebel"
                    ? r.hebel === null || r.hebel === undefined
                      ? ""
                      : `${r.hebel > 0 ? "+" : ""}${r.hebel}`
                    : String(r[k] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
