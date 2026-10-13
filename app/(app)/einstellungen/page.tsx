import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { ArchivedTopics, NameForm, UserRoles } from "@/components/settings/settings-forms";
import { getSession, isAdmin } from "@/lib/session";
import { cn, ROLE_LABEL } from "@/lib/utils";

export const metadata: Metadata = { title: "Einstellungen" };

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-8 first:border-t-0 first:pt-0">
      <h2 className="text-[15px] font-semibold text-text">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function SettingsPage() {
  const { supabase, profile, user } = await getSession();
  const admin = isAdmin(profile.role);
  const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY);

  const [usersRes, archivedRes, usageRes] = await Promise.all([
    admin ? supabase.from("profiles").select("id, full_name, email, role").order("created_at") : Promise.resolve({ data: [] }),
    admin ? supabase.from("topics").select("id, name").eq("archived", true).order("name") : Promise.resolve({ data: [] }),
    supabase.from("ai_usage").select("count").eq("user_id", user.id).eq("day", new Date().toISOString().slice(0, 10)).maybeSingle(),
  ]);

  return (
    <div className="mx-auto max-w-[720px] px-8 pt-12 max-[900px]:px-5">
      <h1 className="mb-10 font-serif text-[30px] font-medium tracking-tight">Einstellungen</h1>

      <Section title="Profil" description={`Angemeldet als ${user.email} · Rolle: ${ROLE_LABEL[profile.role]}`}>
        <NameForm initial={profile.full_name} />
      </Section>

      <Section title="KI-Suche" description="Mit dem KI-Schalter in der Suchleiste beantwortet Claude Fragen auf Basis eurer Inhalte – mit Quellen.">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
          <Sparkles size={18} className={cn(aiEnabled ? "text-accent" : "text-faint")} />
          <div className="flex-1 text-sm">
            <div className="font-medium text-text">{aiEnabled ? "Aktiv" : "Nicht eingerichtet"}</div>
            <div className="text-[12.5px] text-muted">
              {aiEnabled
                ? `Modell: ${process.env.ANTHROPIC_MODEL || "claude-opus-5-5"} · heute genutzt: ${usageRes.data?.count ?? 0} / ${process.env.AI_DAILY_LIMIT || 50}`
                : "Hinterlege ANTHROPIC_API_KEY in den Umgebungsvariablen (z. B. in Vercel), um die KI-Suche freizuschalten."}
            </div>
          </div>
        </div>
      </Section>

      {admin && (
        <>
          <Section
            title="Nutzer & Rollen"
            description="Neue Konten starten als Leser. Editoren dürfen Inhalte und Personal pflegen, Admins zusätzlich Themen löschen und Rollen vergeben."
          >
            <UserRoles users={usersRes.data ?? []} currentUserId={user.id} />
          </Section>
          <Section title="Archivierte Themen">
            <ArchivedTopics topics={archivedRes.data ?? []} />
          </Section>
        </>
      )}

      <Section title="Tastenkürzel">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt><kbd className="rounded border border-border px-1.5 text-[12px] text-muted">Strg K</kbd> / <kbd className="rounded border border-border px-1.5 text-[12px] text-muted">/</kbd></dt>
          <dd className="text-text-2">Suche öffnen</dd>
          <dt><kbd className="rounded border border-border px-1.5 text-[12px] text-muted">↑ ↓ Enter</kbd></dt>
          <dd className="text-text-2">Treffer auswählen und öffnen</dd>
          <dt><kbd className="rounded border border-border px-1.5 text-[12px] text-muted">Esc</kbd></dt>
          <dd className="text-text-2">Suche schließen</dd>
        </dl>
      </Section>
    </div>
  );
}
