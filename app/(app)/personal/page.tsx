import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarDays, Users } from "lucide-react";
import { PeopleDirectory } from "@/components/people/people-directory";
import type { Person } from "@/components/people/types";
import { RosterView } from "@/components/roster/roster-view";
import type { RosterActivity, RosterWeek } from "@/lib/roster";
import { canEdit, getSession, isAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Personal" };

type Tab = "dienstplan" | "ansprechpartner";

export default async function PersonalPage({ searchParams }: { searchParams: Promise<{ tab?: string; p?: string }> }) {
  const params = await searchParams;
  // ?p= kommt aus der Suche (Person) → Ansprechpartner-Tab
  const tab: Tab = params.tab === "ansprechpartner" || params.p ? "ansprechpartner" : "dienstplan";
  const { supabase, profile } = await getSession();

  const tabs = (
    <nav className="mb-8 flex gap-1 rounded-xl border border-border bg-surface p-1 text-sm sm:w-fit" aria-label="Personal-Bereiche">
      {(
        [
          ["dienstplan", "Dienstplan", <CalendarDays key="i" size={15} />],
          ["ansprechpartner", "Ansprechpartner", <Users key="i" size={15} />],
        ] as const
      ).map(([key, label, icon]) => (
        <Link
          key={key}
          href={key === "dienstplan" ? "/personal" : "/personal?tab=ansprechpartner"}
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

  if (tab === "dienstplan") {
    const [weeksRes, metaRes, activityRes] = await Promise.all([
      supabase.from("roster_weeks").select("id, start_date, range, dates, hint, shifts").order("start_date"),
      supabase.from("roster_meta").select("version, names").eq("id", 1).maybeSingle(),
      supabase
        .from("roster_activity")
        .select("id, created_at, note, swaps, author:profiles!roster_activity_created_by_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    return (
      <div className="mx-auto max-w-[1000px] px-8 pt-12 max-[900px]:px-5 max-sm:px-4 max-sm:pt-6">
        {tabs}
        <RosterView
          weeks={(weeksRes.data ?? []) as unknown as RosterWeek[]}
          names={metaRes.data?.names ?? []}
          activity={(activityRes.data ?? []) as unknown as RosterActivity[]}
          version={metaRes.data?.version ?? 0}
          isAdmin={isAdmin(profile.role)}
        />
      </div>
    );
  }

  const [peopleRes, topicsRes] = await Promise.all([
    supabase
      .from("people")
      .select(
        "id, name, position, department, email, phone, teams_url, avatar_url, bio, tags, topic_contacts(label, topic:topics(id, name, slug, color, icon))",
      )
      .order("name"),
    supabase.from("topics").select("id, name, color, icon").eq("archived", false).order("sort_order"),
  ]);

  return (
    <div className="mx-auto max-w-[1000px] px-8 pt-12 max-[900px]:px-5 max-sm:px-4 max-sm:pt-6">
      {tabs}
      <Suspense>
        <PeopleDirectory
          people={(peopleRes.data ?? []) as unknown as Person[]}
          topics={topicsRes.data ?? []}
          canEdit={canEdit(profile.role)}
        />
      </Suspense>
    </div>
  );
}
