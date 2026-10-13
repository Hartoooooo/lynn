import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Liefert Bilder aus dem privaten Storage-Bucket nur an angemeldete Nutzer aus.
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (path.some((p) => p === ".." || p === ".")) {
    return NextResponse.json({ error: "Ungültiger Pfad" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("media").download(path.join("/"));
  if (error || !data) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  return new NextResponse(data, {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'",
    },
  });
}
