import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/server";
import { MobileUploader } from "./mobile-uploader";

export const metadata: Metadata = { title: "Foto hochladen", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MobileUploadPage({ params }: { params: Promise<{ session: string }> }) {
  const { session } = await params;
  let expiresAt: string | null = null;
  if (UUID.test(session)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("mobile_session_expires", { session });
    expiresAt = data ?? null;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10 pt-8">
      <div className="mb-8 flex items-center gap-2.5">
        <Logo size={28} />
        <span className="font-serif text-[20px] font-semibold tracking-tight">Lynn</span>
      </div>
      {expiresAt ? (
        <MobileUploader session={session} expiresAt={expiresAt} />
      ) : (
        <div className="mt-10 rounded-2xl border border-border bg-surface p-6 text-center">
          <Clock className="mx-auto mb-3 text-faint" size={28} />
          <p className="font-medium">Dieser QR-Code ist abgelaufen</p>
          <p className="mt-1 text-sm text-muted">Erzeuge am PC im Eintrag einen neuen QR-Code über „Foto mit Handy“.</p>
        </div>
      )}
    </main>
  );
}
