import { AppShell } from "@/components/shell/app-shell";
import { getSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile, user } = await getSession();
  const { data: topics } = await supabase
    .from("topics")
    .select("id, name, slug, icon, color")
    .eq("archived", false)
    .order("sort_order")
    .order("name");

  return (
    <AppShell
      topics={topics ?? []}
      user={{ name: profile.full_name || user.email || "Nutzer", email: user.email ?? "", role: profile.role }}
      aiEnabled={Boolean(process.env.ANTHROPIC_API_KEY)}
    >
      {children}
    </AppShell>
  );
}
