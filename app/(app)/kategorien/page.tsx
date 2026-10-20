import type { Metadata } from "next";
import Link from "next/link";
import { FolderTree, Inbox, Sparkles } from "lucide-react";
import { CategoriesView, type CategoryOverview, type Security } from "@/components/kategorien/categories-view";
import { ClassifyPanel } from "@/components/kategorien/classify-panel";
import { UncategorizedView, type UncategorizedRow } from "@/components/kategorien/uncategorized-view";
import { DATASETS, DEFAULT_DATASET, datasetLabel, isDatasetKey } from "@/lib/datasets";
import { canEdit, getSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Kategorien" };

type Tab = "uebersicht" | "kategorisieren" | "nicht-kategorisiert";

export default async function KategorienPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; k?: string; ds?: string }>;
}) {
  const params = await searchParams;
  const tab: Tab =
    params.tab === "kategorisieren"
      ? "kategorisieren"
      : params.tab === "nicht-kategorisiert"
        ? "nicht-kategorisiert"
        : "uebersicht";
  const ds = isDatasetKey(params.ds) ? params.ds : DEFAULT_DATASET;
  const { supabase, profile } = await getSession();
  const editable = canEdit(profile.role);

  const [{ data: overviewData }, { data: countData }, { count: uncatCount }] = await Promise.all([
    supabase.rpc("security_overview", { p_dataset: ds }),
    supabase.rpc("security_dataset_counts"),
    supabase.from("uncategorized_securities").select("id", { count: "exact", head: true }).eq("dataset", ds),
  ]);
  const overview = ((overviewData ?? []) as CategoryOverview[]).map((c) => ({
    ...c,
    total: Number(c.total),
    subcategory_count: Number(c.subcategory_count),
  }));
  const counts = new Map((countData ?? []).map((r) => [r.dataset, Number(r.total)]));

  // Listen-Auswahl (EIX B / EIX M / HAM) – erhält den aktuellen Tab.
  const dsHref = (key: string) =>
    tab === "kategorisieren" ? `/kategorien?ds=${key}&tab=kategorisieren` : `/kategorien?ds=${key}`;
  const chooser = (
    <nav className="mb-5 flex flex-wrap gap-2" aria-label="Wertpapier-Listen">
      {DATASETS.map((d) => {
        const active = d.key === ds;
        return (
          <Link
            key={d.key}
            href={dsHref(d.key)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm transition-colors",
              active
                ? "border-accent/60 bg-accent-soft text-text"
                : "border-border bg-surface text-muted hover:border-border-strong hover:text-text",
            )}
          >
            <span className="font-medium">{d.label}</span>
            <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[11px] text-muted">
              {(counts.get(d.key) ?? 0).toLocaleString("de-DE")}
            </span>
          </Link>
        );
      })}
    </nav>
  );

  const tabHref = (t: Tab) => {
    const base = t === "uebersicht" ? "" : `tab=${t}`;
    const dsq = ds !== DEFAULT_DATASET ? `ds=${ds}` : "";
    const q = [dsq, base].filter(Boolean).join("&");
    return q ? `/kategorien?${q}` : "/kategorien";
  };
  const tabs = (
    <nav
      className="mb-8 flex gap-1 rounded-xl border border-border bg-surface p-1 text-sm sm:w-fit"
      aria-label="Kategorien-Bereiche"
    >
      {(
        [
          ["uebersicht", "Übersicht", <FolderTree key="i" size={15} />, null],
          ["kategorisieren", "Kategorisieren", <Sparkles key="i" size={15} />, null],
          ["nicht-kategorisiert", "Nicht kategorisiert", <Inbox key="i" size={15} />, uncatCount ?? 0],
        ] as const
      ).map(([key, label, icon, badge]) => (
        <Link
          key={key}
          href={tabHref(key)}
          aria-current={tab === key ? "page" : undefined}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 transition-colors sm:flex-none",
            tab === key ? "bg-surface-3 text-text" : "text-muted hover:text-text",
          )}
        >
          {icon}
          {label}
          {badge ? <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[11px] text-muted">{badge}</span> : null}
        </Link>
      ))}
    </nav>
  );

  if (tab === "kategorisieren") {
    return (
      <div className="mx-auto max-w-[1400px] px-8 pt-12 max-[900px]:px-5 max-sm:px-4 max-sm:pt-6">
        <Header />
        {chooser}
        {tabs}
        <ClassifyPanel categories={overview.map((c) => c.name)} canEdit={editable} dataset={ds} datasetLabel={datasetLabel(ds)} />
      </div>
    );
  }

  if (tab === "nicht-kategorisiert") {
    const { data } = await supabase
      .from("uncategorized_securities")
      .select("id, input, isin, name, kuerzel, hebel, underlying_name, quelle")
      .eq("dataset", ds)
      .order("created_at", { ascending: false })
      .limit(1000);
    return (
      <div className="mx-auto max-w-[1400px] px-8 pt-12 max-[900px]:px-5 max-sm:px-4 max-sm:pt-6">
        <Header />
        {chooser}
        {tabs}
        <UncategorizedView
          rows={(data ?? []) as UncategorizedRow[]}
          categories={overview.map((c) => c.name)}
          canEdit={editable}
          datasetLabel={datasetLabel(ds)}
        />
      </div>
    );
  }

  // Ausgewählte Kategorie (Standard: erste) samt Wertpapieren der aktuellen Liste laden.
  const selected = overview.find((c) => c.slug === params.k) ?? overview[0] ?? null;
  let rows: Security[] = [];
  if (selected) {
    const { data } = await supabase
      .from("securities")
      .select("id, subcategory, wkn, name, isin, kuerzel, hebel, underlying_name, underlying_isin, source")
      .eq("category_id", selected.id)
      .eq("dataset", ds)
      .order("subcategory")
      .order("name");
    rows = (data ?? []) as Security[];
  }

  return (
    <div className="mx-auto max-w-[1400px] px-8 pt-12 max-[900px]:px-5 max-sm:px-4 max-sm:pt-6">
      <Header />
      {chooser}
      {tabs}
      <CategoriesView
        overview={overview}
        selected={selected}
        rows={rows}
        canEdit={editable}
        dataset={ds}
        datasetLabel={datasetLabel(ds)}
      />
    </div>
  );
}

function Header() {
  return (
    <div className="mb-6">
      <h1 className="font-serif text-[30px] font-medium tracking-tight">Kategorien</h1>
      <p className="mt-1 text-muted">
        Wertpapiere nach Ober- und Unterkategorien – je Liste (EIX B / EIX M / HAM), durchsuchbar, exportierbar und
        automatisch klassifizierbar.
      </p>
    </div>
  );
}
