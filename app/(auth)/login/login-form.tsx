"use client";

import { useState } from "react";
import { ArrowRight, Loader2, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Mode = "password" | "link";

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-4 py-3 text-text placeholder:text-faint focus:border-accent focus:outline-none";

export function LoginForm({ initialError }: { initialError: string | null }) {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(initialError);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    const supabase = createClient();

    if (mode === "password") {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setError(error.message === "Invalid login credentials" ? "E-Mail oder Passwort ist falsch." : error.message);
        setState("idle");
        return;
      }
      window.location.href = "/";
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setState("idle");
    } else {
      setState("sent");
    }
  }

  if (state === "sent") {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center">
        <MailCheck className="mx-auto mb-3 text-accent" size={28} />
        <p className="font-medium">Prüfe dein Postfach</p>
        <p className="mt-1 text-sm text-muted">
          Wir haben einen Anmeldelink an <span className="text-text-2">{email}</span> geschickt.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface p-1 text-sm">
        {(["password", "link"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={cn(
              "rounded-lg py-1.5 transition-colors",
              mode === m ? "bg-surface-3 text-text" : "text-muted hover:text-text",
            )}
          >
            {m === "password" ? "Passwort" : "Anmeldelink"}
          </button>
        ))}
      </div>

      <label className="block text-sm text-muted" htmlFor="email">
        E-Mail-Adresse
      </label>
      <input
        id="email"
        type="email"
        required
        autoFocus
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="name@firma.de"
        className={inputClass}
      />

      {mode === "password" && (
        <>
          <label className="block pt-1 text-sm text-muted" htmlFor="password">
            Passwort
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </>
      )}

      <button
        type="submit"
        disabled={state === "sending"}
        className="!mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 font-medium text-[#1f1e1d] transition hover:bg-accent-hover disabled:opacity-60"
      >
        {state === "sending" ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
        {mode === "password" ? "Anmelden" : "Anmeldelink senden"}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}
