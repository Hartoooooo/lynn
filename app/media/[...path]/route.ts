import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const INLINE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const UUID_PREFIX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i;

// Liefert Dateien aus dem privaten Storage-Bucket nur an angemeldete Nutzer aus.
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (path.some((p) => p === ".." || p === ".")) {
    return NextResponse.json({ error: "Ungültiger Pfad" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("media").download(path.join("/"));
  if (error || !data) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const type = data.type || "application/octet-stream";
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Cache-Control": "private, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; img-src 'self'",
  };

  // Alles außer Bildern (z. B. Excel) als Download mit Originalnamen ausliefern.
  if (!INLINE_TYPES.includes(type)) {
    // Originalname aus ?name= (vom Editor gesetzt), sonst aus dem Speicherpfad ableiten.
    const requested = new URL(request.url).searchParams.get("name")?.replace(/[\\/\r\n]/g, "").slice(0, 200);
    const fileName = requested || decodeURIComponent(path.at(-1)!).replace(UUID_PREFIX, "");
    const ascii = fileName
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
      .replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue").replace(/ß/g, "ss")
      .replace(/[^\x20-\x7e]/g, "_")
      .replace(/"/g, "");
    headers["Content-Disposition"] = `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
  }

  return new NextResponse(data, { headers });
}
