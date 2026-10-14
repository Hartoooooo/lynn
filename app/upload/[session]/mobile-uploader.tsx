"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, ImageUp, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Item = { id: string; preview: string; state: "uploading" | "done" | "error"; message?: string };

const MAX_EDGE = 2560;

/** Verkleinert Handyfotos (oft 4000+ px) auf max. 2560 px und speichert als JPEG. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (blob) return blob;
  } catch {
    // Format nicht dekodierbar (z. B. HEIC außerhalb von Safari) – Original versuchen
  }
  return file;
}

export function MobileUploader({ session, expiresAt }: { session: string; expiresAt: string }) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const remaining = Math.max(0, Math.round((new Date(expiresAt).getTime() - now) / 1000));

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function upload(files: File[]) {
    const supabase = createClient();
    for (const file of files) {
      const id = crypto.randomUUID();
      const preview = URL.createObjectURL(file);
      setItems((list) => [{ id, preview, state: "uploading" }, ...list]);
      const update = (patch: Partial<Item>) =>
        setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));

      const blob = await shrink(file);
      const type = blob.type || file.type;
      if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(type)) {
        update({ state: "error", message: "Format nicht unterstützt – bitte als JPEG aufnehmen" });
        continue;
      }
      const ext = type === "image/jpeg" ? "jpg" : type.split("/")[1];
      const { error } = await supabase.storage
        .from("media")
        .upload(`mobile/${session}/${id}.${ext}`, blob, { contentType: type });
      update(error ? { state: "error", message: "Upload fehlgeschlagen – QR-Code evtl. abgelaufen" } : { state: "done" });
    }
  }

  const expired = remaining === 0;
  const done = items.filter((i) => i.state === "done").length;

  return (
    <div>
      <h1 className="font-serif text-[28px] font-medium leading-tight tracking-tight">Foto hochladen</h1>
      <p className="mt-2 text-muted">
        Fotos erscheinen automatisch im geöffneten Eintrag am PC.
        {!expired && (
          <span className="text-faint">
            {" "}
            Noch {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")} Min.
          </span>
        )}
      </p>

      {expired ? (
        <div className="mt-8 rounded-2xl border border-border bg-surface p-5 text-center text-sm text-muted">
          Der QR-Code ist abgelaufen. Erzeuge am PC einen neuen.
        </div>
      ) : (
        <div className="mt-8 grid gap-3">
          <button
            onClick={() => camera.current?.click()}
            className="flex h-16 items-center justify-center gap-3 rounded-2xl bg-accent text-[17px] font-medium text-[#1f1e1d] active:bg-accent-hover"
          >
            <Camera size={22} /> Foto aufnehmen
          </button>
          <button
            onClick={() => gallery.current?.click()}
            className="flex h-14 items-center justify-center gap-3 rounded-2xl border border-border bg-surface text-[16px] text-text-2 active:bg-surface-2"
          >
            <ImageUp size={20} /> Aus Galerie wählen
          </button>
        </div>
      )}

      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void upload(files);
        }}
      />
      <input
        ref={gallery}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void upload(files);
        }}
      />

      {items.length > 0 && (
        <div className="mt-8">
          <p className="mb-3 text-sm text-muted">
            {done} von {items.length} hochgeladen
          </p>
          <div className="grid grid-cols-3 gap-2">
            {items.map((item) => (
              <div key={item.id} className="relative aspect-square overflow-hidden rounded-xl border border-border bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.preview} alt="" className="h-full w-full object-cover" />
                <span className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60">
                  {item.state === "uploading" && <Loader2 size={14} className="animate-spin text-white" />}
                  {item.state === "done" && <Check size={14} className="text-success" />}
                  {item.state === "error" && <X size={14} className="text-danger" />}
                </span>
              </div>
            ))}
          </div>
          {items.some((i) => i.state === "error") && (
            <p className="mt-3 text-sm text-danger">{items.find((i) => i.state === "error")?.message}</p>
          )}
        </div>
      )}
    </div>
  );
}
