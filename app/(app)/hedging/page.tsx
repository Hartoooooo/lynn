import type { Metadata } from "next";
import { HEDGE_ROWS } from "@/lib/hedge-data";
import { HedgeCalculator } from "./hedge-calculator";
import { HedgeTable } from "./hedge-table";

export const metadata: Metadata = { title: "Hedging" };

export default function HedgingPage() {
  return (
    <div className="mx-auto max-w-[1100px] px-8 pb-16 pt-12 max-[900px]:px-5">
      <h1 className="font-serif text-[30px] font-medium tracking-tight">Hedging</h1>
      <p className="mb-8 mt-1 max-w-[720px] text-muted">
        Alle unsere Produkte mit ISIN und Kürzel, dem passenden Hedge-Produkt (Ticker und ISIN), dem Hedge-Faktor, dem
        Gleichlauf (Korrelation R), der Währung des Hedge-Produkts sowie der Qualität des Hedges.
      </p>
      <HedgeCalculator rows={HEDGE_ROWS} />
      <HedgeTable rows={HEDGE_ROWS} />
    </div>
  );
}
