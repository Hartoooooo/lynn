import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const HEADERS = ["Kategorie", "Unterkategorie", "WKN", "Name", "ISIN", "Kürzel", "Hebel", "Underlying", "Underlying-ISIN"];

type Row = {
  subcategory: string;
  wkn: string;
  name: string;
  isin: string;
  kuerzel: string;
  hebel: number | null;
  underlying_name: string;
  underlying_isin: string;
};

function sheetName(name: string, used: Set<string>) {
  const base = name.replace(/[:\\/?*[\]]/g, " ").slice(0, 31) || "Blatt";
  let n = base;
  for (let i = 2; used.has(n); i++) n = `${base.slice(0, 28)} ${i}`;
  used.add(n);
  return n;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") || "all";
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";

  let catQuery = supabase.from("security_categories").select("id, name, slug").order("sort_order");
  if (scope !== "all") catQuery = catQuery.eq("slug", scope);
  const { data: cats } = await catQuery;
  if (!cats?.length) return NextResponse.json({ error: "Kategorie nicht gefunden." }, { status: 404 });

  async function rowsFor(categoryId: string): Promise<Row[]> {
    const out: Row[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("securities")
        .select("subcategory, wkn, name, isin, kuerzel, hebel, underlying_name, underlying_isin")
        .eq("category_id", categoryId)
        .order("subcategory")
        .order("name")
        .range(from, from + PAGE - 1);
      if (error) break;
      out.push(...((data ?? []) as Row[]));
      if (!data || data.length < PAGE) break;
    }
    return out;
  }

  const hebelStr = (h: number | null) => (h === null || h === undefined ? "" : `${h > 0 ? "+" : ""}${h}`);
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const esc = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [HEADERS.join(";")];
    for (const c of cats) {
      for (const r of await rowsFor(c.id)) {
        lines.push(
          [c.name, r.subcategory, r.wkn, r.name, r.isin, r.kuerzel, hebelStr(r.hebel), r.underlying_name, r.underlying_isin]
            .map((v) => esc(String(v ?? "")))
            .join(";"),
        );
      }
    }
    const filename = scope === "all" ? `kategorien_${stamp}.csv` : `${scope}_${stamp}.csv`;
    return new Response("﻿" + lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Lynn";
  const used = new Set<string>();
  for (const c of cats) {
    const ws = wb.addWorksheet(sheetName(c.name, used));
    // Pro Blatt ohne die redundante Kategorie-Spalte.
    const cols = HEADERS.slice(1);
    const head = ws.addRow(cols);
    head.font = { bold: true };
    head.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDE9E0" } };
    });
    for (const r of await rowsFor(c.id)) {
      ws.addRow([r.subcategory, r.wkn, r.name, r.isin, r.kuerzel, hebelStr(r.hebel), r.underlying_name, r.underlying_isin]);
    }
    ws.columns.forEach((col) => {
      let max = 10;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        max = Math.min(60, Math.max(max, String(cell.value ?? "").length + 2));
      });
      col.width = max;
    });
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }

  const buffer = await wb.xlsx.writeBuffer();
  const filename = scope === "all" ? `kategorien_${stamp}.xlsx` : `${scope}_${stamp}.xlsx`;
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
