import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 0;

const YF = "https://query1.finance.yahoo.com/v8/finance/chart";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

type Quote = { price: number; currency: string | null; time: number | null };

async function fetchYahoo(symbol: string): Promise<Quote | null> {
  const url = `${YF}/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    next: { revalidate: 30 },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    chart?: { result?: { meta?: { regularMarketPrice?: number; currency?: string; regularMarketTime?: number } }[] };
  };
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta || typeof meta.regularMarketPrice !== "number") return null;
  return { price: meta.regularMarketPrice, currency: meta.currency ?? null, time: meta.regularMarketTime ?? null };
}

/**
 * Liefert Live-Kurse für mehrere Yahoo-Finance-Symbole auf einmal.
 * Aufruf: /api/quote?symbols=SMICHA.SW,GLD,EURCHF=X,EURUSD=X
 * Antwort: { quotes: { "GLD": { price, currency, time } | null, ... } }
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("symbols") ?? searchParams.get("symbol") ?? "";
  const symbols = Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ).slice(0, 12);

  if (symbols.length === 0) {
    return NextResponse.json({ error: "symbols fehlt" }, { status: 400 });
  }

  try {
    const results = await Promise.all(
      symbols.map(async (s) => [s, await fetchYahoo(s).catch(() => null)] as const),
    );
    const quotes: Record<string, Quote | null> = {};
    for (const [s, q] of results) quotes[s] = q;
    return NextResponse.json({ quotes }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Kursabruf fehlgeschlagen" }, { status: 502 });
  }
}
