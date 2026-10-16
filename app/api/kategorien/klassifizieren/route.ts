import { NextResponse } from "next/server";
import { categoryAlias, klassifiziere } from "@/lib/klassifizierer";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const ISIN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const MAX_INPUTS = 40;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

type Result = {
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

type YahooMeta = { name: string; symbol: string; industry: string; industryKey: string; category: string };

// Yahoo verlangt für quoteSummary einen Crumb + Cookie. Einmal pro Request holen und wiederverwenden.
let crumbCache: { crumb: string; cookie: string } | null = null;

async function getCrumb(signal: AbortSignal): Promise<{ crumb: string; cookie: string } | null> {
  if (crumbCache) return crumbCache;
  try {
    const r1 = await fetch("https://fc.yahoo.com/", { signal, headers: { "User-Agent": UA } });
    const cookie = (r1.headers.getSetCookie?.() ?? [r1.headers.get("set-cookie") ?? ""])
      .map((c) => c.split(";")[0])
      .filter(Boolean)
      .join("; ");
    const r2 = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      signal,
      headers: { "User-Agent": UA, Cookie: cookie, Accept: "text/plain" },
    });
    const crumb = (await r2.text()).trim();
    if (crumb && !crumb.includes("<") && crumb.length < 40) {
      crumbCache = { crumb, cookie };
      return crumbCache;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Sucht das Wertpapier (Name, Symbol, quoteType) wie yfinance per Yahoo-Suche. */
async function yahooSearch(token: string, signal: AbortSignal) {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
    token,
  )}&quotesCount=1&newsCount=0&lang=de-DE&region=DE`;
  try {
    const res = await fetch(url, { signal, headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      quotes?: { longname?: string; shortname?: string; symbol?: string; quoteType?: string }[];
    };
    const q = data.quotes?.[0];
    if (!q) return null;
    return { name: q.longname || q.shortname || "", symbol: q.symbol || "", quoteType: q.quoteType || "" };
  } catch {
    return null;
  }
}

/** Holt industry/industryKey (Aktien) bzw. category (ETFs) über quoteSummary – best effort. */
async function yahooProfile(symbol: string, signal: AbortSignal): Promise<{ industry: string; industryKey: string; category: string }> {
  const empty = { industry: "", industryKey: "", category: "" };
  const cc = await getCrumb(signal);
  if (!cc || !symbol) return empty;
  const url =
    `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}` +
    `?modules=assetProfile,summaryProfile,fundProfile&crumb=${encodeURIComponent(cc.crumb)}`;
  try {
    const res = await fetch(url, { signal, headers: { "User-Agent": UA, Cookie: cc.cookie, Accept: "application/json" } });
    if (!res.ok) return empty;
    const data = (await res.json()) as {
      quoteSummary?: {
        result?: {
          assetProfile?: { industry?: string; industryKey?: string };
          summaryProfile?: { industry?: string; industryKey?: string };
          fundProfile?: { categoryName?: string };
        }[];
      };
    };
    const r = data.quoteSummary?.result?.[0];
    if (!r) return empty;
    return {
      industry: r.assetProfile?.industry ?? r.summaryProfile?.industry ?? "",
      industryKey: r.assetProfile?.industryKey ?? r.summaryProfile?.industryKey ?? "",
      category: r.fundProfile?.categoryName ?? "",
    };
  } catch {
    return empty;
  }
}

async function lookup(token: string, signal: AbortSignal): Promise<YahooMeta | null> {
  const s = await yahooSearch(token, signal);
  if (!s || !s.name) return null;
  const prof = s.symbol ? await yahooProfile(s.symbol, signal) : { industry: "", industryKey: "", category: "" };
  return { name: s.name, symbol: s.symbol, ...prof };
}

export async function POST(request: Request) {
  crumbCache = null;
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

    // 2) Yahoo abfragen und mit der vollen Hybrid-Logik klassifizieren.
    const meta = await lookup(token, request.signal);
    if (!meta) {
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
    const c = klassifiziere({
      name: meta.name,
      industry: meta.industry,
      industryKey: meta.industryKey,
      category: meta.category,
    });
    results.push({
      input: token,
      isin: isIsin ? token : "",
      name: meta.name,
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
