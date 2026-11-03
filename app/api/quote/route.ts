import { NextResponse } from "next/server";

export const runtime = "nodejs";
// Kurse höchstens ~30s cachen, damit mehrere Nutzer nicht jede Eingabe neu abrufen.
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // Mehrere Ticker (z. B. "GLD,IAU,GLDM") → ersten verwenden.
  const rawSymbol = (searchParams.get("symbol") ?? "").split(/[,;\s]+/)[0]?.trim().toUpperCase();
  const currency = (searchParams.get("currency") ?? "").trim().toUpperCase();

  if (!rawSymbol) {
    return NextResponse.json({ error: "symbol fehlt" }, { status: 400 });
  }

  try {
    // Kurs des Hedge-Produkts und ggf. Wechselkurs EUR→Währung parallel abrufen.
    const needFx = Boolean(currency) && currency !== "EUR";
    const fxSymbol = needFx ? `EUR${currency}=X` : null;
    const [quote, fxQuote] = await Promise.all([
      fetchYahoo(rawSymbol),
      fxSymbol ? fetchYahoo(fxSymbol) : Promise.resolve(null),
    ]);

    if (!quote) {
      return NextResponse.json({ error: `Kein Kurs für ${rawSymbol} gefunden` }, { status: 404 });
    }

    return NextResponse.json(
      {
        symbol: rawSymbol,
        price: quote.price,
        priceCurrency: quote.currency,
        time: quote.time,
        fx: needFx ? (fxQuote?.price ?? null) : 1,
        fxSymbol,
        fxTime: fxQuote?.time ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Kursabruf fehlgeschlagen" }, { status: 502 });
  }
}
