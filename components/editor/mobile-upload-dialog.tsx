"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Check, Loader2, RefreshCw, Smartphone } from "lucide-react";
import { createMobileUploadSession, endMobileUploadSession } from "@/app/actions";
import { Button, Dialog } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Session = { id: string; expiresAt: number; qr: string; url: string };

/**
 * Zeigt einen QR-Code; das Handy lädt darüber Fotos in mobile/<sitzung>/ hoch.
 * Neue Fotos werden per Polling erkannt und direkt in den Eintrag eingefügt.
 */
export function MobileUploadDialog({
  entryId,
  onClose,
  onImage,
}: {
  entryId: string;
  onClose: () => void;
  onImage: (src: string) => void;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [received, setReceived] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const seen = useRef(new Set<string>());
  const onImageRef = useRef(onImage);
  onImageRef.current = onImage;

  const start = useCallback(async () => {
    setError(null);
    setSession(null);
    try {
      const s = await createMobileUploadSession(entryId);
      const url = `${window.location.origin}/upload/${s.id}`;
      const qr = await QRCode.toDataURL(url, {
        margin: 1,
        width: 260,
        color: { dark: "#1f1e1d", light: "#f5f4ef" },
      });
      setSession({ id: s.id, expiresAt: new Date(s.expires_at).getTime(), qr, url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "QR-Code konnte nicht erstellt werden");
    }
  }, [entryId]);

  useEffect(() => {
    void start();
  }, [start]);

  // Sitzung beim Schließen beenden
  const sessionId = session?.id;
  useEffect(() => {
    return () => {
      if (sessionId) void endMobileUploadSession(sessionId);
    };
  }, [sessionId]);

  // Neue Fotos abfragen
  useEffect(() => {
    if (!sessionId) return;
    const supabase = createClient();
    let stopped = false;
    const poll = async () => {
      const { data } = await supabase.storage
        .from("media")
        .list(`mobile/${sessionId}`, { sortBy: { column: "created_at", order: "asc" } });
      if (stopped || !data) return;
      for (const file of data) {
        if (!file.id || seen.current.has(file.name)) continue;
        seen.current.add(file.name);
        onImageRef.current(`/media/mobile/${sessionId}/${file.name}`);
        setReceived((r) => [...r, file.name]);
      }
    };
    const timer = setInterval(() => {
      setNow(Date.now());
      void poll();
    }, 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [sessionId]);

  const remaining = session ? Math.min(900, Math.max(0, Math.round((session.expiresAt - now) / 1000))) : 0;
  const expired = Boolean(session) && remaining === 0;

  return (
    <Dialog open title="Foto mit dem Handy aufnehmen" onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : !session ? (
          <Loader2 className="my-16 animate-spin text-faint" size={24} />
        ) : (
          <>
            <div className="relative rounded-2xl bg-[#f5f4ef] p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={session.qr} alt="QR-Code für den Handy-Upload" width={240} height={240} className={expired ? "opacity-15" : ""} />
              {expired && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Button variant="primary" onClick={() => void start()}>
                    <RefreshCw size={15} /> Neuen QR-Code
                  </Button>
                </div>
              )}
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-text-2">
              <Smartphone size={16} className="text-accent" />
              QR-Code mit der Handy-Kamera scannen
            </p>
            <p className="mt-1 text-[12.5px] text-faint">
              {expired
                ? "Der QR-Code ist abgelaufen."
                : `Gültig noch ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")} Min. · Mehrere Fotos möglich`}
            </p>
          </>
        )}

        <div className="mt-5 w-full rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm">
          {received.length === 0 ? (
            <span className="flex items-center gap-2 text-muted">
              <Loader2 size={14} className="animate-spin" /> Warte auf Fotos vom Handy …
            </span>
          ) : (
            <span className="flex items-center gap-2 text-success">
              <Check size={15} /> {received.length} {received.length === 1 ? "Foto" : "Fotos"} eingefügt
            </span>
          )}
        </div>

        <Button variant="secondary" className="mt-4 w-full" onClick={onClose}>
          Fertig
        </Button>
      </div>
    </Dialog>
  );
}
