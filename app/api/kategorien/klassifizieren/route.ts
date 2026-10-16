import { NextResponse } from "next/server";
import { categoryAlias, klassifiziereNachName } from "@/lib/klassifizierer";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const ISIN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const MAX_INPUTS = 60;

type Result = {
  input: string;
  isin: string;
  name: string;
  ueber: string | null;
  unter: string;
  hebel: number | null;
  underlying: string;
  quelle: string;
  /** bereits in dieser Kategorie in der Datenbank vorhanden */
  exists: boolean;
};

/** Holt den Wertpapiernamen von Yahoo Finance (wie yfinance intern per Suche). */
async function yahooName(token: string, signal: AbortSignal): Promise<{ name: string; symbol: string } | null> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
    token,
  )}&quotesCount=1&newsCount=0&lang=de-DE&region=DE`;
  try {
    const res = await fetch(url, {
      signal,
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { quotes?: { longname?: string; shortname?: string; symbol?: string }[] };
    const q = data.quotes?.[0];
    if (!q) return null;
    return { name: q.longname || q.shortname || "", symbol: q.symbol || "" };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { inputs?: unknown } | null;
  const raw = Array.isArray(body?.inputs) ? body!.inputs : [];
  const tokens = [
    ...new Set(
      raw
        .flatMap((v) => (typeof v === "string" ? v.split(/[\s,;]+/) : []))
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean),
    ),
  ].slice(0, MAX_INPUTS);

  if (!tokens.length) return NextResponse.json({ error: "Bitte mindestens eine ISIN oder ein Kürzel angeben." }, { status: 400 });

  // Bereits erfasste ISINs (mit Kategorie) in einem Rutsch nachschlagen.
  const isins = tokens.filter((t) => ISIN.test(t));
  const known = new Map<string, { ueber: string; unter: string; hebel: number | null; name: string }>();
  if (isins.length) {
    const { data } = await supabase
      .from("securities")
      .select("isin, subcategory, hebel, name, category:security_categories(name)")
      .in("isin", isins);
    for (const r of (data ?? []) as unknown as {
      isin: string;
      subcategory: string;
      hebel: number | null;
      name: string;
      category: { name: string } | null;
    }[]) {
      if (r.category) known.set(r.isin, { ueber: r.category.name, unter: r.subcategory, hebel: r.hebel, name: r.name });
    }
  }

  const results: Result[] = [];
  for (const token of tokens) {
    const isIsin = ISIN.test(token);

    // 1) Bereits in der Datenbank → gespeicherte Zuordnung übernehmen.
    const hit = known.get(token);
    if (hit) {
      results.push({
        input: token,
        isin: isIsin ? token : "",
        name: hit.name,
        ueber: hit.ueber,
        unter: hit.unter,
        hebel: hit.hebel,
        underlying: "",
        quelle: "Datenbank (bereits erfasst)",
        exists: true,
      });
      continue;
    }

    // 2) Name von Yahoo holen und per Namensregeln klassifizieren.
    const yn = await yahooName(token, request.signal);
    const name = yn?.name ?? "";
    if (!name) {
      results.push({
        input: token,
        isin: isIsin ? token : "",
        name: "",
        ueber: null,
        unter: "",
        hebel: null,
        underlying: "",
        quelle: "Name nicht gefunden",
        exists: false,
      });
      continue;
    }
    const c = klassifiziereNachName(name);
    results.push({
      input: token,
      isin: isIsin ? token : "",
      name,
      ueber: c.kategorie ? categoryAlias(c.kategorie.ueber) : null,
      unter: c.kategorie?.unter ?? "",
      hebel: c.hebel,
      underlying: c.underlying,
      quelle: c.quelle,
      exists: false,
    });
  }

  return NextResponse.json({ results });
}
