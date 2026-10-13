import type { Metadata } from "next";
import { Suspense } from "react";
import { PeopleDirectory } from "@/components/people/people-directory";
import type { Person } from "@/components/people/types";
import { canEdit, getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Personal" };

export default async function PersonalPage() {
  const { supabase, profile } = await getSession();
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
    <div className="mx-auto max-w-[1000px] px-8 pt-12 max-[900px]:px-5">
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
