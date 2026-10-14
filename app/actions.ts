"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Json, UserRole } from "@/lib/database.types";
import { parseRosterWorkbook, type ImportedWeek } from "@/lib/roster-import";
import { createClient } from "@/lib/supabase/server";
import { getSession, requireAdmin, requireEditor } from "@/lib/session";
import { slugify } from "@/lib/utils";

function fail(message: string): never {
  throw new Error(message);
}

// ---------------------------------------------------------------------------
// Themen
// ---------------------------------------------------------------------------

export async function createTopic(input: { name: string; icon: string; color: string }) {
  const { supabase } = await requireEditor();
  const name = input.name.trim();
  if (!name) fail("Name fehlt");

  const base = slugify(name);
  const { data: existing } = await supabase.from("topics").select("slug").like("slug", `${base}%`);
  const taken = new Set((existing ?? []).map((t) => t.slug));
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;

  const { data: last } = await supabase
    .from("topics")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("topics").insert({
    name,
    slug,
    icon: input.icon,
    color: input.color,
    sort_order: (last?.sort_order ?? -1) + 1,
  });
  if (error) fail(error.message);

  revalidatePath("/", "layout");
  return slug;
}

export async function updateTopic(
  id: string,
  patch: { name?: string; icon?: string; color?: string; description?: string },
) {
  const { supabase } = await requireEditor();
  const clean = { ...patch };
  if (clean.name !== undefined) {
    clean.name = clean.name.trim();
    if (!clean.name) fail("Name fehlt");
  }
  const { error } = await supabase.from("topics").update(clean).eq("id", id);
  if (error) fail(error.message);
  revalidatePath("/", "layout");
}

export async function reorderTopics(ids: string[]) {
  const { supabase } = await requireEditor();
  await Promise.all(
    ids.map((id, index) => supabase.from("topics").update({ sort_order: index }).eq("id", id)),
  );
  revalidatePath("/", "layout");
}

export async function setTopicArchived(id: string, archived: boolean) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("topics").update({ archived }).eq("id", id);
  if (error) fail(error.message);
  revalidatePath("/", "layout");
}

export async function deleteTopic(id: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("topics").delete().eq("id", id);
  if (error) fail(error.message);
  revalidatePath("/", "layout");
  redirect("/");
}

// ---------------------------------------------------------------------------
// Einträge
// ---------------------------------------------------------------------------

export async function createEntry(topicId: string, topicSlug: string) {
  const { supabase } = await requireEditor();
  const { data, error } = await supabase
    .from("entries")
    .insert({ topic_id: topicId, title: "" })
    .select("id")
    .single();
  if (error || !data) fail(error?.message ?? "Eintrag konnte nicht angelegt werden");
  revalidatePath(`/t/${topicSlug}`);
  redirect(`/t/${topicSlug}/${data.id}?neu=1`);
}

export async function saveEntry(
  id: string,
  patch: { title?: string; content_json?: Json; content_text?: string },
) {
  const { supabase } = await requireEditor();
  const { data, error } = await supabase
    .from("entries")
    .update(patch)
    .eq("id", id)
    .select("updated_at")
    .single();
  if (error) fail(error.message);
  return data.updated_at;
}

export async function setEntryPinned(id: string, pinned: boolean, path: string) {
  const { supabase } = await requireEditor();
  const { error } = await supabase.from("entries").update({ pinned }).eq("id", id);
  if (error) fail(error.message);
  revalidatePath(path);
  revalidatePath("/");
}

export async function moveEntry(id: string, topicId: string) {
  const { supabase } = await requireEditor();
  const { data: topic } = await supabase.from("topics").select("slug").eq("id", topicId).single();
  if (!topic) fail("Thema nicht gefunden");
  const { error } = await supabase.from("entries").update({ topic_id: topicId }).eq("id", id);
  if (error) fail(error.message);
  revalidatePath("/", "layout");
  redirect(`/t/${topic.slug}/${id}`);
}

export async function deleteEntry(id: string, topicSlug: string) {
  const { supabase } = await requireEditor();
  const { error } = await supabase.from("entries").delete().eq("id", id);
  if (error) fail(error.message);
  revalidatePath(`/t/${topicSlug}`);
  revalidatePath("/");
  redirect(`/t/${topicSlug}`);
}

export async function restoreVersion(entryId: string, versionId: string, path: string) {
  const { supabase } = await requireEditor();
  const { data: version } = await supabase
    .from("entry_versions")
    .select("title, content_json")
    .eq("id", versionId)
    .eq("entry_id", entryId)
    .single();
  if (!version) fail("Version nicht gefunden");
  const { error } = await supabase
    .from("entries")
    .update({
      title: version.title,
      content_json: version.content_json,
      content_text: extractText(version.content_json),
    })
    .eq("id", entryId);
  if (error) fail(error.message);
  revalidatePath(path);
}

function extractText(node: Json): string {
  if (!node || typeof node !== "object" || Array.isArray(node)) return "";
  const parts: string[] = [];
  if (typeof node.text === "string") parts.push(node.text);
  if (Array.isArray(node.content)) {
    for (const child of node.content) parts.push(extractText(child));
  }
  return parts.join(node.type === "doc" ? "\n" : " ").replace(/\s+\n/g, "\n").trim();
}

export async function saveIsinItems(entryId: string, items: { isin: string; addedAt: string }[]) {
  const { supabase } = await requireEditor();
  const clean = items
    .filter((i) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(i.isin))
    .map((i) => ({ isin: i.isin, addedAt: i.addedAt }));
  const { error } = await supabase
    .from("entries")
    .update({ isin_items: clean })
    .eq("id", entryId)
    .eq("kind", "isin_filter");
  if (error) fail(error.message);
}

// ---------------------------------------------------------------------------
// Foto per Handy (QR-Code)
// ---------------------------------------------------------------------------

export async function createMobileUploadSession(entryId: string) {
  const { supabase } = await requireEditor();
  const { data, error } = await supabase
    .from("mobile_upload_sessions")
    .insert({ entry_id: entryId })
    .select("id, expires_at")
    .single();
  if (error || !data) fail(error?.message ?? "Sitzung konnte nicht erstellt werden");
  return data;
}

export async function endMobileUploadSession(id: string) {
  const { supabase } = await getSession();
  await supabase.from("mobile_upload_sessions").update({ expires_at: new Date().toISOString() }).eq("id", id);
}

// ---------------------------------------------------------------------------
// Favoriten
// ---------------------------------------------------------------------------

export async function toggleFavorite(entryId: string, favorite: boolean) {
  const { supabase, user } = await getSession();
  if (favorite) {
    await supabase.from("favorites").upsert({ entry_id: entryId, user_id: user.id });
  } else {
    await supabase.from("favorites").delete().eq("entry_id", entryId).eq("user_id", user.id);
  }
  revalidatePath("/favoriten");
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// Personal & Ansprechpartner
// ---------------------------------------------------------------------------

export type PersonInput = {
  name: string;
  position: string;
  department: string;
  email: string;
  phone: string;
  teams_url: string;
  bio: string;
  tags: string[];
  avatar_url: string | null;
  topics: { topic_id: string; label: string }[];
};

export async function savePerson(id: string | null, input: PersonInput) {
  const { supabase } = await requireEditor();
  const { topics, ...fields } = input;
  fields.name = fields.name.trim();
  if (!fields.name) fail("Name fehlt");
  fields.tags = [...new Set(fields.tags.map((t) => t.trim()).filter(Boolean))];
  if (fields.teams_url && !/^https?:\/\//i.test(fields.teams_url)) fields.teams_url = "";

  let personId = id;
  if (personId) {
    const { error } = await supabase.from("people").update(fields).eq("id", personId);
    if (error) fail(error.message);
  } else {
    const { data, error } = await supabase.from("people").insert(fields).select("id").single();
    if (error || !data) fail(error?.message ?? "Speichern fehlgeschlagen");
    personId = data.id;
  }

  await supabase.from("topic_contacts").delete().eq("person_id", personId);
  if (topics.length) {
    const { error } = await supabase
      .from("topic_contacts")
      .insert(topics.map((t) => ({ person_id: personId!, topic_id: t.topic_id, label: t.label || "Ansprechpartner" })));
    if (error) fail(error.message);
  }

  revalidatePath("/", "layout");
}

export async function deletePerson(id: string) {
  const { supabase } = await requireEditor();
  const { error } = await supabase.from("people").delete().eq("id", id);
  if (error) fail(error.message);
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Profil & Nutzerverwaltung
// ---------------------------------------------------------------------------

export async function updateOwnName(fullName: string) {
  const { supabase, user } = await getSession();
  const name = fullName.trim();
  if (!name) fail("Name fehlt");
  const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", user.id);
  if (error) fail(error.message);
  revalidatePath("/", "layout");
}

export async function setUserRole(userId: string, role: UserRole) {
  const { supabase, user } = await requireAdmin();
  if (userId === user.id && role !== "admin") fail("Du kannst dir die Admin-Rolle nicht selbst entziehen");
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) fail(error.message);
  revalidatePath("/einstellungen");
}

// ---------------------------------------------------------------------------
// Dienstplan
// ---------------------------------------------------------------------------

export type SwapResult =
  | { ok: true; version: number }
  | { ok: false; kind: "auth" | "conflict" | "other"; message: string };

/** Fehler werden als Ergebnis zurückgegeben (nicht geworfen), damit die Ursache beim Nutzer ankommt. */
export async function swapShifts(input: {
  weekId: string;
  dayA: number;
  personA: string;
  dayB: number;
  personB: string;
  note: string;
  version: number;
}): Promise<SwapResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, kind: "auth", message: "Nicht angemeldet oder noch nicht freigegeben – bitte Admin fragen." };
  }
  const { data, error } = await supabase.rpc("roster_swap", {
    week_a: input.weekId,
    day_a: input.dayA,
    person_a: input.personA,
    week_b: input.weekId,
    day_b: input.dayB,
    person_b: input.personB,
    note: input.note,
    expected_version: input.version,
  });
  if (error) {
    if (error.message.includes("version_conflict")) {
      return {
        ok: false,
        kind: "conflict",
        message: "Jemand anderes hat gerade gespeichert – bitte Seite neu laden und erneut versuchen.",
      };
    }
    if (error.message.includes("not_authenticated")) {
      return { ok: false, kind: "auth", message: "Nicht angemeldet oder noch nicht freigegeben – bitte Admin fragen." };
    }
    if (error.message.includes("not_tradeable")) {
      return { ok: false, kind: "other", message: "Dieser Tausch ist mit dem aktuellen Plan nicht mehr möglich (not_tradeable)." };
    }
    return { ok: false, kind: "other", message: error.message };
  }
  revalidatePath("/personal");
  return { ok: true, version: data as number };
}

export async function parseRosterFile(formData: FormData) {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false as const, message: "Keine Datei ausgewählt." };
  try {
    const result = await parseRosterWorkbook(await file.arrayBuffer());
    return { ok: true as const, ...result };
  } catch (err) {
    return { ok: false as const, message: err instanceof Error ? err.message : "Datei konnte nicht gelesen werden." };
  }
}

export async function applyRosterImport(weeks: ImportedWeek[], names: string[]) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("roster_import", { weeks: weeks as unknown as Json, names });
  if (error) return { ok: false as const, message: error.message };
  revalidatePath("/personal");
  return { ok: true as const };
}

export async function setHaShift(input: { weekId: string; person: string; day: number; value: string | null }) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("roster_set_ha", {
    week: input.weekId,
    person: input.person,
    day: input.day,
    value: input.value ?? "",
  });
  if (!error) {
    revalidatePath("/personal");
    return { ok: true as const };
  }
  const messages: Record<string, string> = {
    not_authenticated: "Nicht angemeldet – bitte neu einloggen.",
    invalid_time: "Ungültige Zeit – „bis“ muss nach „von“ liegen.",
    invalid_person: "Diese Person gehört nicht zur Handelsassistenz.",
  };
  const key = Object.keys(messages).find((k) => error.message.includes(k));
  return { ok: false as const, message: key ? messages[key]! : error.message };
}
