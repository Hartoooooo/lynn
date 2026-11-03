"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Calculator, RefreshCw, Search, TrendingDown, TrendingUp } from "lucide-react";
import type { HedgeRow } from "@/lib/hedge-data";
import { cn } from "@/lib/utils";

type Direction = "long" | "short";

type Live = {
  loading: boolean;
  error: string | null;
  symbol: string | null;
  price: number | null;
  priceCurrency: string | null;
  fx: number | null;
  time: number | null;
  fxTime: number | null;
};

const EMPTY_LIVE: Live = {
  loading: false,
  error: null,
  symbol: null,
  price: null,
  priceCurrency: null,
  fx: null,
  time: null,
  fxTime: null,
};

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

function timeLabel(sec: number | null): string | null {
  if (!sec) return null;
  return new Date(sec * 1000).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HedgeCalculator({ rows }: { rows: HedgeRow[] }) {
  const [isin, setIsin] = useState("");
  const [direction, setDirection] = useState<Direction>("long");
  const [position, setPosition] = useState("");
  const [fx, setFx] = useState("");
  const [price, setPrice] = useState("");
  const [touchedFx, setTouchedFx] = useState(false);
  const [touchedPrice, setTouchedPrice] = useState(false);
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
    if (!row.hedgeTicker) {
      setLive({ ...EMPTY_LIVE, error: "Kein Hedge-Ticker hinterlegt" });
      return;
    }
    const id = ++reqId.current;
    setLive({ ...EMPTY_LIVE, loading: true });
    try {
      const params = new URLSearchParams({ symbol: row.hedgeTicker });
      if (row.waehrung) params.set("currency", row.waehrung);
      const res = await fetch(`/api/quote?${params.toString()}`, { cache: "no-store" });
      if (id !== reqId.current) return; // Antwort eines älteren Produkts verwerfen
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setLive({ ...EMPTY_LIVE, error: body.error ?? "Kursabruf fehlgeschlagen" });
        return;
      }
      const data = (await res.json()) as {
        symbol: string;
        price: number;
        priceCurrency: string | null;
        time: number | null;
        fx: number | null;
        fxTime: number | null;
      };
      if (id !== reqId.current) return;
      setLive({
        loading: false,
        error: null,
        symbol: data.symbol,
        price: data.price,
        priceCurrency: data.priceCurrency,
        fx: data.fx,
        time: data.time,
        fxTime: data.fxTime,
      });
    } catch {
      if (id !== reqId.current) return;
      setLive({ ...EMPTY_LIVE, error: "Kursabruf fehlgeschlagen" });
    }
  }, []);

  // Beim Produktwechsel: manuelle Eingaben zurücksetzen und Live-Kurs laden.
  const matchKey = match?.isin ?? "";
  useEffect(() => {
    if (!match) {
      setLive(EMPTY_LIVE);
      return;
    }
    setTouchedFx(false);
    setTouchedPrice(false);
    setFx("");
    setPrice("");
    loadLive(match);
  }, [matchKey, match, loadLive]);

  // Effektive Werte: manuell übersteuert > Live-Kurs > Beispielwert aus der Liste.
  const fxValue = touchedFx ? num(fx) : live.fx ?? match?.wechselkurs ?? null;
  const priceValue = touchedPrice ? num(price) : live.price ?? match?.kurs ?? null;

  const fxDisplay = touchedFx ? fx : live.fx != null ? String(live.fx) : match?.wechselkurs != null ? String(match.wechselkurs) : "";
  const priceDisplay = touchedPrice
    ? price
    : live.price != null
      ? String(live.price)
      : match?.kurs != null
        ? String(match.kurs)
        : "";

  const result = useMemo(() => {
    if (!match) return null;
    const pos = num(position);
    const faktor = num(match.faktor);
    if (pos === null || pos <= 0 || faktor === null) return null;

    const signedPos = direction === "long" ? pos : -pos;
    const action: "SELL" | "BUY" = signedPos * faktor > 0 ? "SELL" : "BUY";

    const hedgeAmountEur = pos * faktor;
    const hedgeAmountCcy = fxValue !== null ? hedgeAmountEur * fxValue : null;
    const shares =
      hedgeAmountCcy !== null && priceValue !== null && priceValue > 0
        ? Math.round(hedgeAmountCcy / priceValue)
        : null;

    return { action, faktor, hedgeAmountEur, hedgeAmountCcy, shares };
  }, [match, position, direction, fxValue, priceValue]);

  const priceSource = touchedPrice ? "manuell" : live.price != null ? "live" : match?.kurs != null ? "beispiel" : "fehlt";
  const fxSource = touchedFx ? "manuell" : live.fx != null ? "live" : match?.wechselkurs != null ? "beispiel" : "fehlt";

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

        {/* Position EUR */}
        <div>
          <label className="mb-1 block text-[12.5px] font-medium text-text-2">Positionsgröße in EUR</label>
          <input
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            inputMode="decimal"
            placeholder="z. B. 100000"
            aria-label="Positionsgröße in EUR"
            className="h-10 w-full rounded-[10px] border border-border bg-surface px-3 text-[13.5px] text-text outline-none placeholder:text-faint focus:border-border-strong"
          />
        </div>

        {/* Wechselkurs */}
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-[12.5px] font-medium text-text-2">
            Wechselkurs 1 EUR ={match?.waehrung ? ` ${match.waehrung}` : " Hedge-Währung"}
            <SourceTag source={fxSource} />
          </label>
          <input
            value={fxDisplay}
            onChange={(e) => {
              setTouchedFx(true);
              setFx(e.target.value);
            }}
            inputMode="decimal"
            placeholder={match?.wechselkurs != null ? String(match.wechselkurs) : "z. B. 1,1497"}
            aria-label="Wechselkurs"
            className="h-10 w-full rounded-[10px] border border-border bg-surface px-3 text-[13.5px] text-text outline-none placeholder:text-faint focus:border-border-strong"
          />
        </div>

        {/* Kurs Hedge-Produkt */}
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-[12.5px] font-medium text-text-2">
            Kurs Hedge-Produkt{match?.hedgeTicker ? ` (${match.hedgeTicker})` : ""}
            <SourceTag source={priceSource} />
          </label>
          <input
            value={priceDisplay}
            onChange={(e) => {
              setTouchedPrice(true);
              setPrice(e.target.value);
            }}
            inputMode="decimal"
            placeholder={match?.kurs != null ? String(match.kurs) : "Kurs in Hedge-Währung"}
            aria-label="Kurs Hedge-Produkt"
            className="h-10 w-full rounded-[10px] border border-border bg-surface px-3 text-[13.5px] text-text outline-none placeholder:text-faint focus:border-border-strong"
          />
        </div>
      </div>

      {/* Live-Status */}
      {match && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-faint">
          {live.loading ? (
            <span className="inline-flex items-center gap-1.5">
              <RefreshCw size={12} className="animate-spin" /> Live-Kurs wird geladen …
            </span>
          ) : live.error ? (
            <span className="text-amber-400">
              Live-Kurs nicht verfügbar ({live.error}) – Beispielwerte aus der Liste werden genutzt, bitte prüfen.
            </span>
          ) : live.price != null ? (
            <span>
              Live: {live.symbol} {fmt(live.price, 4)} {live.priceCurrency ?? ""}
              {live.fx != null && match.waehrung && match.waehrung !== "EUR" ? ` · EUR/${match.waehrung} ${fmt(live.fx, 4)}` : ""}
              {timeLabel(live.time) ? ` · Stand ${timeLabel(live.time)}` : ""}
            </span>
          ) : null}
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

      {/* Treffer / Ergebnis */}
      {isin.trim() !== "" && !match && suggestions.length === 0 && (
        <p className="mt-4 text-[13px] text-muted">Keine Übereinstimmung für „{isin.trim()}“ gefunden.</p>
      )}

      {match && (
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

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <span>Hedge-Produkt</span>
            <ArrowRight size={14} className="text-faint" />
            <span className="font-mono text-text">{match.hedgeTicker ?? "–"}</span>
            {match.hedgeIsin && <span className="font-mono text-[12px] text-text-2">({match.hedgeIsin})</span>}
            <span className="text-faint">·</span>
            <span>
              Faktor <span className="font-mono text-text-2">{fmt(num(match.faktor) ?? 0, 4)}</span>
            </span>
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
                {result.shares !== null && (
                  <span className="font-mono">
                    {" "}
                    · {fmt(result.shares)} Stk. {match.hedgeTicker}
                  </span>
                )}
              </div>

              <dl className="grid grid-cols-4 gap-3 max-[760px]:grid-cols-2 max-[480px]:grid-cols-1">
                <div className="rounded-lg bg-surface px-3 py-2.5">
                  <dt className="text-[11.5px] uppercase tracking-[0.04em] text-faint">Stückzahl</dt>
                  <dd className="mt-0.5 font-mono text-[15px] text-text tabular-nums">
                    {result.shares !== null ? `${fmt(result.shares)} Stk.` : "– (Kurs fehlt)"}
                  </dd>
                </div>
                <div className="rounded-lg bg-surface px-3 py-2.5">
                  <dt className="text-[11.5px] uppercase tracking-[0.04em] text-faint">
                    Kurs/Stück {priceValue !== null ? (priceSource === "live" ? "(live)" : "") : ""}
                  </dt>
                  <dd className="mt-0.5 font-mono text-[15px] text-text tabular-nums">
                    {priceValue !== null ? `${fmt(priceValue, 4)} ${match.waehrung ?? ""}` : "–"}
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
                Rechnung: Hedge-Betrag = Positionsgröße × Hedge-Faktor × Wechselkurs; Stückzahl = Hedge-Betrag ÷ Kurs des
                Hedge-Produkts. Richtung: Long + positiver Faktor → verkaufen, Short oder negativer Faktor → kaufen.
                Kurs und Wechselkurs werden live von Yahoo Finance gezogen; jedes Feld lässt sich manuell überschreiben.
              </p>
            </div>
          ) : (
            <p className="mt-4 border-t border-border pt-4 text-[13px] text-muted">
              Positionsgröße in EUR eingeben, um die Hedge-Order zu berechnen.
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
