"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Calculator, RefreshCw, Search, TrendingDown, TrendingUp } from "lucide-react";
import type { HedgeRow } from "@/lib/hedge-data";
import { cn } from "@/lib/utils";

type Direction = "long" | "short";
type Quote = { price: number; currency: string | null; time: number | null };

type Live = {
  loading: boolean;
  error: string | null;
  quotes: Record<string, Quote | null>;
};

const EMPTY_LIVE: Live = { loading: false, error: null, quotes: {} };

const QUALITY_STYLE: Record<string, string> = {
  gut: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25",
  mittel: "bg-amber-500/15 text-amber-300 ring-amber-500/25",
  "unsicher (kurze Historie)": "bg-sky-500/15 text-sky-300 ring-sky-500/25",
  schwach: "bg-rose-500/15 text-rose-300 ring-rose-500/25",
  "keine Daten": "bg-surface-3 text-faint ring-border",
};

function num(v: number | string | null): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function fmt(n: number, max = 2) {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: max });
}

function timeLabel(sec: number | null | undefined): string | null {
  if (!sec) return null;
  return new Date(sec * 1000).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fxSymbolFor(ccy: string | null | undefined): string | null {
  if (!ccy || ccy.toUpperCase() === "EUR") return null;
  return `EUR${ccy.toUpperCase()}=X`;
}

export function HedgeCalculator({ rows }: { rows: HedgeRow[] }) {
  const [isin, setIsin] = useState("");
  const [direction, setDirection] = useState<Direction>("long");
  const [shares, setShares] = useState("");
  const [ourPrice, setOurPrice] = useState("");
  const [hedgePrice, setHedgePrice] = useState("");
  const [touchedOur, setTouchedOur] = useState(false);
  const [touchedHedge, setTouchedHedge] = useState(false);
  const [live, setLive] = useState<Live>(EMPTY_LIVE);
  const reqId = useRef(0);

  const byIsin = useMemo(() => {
    const m = new Map<string, HedgeRow>();
    for (const r of rows) m.set(r.isin.toUpperCase(), r);
    return m;
  }, [rows]);

  const suggestions = useMemo(() => {
    const q = isin.trim().toLowerCase();
    if (q.length < 2) return [];
    if (byIsin.has(isin.trim().toUpperCase())) return [];
    return rows
      .filter(
        (r) =>
          r.isin.toLowerCase().includes(q) ||
          (r.kuerzel && r.kuerzel.toLowerCase().includes(q)) ||
          (r.name && r.name.toLowerCase().includes(q)),
      )
      .slice(0, 6);
  }, [rows, isin, byIsin]);

  const match = byIsin.get(isin.trim().toUpperCase()) ?? null;

  const loadLive = useCallback(async (row: HedgeRow) => {
    const symbols = [
      row.ourSymbol,
      row.hedgeTicker,
      fxSymbolFor(row.ourWaehrung),
      fxSymbolFor(row.waehrung),
    ].filter((s): s is string => Boolean(s));
    if (symbols.length === 0) {
      setLive({ loading: false, error: "Keine Kursquelle hinterlegt", quotes: {} });
      return;
    }
    const id = ++reqId.current;
    setLive({ loading: true, error: null, quotes: {} });
    try {
      const res = await fetch(`/api/quote?symbols=${encodeURIComponent(symbols.join(","))}`, { cache: "no-store" });
      if (id !== reqId.current) return;
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setLive({ loading: false, error: body.error ?? "Kursabruf fehlgeschlagen", quotes: {} });
        return;
      }
      const data = (await res.json()) as { quotes: Record<string, Quote | null> };
      if (id !== reqId.current) return;
      setLive({ loading: false, error: null, quotes: data.quotes ?? {} });
    } catch {
      if (id !== reqId.current) return;
      setLive({ loading: false, error: "Kursabruf fehlgeschlagen", quotes: {} });
    }
  }, []);

  const isHebel = match?.source === "hebel";

  const matchKey = match?.isin ?? "";
  useEffect(() => {
    if (!match || match.source === "hebel") {
      setLive(EMPTY_LIVE);
      return;
    }
    setTouchedOur(false);
    setTouchedHedge(false);
    setOurPrice("");
    setHedgePrice("");
    loadLive(match);
  }, [matchKey, match, loadLive]);

  const ourQuote = match?.ourSymbol ? live.quotes[match.ourSymbol] : null;
  const hedgeQuote = match?.hedgeTicker ? live.quotes[match.hedgeTicker] : null;
  const ourFxSymbol = fxSymbolFor(match?.ourWaehrung);
  const hedgeFxSymbol = fxSymbolFor(match?.waehrung);
  const ourFx = match?.ourWaehrung && match.ourWaehrung.toUpperCase() !== "EUR"
    ? (ourFxSymbol ? live.quotes[ourFxSymbol]?.price ?? null : null)
    : 1; // EUR oder unbekannt → 1
  const hedgeFx = match?.waehrung && match.waehrung.toUpperCase() !== "EUR"
    ? (hedgeFxSymbol ? live.quotes[hedgeFxSymbol]?.price ?? null : null) ?? match?.wechselkurs ?? null
    : 1;

  // Effektive Kurse: manuell > live > (Hedge: Beispiel aus Liste)
  const ourPriceValue = touchedOur ? num(ourPrice) : ourQuote?.price ?? null;
  const hedgePriceValue = touchedHedge ? num(hedgePrice) : hedgeQuote?.price ?? match?.kurs ?? null;

  const ourPriceDisplay = touchedOur ? ourPrice : ourQuote?.price != null ? String(ourQuote.price) : "";
  const hedgePriceDisplay = touchedHedge
    ? hedgePrice
    : hedgeQuote?.price != null
      ? String(hedgeQuote.price)
      : match?.kurs != null
        ? String(match.kurs)
        : "";

  const result = useMemo(() => {
    if (!match) return null;
    const qty = num(shares);
    const faktor = num(match.faktor);
    if (qty === null || qty <= 0 || faktor === null) return null;
    if (ourPriceValue === null || ourFx === null || ourFx === 0) return null;

    // Positionswert: Stück × Kurs (in Handelswährung) → in EUR
    const positionValueCcy = qty * ourPriceValue;
    const positionEur = positionValueCcy / ourFx;

    const signedPos = direction === "long" ? qty : -qty;
    const action: "SELL" | "BUY" = signedPos * faktor > 0 ? "SELL" : "BUY";

    const hedgeAmountEur = positionEur * faktor;
    const hedgeAmountCcy = hedgeFx !== null ? hedgeAmountEur * hedgeFx : null;
    const hedgeShares =
      hedgeAmountCcy !== null && hedgePriceValue !== null && hedgePriceValue > 0
        ? Math.round(hedgeAmountCcy / hedgePriceValue)
        : null;

    return { action, faktor, positionValueCcy, positionEur, hedgeAmountEur, hedgeAmountCcy, hedgeShares };
  }, [match, shares, direction, ourPriceValue, ourFx, hedgeFx, hedgePriceValue]);

  const ourSource = touchedOur ? "manuell" : ourQuote?.price != null ? "live" : "fehlt";
  const hedgeSource = touchedHedge ? "manuell" : hedgeQuote?.price != null ? "live" : match?.kurs != null ? "beispiel" : "fehlt";
  const ourCcy = match?.ourWaehrung ?? "EUR";

  return (
    <div className="mb-8 rounded-xl border border-border bg-surface/60 p-5 max-[900px]:p-4">
      <div className="mb-4 flex items-center gap-2">
        <Calculator size={18} className="text-accent" />
        <h2 className="font-serif text-[18px] font-medium tracking-tight">Hedge berechnen</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
        {/* ISIN */}
        <div className="relative col-span-2 max-[640px]:col-span-1">
          <label className="mb-1 block text-[12.5px] font-medium text-text-2">ISIN unseres Wertes</label>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              value={isin}
              onChange={(e) => setIsin(e.target.value)}
              placeholder="z. B. CH0017142719 oder Kürzel / Name"
              aria-label="ISIN unseres Wertes"
              autoComplete="off"
              spellCheck={false}
              className="h-10 w-full rounded-[10px] border border-border bg-surface pl-9 pr-3 font-mono text-[13.5px] uppercase text-text outline-none placeholder:font-sans placeholder:normal-case placeholder:text-faint focus:border-border-strong"
            />
          </div>
          {suggestions.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-[10px] border border-border bg-surface-2 shadow-lg">
              {suggestions.map((s) => (
                <li key={s.isin}>
                  <button
                    onClick={() => setIsin(s.isin)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-surface-3"
                  >
                    <span className="font-mono text-[12.5px] text-text">{s.isin}</span>
                    <span className="font-medium text-text-2">{s.kuerzel}</span>
                    <span className="truncate text-faint">{s.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!isHebel && (
          <>
        {/* Position in Stück */}
        <div>
          <label className="mb-1 block text-[12.5px] font-medium text-text-2">Positionsgröße in Stück</label>
          <input
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            inputMode="decimal"
            placeholder="z. B. 1000"
            aria-label="Positionsgröße in Stück"
            className="h-10 w-full rounded-[10px] border border-border bg-surface px-3 text-[13.5px] text-text outline-none placeholder:text-faint focus:border-border-strong"
          />
        </div>

        {/* Richtung */}
        <div>
          <label className="mb-1 block text-[12.5px] font-medium text-text-2">Unsere Position</label>
          <div className="flex h-10 rounded-[10px] border border-border bg-surface p-0.5">
            <button
              onClick={() => setDirection("long")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-[8px] text-[13px] font-medium transition-colors",
                direction === "long" ? "bg-surface-3 text-text" : "text-text-2 hover:text-text",
              )}
            >
              <TrendingUp size={15} /> Long (+)
            </button>
            <button
              onClick={() => setDirection("short")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-[8px] text-[13px] font-medium transition-colors",
                direction === "short" ? "bg-surface-3 text-text" : "text-text-2 hover:text-text",
              )}
            >
              <TrendingDown size={15} /> Short (−)
            </button>
          </div>
        </div>

        {/* Kurs unseres Produkts */}
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-[12.5px] font-medium text-text-2">
            Kurs unseres Produkts ({ourCcy})
            <SourceTag source={ourSource} />
          </label>
          <input
            value={ourPriceDisplay}
            onChange={(e) => {
              setTouchedOur(true);
              setOurPrice(e.target.value);
            }}
            inputMode="decimal"
            placeholder={`Kurs in ${ourCcy}`}
            aria-label="Kurs unseres Produkts"
            className="h-10 w-full rounded-[10px] border border-border bg-surface px-3 text-[13.5px] text-text outline-none placeholder:text-faint focus:border-border-strong"
          />
        </div>

        {/* Kurs Hedge-Produkt */}
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-[12.5px] font-medium text-text-2">
            Kurs Hedge-Produkt{match?.hedgeTicker ? ` (${match.hedgeTicker})` : ""}
            <SourceTag source={hedgeSource} />
          </label>
          <input
            value={hedgePriceDisplay}
            onChange={(e) => {
              setTouchedHedge(true);
              setHedgePrice(e.target.value);
            }}
            inputMode="decimal"
            placeholder={match?.kurs != null ? String(match.kurs) : "Kurs in Hedge-Währung"}
            aria-label="Kurs Hedge-Produkt"
            className="h-10 w-full rounded-[10px] border border-border bg-surface px-3 text-[13.5px] text-text outline-none placeholder:text-faint focus:border-border-strong"
          />
        </div>
          </>
        )}
      </div>

      {/* Hinweis für Hebel-/Krypto-Produkte (kein Hedge-Produkt hinterlegt) */}
      {isHebel && match && (
        <div className="mt-4 rounded-lg border border-border bg-surface-2/60 p-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px]">
            <span className="font-medium text-text">{match.kuerzel}</span>
            <span className="text-faint">·</span>
            <span className="text-text-2">{match.name}</span>
            {match.hebel != null && (
              <span className="ml-auto inline-flex items-center rounded-md bg-surface-3 px-2 py-0.5 font-mono text-[12px] text-text-2">
                Hebel {Number(match.hebel) < 0 ? "−" : ""}
                {Math.abs(Number(match.hebel))}×
              </span>
            )}
          </div>
          {match.underlying && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-muted">
              <span>Underlying</span>
              <ArrowRight size={14} className="text-faint" />
              <span className="text-text-2">{match.underlying}</span>
              {match.underlyingIsin && (
                <span className="inline-flex items-center gap-1 font-mono text-[12.5px] text-accent">
                  <span className="rounded bg-accent-soft px-1 py-px text-[9.5px] font-sans font-semibold uppercase tracking-wide">
                    Aktie
                  </span>
                  {match.underlyingIsin}
                </span>
              )}
            </div>
          )}
          <p className="mt-3 text-[12px] leading-relaxed text-faint">
            Für Hebel-, Short- und Krypto-Produkte ist hier keine automatische Hedge-Berechnung hinterlegt – sie sind in
            der Tabelle unten gelistet. Der Hedge erfolgt praktisch über das Underlying (bei Einzelaktien die oben
            genannte ISIN) entsprechend dem Hebelfaktor.
          </p>
        </div>
      )}

      {/* Live-Status */}
      {match && !isHebel && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-faint">
          {live.loading ? (
            <span className="inline-flex items-center gap-1.5">
              <RefreshCw size={12} className="animate-spin" /> Live-Kurse werden geladen …
            </span>
          ) : live.error ? (
            <span className="text-amber-400">Live-Kurse nicht verfügbar ({live.error}) – bitte Kurse manuell eintragen.</span>
          ) : (
            <span className="flex flex-wrap items-center gap-x-2">
              {ourQuote?.price != null && (
                <span>
                  {match.ourSymbol}: {fmt(ourQuote.price, 4)} {ourQuote.currency ?? ourCcy}
                </span>
              )}
              {hedgeQuote?.price != null && (
                <>
                  <span className="text-border">·</span>
                  <span>
                    {match.hedgeTicker}: {fmt(hedgeQuote.price, 4)} {hedgeQuote.currency ?? match.waehrung ?? ""}
                  </span>
                </>
              )}
              {ourFxSymbol && live.quotes[ourFxSymbol]?.price != null && (
                <>
                  <span className="text-border">·</span>
                  <span>
                    EUR/{match.ourWaehrung} {fmt(live.quotes[ourFxSymbol]!.price, 4)}
                  </span>
                </>
              )}
              {hedgeFxSymbol && live.quotes[hedgeFxSymbol]?.price != null && (
                <>
                  <span className="text-border">·</span>
                  <span>
                    EUR/{match.waehrung} {fmt(live.quotes[hedgeFxSymbol]!.price, 4)}
                  </span>
                </>
              )}
              {timeLabel(hedgeQuote?.time ?? ourQuote?.time) && (
                <>
                  <span className="text-border">·</span>
                  <span>Stand {timeLabel(hedgeQuote?.time ?? ourQuote?.time)}</span>
                </>
              )}
            </span>
          )}
          {!live.loading && (
            <button
              onClick={() => match && loadLive(match)}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-text-2 transition hover:bg-surface-2 hover:text-text"
            >
              <RefreshCw size={12} /> Aktualisieren
            </button>
          )}
        </div>
      )}

      {/* Keine Übereinstimmung */}
      {isin.trim() !== "" && !match && suggestions.length === 0 && (
        <p className="mt-4 text-[13px] text-muted">Keine Übereinstimmung für „{isin.trim()}“ gefunden.</p>
      )}

      {match && !isHebel && (
        <div className="mt-5 rounded-lg border border-border bg-surface-2/60 p-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px]">
            <span className="font-medium text-text">{match.kuerzel}</span>
            <span className="text-faint">·</span>
            <span className="text-text-2">{match.name}</span>
            <span
              className={cn(
                "ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-medium ring-1 ring-inset",
                QUALITY_STYLE[match.qualitaet ?? "keine Daten"] ?? QUALITY_STYLE["keine Daten"],
              )}
            >
              Hedge: {match.qualitaet ?? "keine Daten"}
            </span>
          </div>

          {match.underlying && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-muted">
              <span>Underlying / Referenz</span>
              <ArrowRight size={14} className="text-faint" />
              <span className="text-text-2">{match.underlying}</span>
              {match.underlyingIsin && (
                <span className="inline-flex items-center gap-1 font-mono text-[12.5px] text-accent">
                  <span className="rounded bg-accent-soft px-1 py-px text-[9.5px] font-sans font-semibold uppercase tracking-wide">
                    Aktie
                  </span>
                  {match.underlyingIsin}
                </span>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <span>Hedge-Produkt</span>
            <ArrowRight size={14} className="text-faint" />
            <span className="font-mono text-text">{match.hedgeTicker ?? "–"}</span>
            {match.hedgeIsin && <span className="font-mono text-[12px] text-text-2">({match.hedgeIsin})</span>}
            <span className="text-faint">·</span>
            <span>
              Faktor <span className="font-mono text-text-2">{fmt(num(match.faktor) ?? 0, 4)}</span>
            </span>
            {match.gleichlauf !== null && (
              <>
                <span className="text-faint">·</span>
                <span>
                  Gleichlauf R <span className="font-mono text-text-2">{fmt(match.gleichlauf, 4)}</span>
                </span>
              </>
            )}
            {match.waehrung && (
              <>
                <span className="text-faint">·</span>
                <span>
                  Währung <span className="text-text-2">{match.waehrung}</span>
                </span>
              </>
            )}
          </div>

          {result ? (
            <div className="mt-4 border-t border-border pt-4">
              {/* Positionswert */}
              <p className="mb-3 text-[13px] text-muted">
                Position: <span className="font-mono text-text-2">{fmt(num(shares) ?? 0)} Stk.</span> ×{" "}
                <span className="font-mono text-text-2">
                  {ourPriceValue !== null ? `${fmt(ourPriceValue, 4)} ${ourCcy}` : "–"}
                </span>{" "}
                ={" "}
                <span className="font-mono text-text">{fmt(result.positionEur)} €</span>
                {ourCcy !== "EUR" && (
                  <span className="text-faint"> (umgerechnet über EUR/{ourCcy})</span>
                )}
              </p>

              <div
                className={cn(
                  "mb-3 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[14px] font-semibold ring-1 ring-inset",
                  result.action === "SELL"
                    ? "bg-rose-500/15 text-rose-300 ring-rose-500/25"
                    : "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25",
                )}
              >
                {result.action === "SELL" ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                {result.action === "SELL" ? "Hedge-Produkt VERKAUFEN (Short)" : "Hedge-Produkt KAUFEN (Long)"}
                {result.hedgeShares !== null && (
                  <span className="font-mono">
                    {" "}
                    · {fmt(result.hedgeShares)} Stk. {match.hedgeTicker}
                  </span>
                )}
              </div>

              <dl className="grid grid-cols-4 gap-3 max-[760px]:grid-cols-2 max-[480px]:grid-cols-1">
                <div className="rounded-lg bg-surface px-3 py-2.5">
                  <dt className="text-[11.5px] uppercase tracking-[0.04em] text-faint">Stückzahl Hedge</dt>
                  <dd className="mt-0.5 font-mono text-[15px] text-text tabular-nums">
                    {result.hedgeShares !== null ? `${fmt(result.hedgeShares)} Stk.` : "– (Kurs fehlt)"}
                  </dd>
                </div>
                <div className="rounded-lg bg-surface px-3 py-2.5">
                  <dt className="text-[11.5px] uppercase tracking-[0.04em] text-faint">
                    Kurs/Stück {hedgeSource === "live" ? "(live)" : ""}
                  </dt>
                  <dd className="mt-0.5 font-mono text-[15px] text-text tabular-nums">
                    {hedgePriceValue !== null ? `${fmt(hedgePriceValue, 4)} ${match.waehrung ?? ""}` : "–"}
                  </dd>
                </div>
                <div className="rounded-lg bg-surface px-3 py-2.5">
                  <dt className="text-[11.5px] uppercase tracking-[0.04em] text-faint">
                    Hedge-Betrag {match.waehrung ? `(${match.waehrung})` : ""}
                  </dt>
                  <dd className="mt-0.5 font-mono text-[15px] text-text tabular-nums">
                    {result.hedgeAmountCcy !== null
                      ? `${fmt(result.hedgeAmountCcy)} ${match.waehrung ?? ""}`
                      : "– (Wechselkurs fehlt)"}
                  </dd>
                </div>
                <div className="rounded-lg bg-surface px-3 py-2.5">
                  <dt className="text-[11.5px] uppercase tracking-[0.04em] text-faint">Hedge-Betrag (EUR)</dt>
                  <dd className="mt-0.5 font-mono text-[15px] text-text tabular-nums">{fmt(result.hedgeAmountEur)} €</dd>
                </div>
              </dl>

              <p className="mt-3 text-[12px] leading-relaxed text-faint">
                Rechnung: Positionswert = Stück × Kurs unseres Produkts (in EUR umgerechnet); Hedge-Betrag = Positionswert
                × Hedge-Faktor; Stückzahl Hedge = Hedge-Betrag ÷ Kurs des Hedge-Produkts. Richtung: Long + positiver
                Faktor → verkaufen, Short oder negativer Faktor → kaufen. Kurse und Wechselkurse kommen live von Yahoo
                Finance; die Kursfelder lassen sich manuell überschreiben.
              </p>
            </div>
          ) : (
            <p className="mt-4 border-t border-border pt-4 text-[13px] text-muted">
              {ourPriceValue === null
                ? "Kurs unseres Produkts fehlt – bitte abwarten (Live-Kurs lädt) oder manuell eintragen."
                : "Positionsgröße in Stück eingeben, um die Hedge-Order zu berechnen."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SourceTag({ source }: { source: string }) {
  if (source === "live")
    return (
      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300">
        live
      </span>
    );
  if (source === "manuell")
    return (
      <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-2">
        manuell
      </span>
    );
  if (source === "beispiel")
    return (
      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-300">
        Beispiel
      </span>
    );
  return null;
}
