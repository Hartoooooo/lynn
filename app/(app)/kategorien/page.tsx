import type { Metadata } from "next";
import Link from "next/link";
import { FolderTree, Sparkles } from "lucide-react";
import { CategoriesView, type CategoryOverview, type Security } from "@/components/kategorien/categories-view";
import { ClassifyPanel } from "@/components/kategorien/classify-panel";
import { canEdit, getSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Kategorien" };

type Tab = "uebersicht" | "kategorisieren";

export default async function KategorienPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; k?: string }>;
}) {
  const params = await searchParams;
  const tab: Tab = params.tab === "kategorisieren" ? "kategorisieren" : "uebersicht";
  const { supabase, profile } = await getSession();
  const editable = canEdit(profile.role);

  const { data: overviewData } = await supabase
    .from("security_category_overview")
    .select("id, name, slug, sort_order, total, subcategory_count")
    .order("sort_order");
  const overview = (overviewData ?? []) as CategoryOverview[];

  const tabs = (
    <nav
      className="mb-8 flex gap-1 rounded-xl border border-border bg-surface p-1 text-sm sm:w-fit"
      aria-label="Kategorien-Bereiche"
    >
      {(
        [
          ["uebersicht", "Übersicht", <FolderTree key="i" size={15} />],
          ["kategorisieren", "Kategorisieren", <Sparkles key="i" size={15} />],
        ] as const
      ).map(([key, label, icon]) => (
        <Link
          key={key}
          href={key === "uebersicht" ? "/kategorien" : "/kategorien?tab=kategorisieren"}
          aria-current={tab === key ? "page" : undefined}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 transition-colors sm:flex-none",
            tab === key ? "bg-surface-3 text-text" : "text-muted hover:text-text",
          )}
        >
          {icon}
          {label}
        </Link>
      ))}
    </nav>
  );

  if (tab === "kategorisieren") {
    return (
      <div className="mx-auto max-w-[1400px] px-8 pt-12 max-[900px]:px-5 max-sm:px-4 max-sm:pt-6">
        <Header />
        {tabs}
        <ClassifyPanel categories={overview.map((c) => c.name)} canEdit={editable} />
      </div>
    );
  }

  // Ausgewählte Kategorie (Standard: erste) samt Wertpapieren laden.
  const selected = overview.find((c) => c.slug === params.k) ?? overview[0] ?? null;
  let rows: Security[] = [];
  if (selected) {
    const { data } = await supabase
      .from("securities")
      .select("id, subcategory, wkn, name, isin, kuerzel, hebel, underlying_name, underlying_isin, source")
      .eq("category_id", selected.id)
      .order("subcategory")
      .order("name");
    rows = (data ?? []) as Security[];
  }

  return (
    <div className="mx-auto max-w-[1400px] px-8 pt-12 max-[900px]:px-5 max-sm:px-4 max-sm:pt-6">
      <Header />
      {tabs}
      <CategoriesView overview={overview} selected={selected} rows={rows} canEdit={editable} />
    </div>
  );
}

function Header() {
  return (
    <div className="mb-6">
      <h1 className="font-serif text-[30px] font-medium tracking-tight">Kategorien</h1>
      <p className="mt-1 text-muted">
        Wertpapiere nach Ober- und Unterkategorien – durchsuchbar, exportierbar und automatisch klassifizierbar.
      </p>
    </div>
  );
}
