import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables, UserRole } from "@/lib/database.types";

export type Profile = Tables<"profiles">;

/** Client + geprüfter Nutzer (ohne Profil); leitet ohne Login auf /login um. */
export const getAuth = cache(async () => {
  const supabase = await createClient();
  // JWT lokal geprüft (getClaims) statt Rundreise zum Auth-Server – die DB prüft ohnehin per RLS.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");
  const user = { id: claims.sub, email: typeof claims.email === "string" ? claims.email : undefined };
  return { supabase, user };
});

/** Aktueller Nutzer samt Profil; leitet ohne Login auf /login um. */
export const getSession = cache(async () => {
  const { supabase, user } = await getAuth();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return {
    supabase,
    user,
    profile: profile ?? {
      id: user.id,
      email: user.email ?? null,
      full_name: user.email ?? "",
      role: "viewer" as UserRole,
      avatar_url: null,
      created_at: new Date().toISOString(),
    },
  };
});

export function canEdit(role: UserRole) {
  return role === "admin" || role === "editor";
}

export function isAdmin(role: UserRole) {
  return role === "admin";
}

export async function requireEditor() {
  const session = await getSession();
  if (!canEdit(session.profile.role)) throw new Error("Keine Berechtigung");
  return session;
}

export async function requireAdmin() {
  const session = await getSession();
  if (!isAdmin(session.profile.role)) throw new Error("Nur für Admins");
  return session;
}
