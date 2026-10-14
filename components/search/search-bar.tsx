"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUp, CornerDownLeft, FileText, Loader2, Search, Sparkles, Square, User, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { SearchHit } from "@/lib/database.types";
import { TopicIcon } from "@/components/topic-icon";
import type { NavTopic } from "@/components/sidebar/sidebar";
import { cn } from "@/lib/utils";
import { Markdown, Snippet } from "./markdown";

type Mode = "text" | "ai";
type Source = { id: string; title: string; href: string; topic: string };
type AiState = {
  question: string;
  status: string | null;
  answer: string;
  sources: Source[];
  error: string | null;
  done: boolean;
};

const MODE_KEY = "lynn.search.mode";

function hitHref(hit: SearchHit) {
  if (hit.kind === "entry") return `/t/${hit.topic_slug}/${hit.id}`;
  if (hit.kind === "topic") return `/t/${hit.topic_slug}`;
  return `/personal?p=${hit.id}`;
}

export function SearchBar({ aiEnabled, topics }: { aiEnabled: boolean; topics: NavTopic[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [mode, setMode] = useState<Mode>("text");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [scoped, setScoped] = useState(true);
  const [ai, setAi] = useState<AiState | null>(null);

  const currentTopic = useMemo(() => {
    const slug = /^\/t\/([^/]+)/.exec(pathname)?.[1];
    return topics.find((t) => t.slug === slug) ?? null;
  }, [pathname, topics]);
  const topicFilter = scoped && currentTopic ? currentTopic : null;

  // Modus merken (nur Komfort, darf fehlschlagen)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(MODE_KEY);
      if (stored === "ai" && aiEnabled) setMode("ai");
    } catch {}
  }, [aiEnabled]);

  function changeMode(next: Mode) {
    if (next === "ai" && !aiEnabled) return;
    setMode(next);
    setOpen(Boolean(query.trim()) || (next === "ai" && ai !== null));
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {}
    inputRef.current?.focus();
  }

  // Tastenkürzel: Strg/Cmd+K oder "/" fokussiert die Suche
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Klick außerhalb schließt das Panel
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const el = e.target as Node;
      if (!panelRef.current?.contains(el) && !inputRef.current?.closest("form")?.contains(el)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => setOpen(false), [pathname]);

  // Volltextsuche (Debounce)
  useEffect(() => {
    if (mode !== "text") return;
    const q = query.trim();
    if (!q) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc("search_all", {
        q,
        topic_filter: topicFilter?.id,
        max_results: 30,
      });
      if (cancelled) return;
      setHits(data ?? []);
      setActive(0);
      setLoading(false);
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, mode, topicFilter?.id]);

  const grouped = useMemo(() => {
    const groups: { label: string; kind: string; items: SearchHit[] }[] = [
      { label: "Einträge", kind: "entry", items: [] },
      { label: "Themen", kind: "topic", items: [] },
      { label: "Personen", kind: "person", items: [] },
    ];
    for (const hit of hits) groups.find((g) => g.kind === hit.kind)?.items.push(hit);
    return groups.filter((g) => g.items.length);
  }, [hits]);
  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  const askAi = useCallback(
    async (question: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setOpen(true);
      setAi({ question, status: "Durchsuche die Wissensbasis …", answer: "", sources: [], error: null, done: false });

      try {
        const res = await fetch("/api/ai-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, topicId: topicFilter?.id ?? null }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? "Die KI-Suche ist gerade nicht erreichbar.");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as
              | { type: "status"; text: string }
              | { type: "text"; text: string }
              | { type: "sources"; sources: Source[] }
              | { type: "error"; message: string }
              | { type: "done" };
            setAi((prev) => {
              if (!prev) return prev;
              switch (event.type) {
                case "status":
                  return { ...prev, status: event.text };
                case "text":
                  return { ...prev, status: null, answer: prev.answer + event.text };
                case "sources":
                  return { ...prev, sources: event.sources };
                case "error":
                  return { ...prev, status: null, error: event.message, done: true };
                case "done":
                  return { ...prev, status: null, done: true };
              }
            });
          }
        }
        setAi((prev) => (prev ? { ...prev, status: null, done: true } : prev));
      } catch (err) {
        if (controller.signal.aborted) {
          setAi((prev) => (prev ? { ...prev, status: null, done: true } : prev));
          return;
        }
        setAi((prev) =>
          prev ? { ...prev, status: null, done: true, error: err instanceof Error ? err.message : "Fehler" } : prev,
        );
      }
    },
    [topicFilter?.id],
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (mode === "ai") {
      if (q) askAi(q);
      return;
    }
    const hit = flat[active];
    if (hit) {
      setOpen(false);
      router.push(hitHref(hit));
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (mode !== "text" || !flat.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + flat.length) % flat.length);
    }
  }

  const showPanel = open && ((mode === "text" && query.trim()) || (mode === "ai" && ai));
  const aiBusy = Boolean(ai && !ai.done);

  return (
    <div className="pointer-events-none fixed bottom-0 left-[var(--sidebar-w)] right-0 z-40 px-6 pb-5 pt-8 max-sm:px-3 max-sm:pb-3 [background:linear-gradient(to_top,var(--bg)_55%,transparent)]">
      <div className="pointer-events-auto relative mx-auto max-w-[760px]">
        {showPanel && (
          <div
            ref={panelRef}
            className="absolute bottom-full left-0 right-0 mb-2 max-h-[min(62dvh,720px)] animate-fade-up overflow-y-auto rounded-2xl border border-border bg-surface-2 shadow-[0_-12px_40px_rgba(0,0,0,0.45)]"
          >
            {mode === "text" ? (
              <TextResults
                grouped={grouped}
                flat={flat}
                active={active}
                loading={loading}
                query={query}
                onPick={() => setOpen(false)}
                onHover={setActive}
                aiEnabled={aiEnabled}
                onAskAi={() => {
                  changeMode("ai");
                  askAi(query.trim());
                }}
              />
            ) : (
              ai && <AiPanel ai={ai} onClose={() => setOpen(false)} />
            )}
          </div>
        )}

        <form
          onSubmit={onSubmit}
          className={cn(
            "flex items-center gap-2 rounded-2xl border bg-surface-2 py-2 pl-4 pr-2 shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition-colors",
            mode === "ai" ? "border-accent/50" : "border-border focus-within:border-border-strong",
          )}
        >
          {mode === "ai" ? (
            <Sparkles size={18} className="shrink-0 text-accent" />
          ) : (
            <Search size={18} className="shrink-0 text-muted" />
          )}

          {topicFilter && (
            <button
              type="button"
              onClick={() => setScoped(false)}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 text-[12px] text-text-2 hover:border-border-strong"
              title="Nur in diesem Thema suchen – klicken zum Entfernen"
            >
              <TopicIcon name={topicFilter.icon} color={topicFilter.color} size={12} />
              <span className="max-w-32 truncate">{topicFilter.name}</span>
              <X size={12} className="text-faint" />
            </button>
          )}
          {!scoped && currentTopic && (
            <button
              type="button"
              onClick={() => setScoped(true)}
              className="shrink-0 rounded-lg px-1.5 py-1 text-[12px] text-faint hover:text-text-2"
              title={`Nur in „${currentTopic.name}“ suchen`}
            >
              + Thema
            </button>
          )}

          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (mode === "text") setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={
              mode === "ai"
                ? "Frag Lynn – z. B. „Was passiert bei einer Stop-Limit-Order?“"
                : "Suchen in Themen, Einträgen und Personal …"
            }
            className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-text placeholder:text-faint focus:outline-none"
            aria-label="Suche"
          />

          {mode === "text" && !query && (
            <kbd className="hidden shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-faint sm:block">
              Strg K
            </kbd>
          )}

          <AiToggle mode={mode} enabled={aiEnabled} onChange={changeMode} />

          {mode === "ai" &&
            (aiBusy ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-3 text-text"
                aria-label="Antwort abbrechen"
              >
                <Square size={13} fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!query.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-[#1f1e1d] transition hover:bg-accent-hover disabled:bg-surface-3 disabled:text-faint"
                aria-label="Frage senden"
              >
                <ArrowUp size={17} />
              </button>
            ))}
        </form>
      </div>
    </div>
  );
}

function AiToggle({ mode, enabled, onChange }: { mode: Mode; enabled: boolean; onChange: (m: Mode) => void }) {
  const on = mode === "ai";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={!enabled}
      onClick={() => onChange(on ? "text" : "ai")}
      title={enabled ? (on ? "KI-Suche ausschalten" : "KI-Suche einschalten") : "Kein API-Key hinterlegt – KI-Suche nicht verfügbar"}
      className={cn(
        "flex h-9 shrink-0 items-center gap-2 rounded-xl border px-2.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        on ? "border-accent/40 bg-accent-soft text-accent" : "border-border text-muted hover:text-text",
      )}
    >
      <span
        className={cn(
          "relative h-4 w-7 rounded-full transition-colors",
          on ? "bg-accent" : "bg-surface-3",
        )}
        aria-hidden
      >
        <span
          className={cn(
            "absolute top-0.5 h-3 w-3 rounded-full bg-text transition-all",
            on ? "left-[14px] bg-[#1f1e1d]" : "left-0.5",
          )}
        />
      </span>
      KI
    </button>
  );
}

function TextResults({
  grouped,
  flat,
  active,
  loading,
  query,
  onPick,
  onHover,
  aiEnabled,
  onAskAi,
}: {
  grouped: { label: string; kind: string; items: SearchHit[] }[];
  flat: SearchHit[];
  active: number;
  loading: boolean;
  query: string;
  onPick: () => void;
  onHover: (i: number) => void;
  aiEnabled: boolean;
  onAskAi: () => void;
}) {
  if (!flat.length) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-8 text-center text-sm text-muted">
        {loading ? (
          <Loader2 className="animate-spin text-faint" size={18} />
        ) : (
          <>
            <span>Keine Treffer für „{query.trim()}“.</span>
            {aiEnabled && (
              <button
                onClick={onAskAi}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-text-2 hover:border-accent/50 hover:text-accent"
              >
                <Sparkles size={14} /> Lynn KI fragen
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="p-2">
      {grouped.map((group) => (
        <div key={group.kind} className="mb-1 last:mb-0">
          <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
            {group.label}
          </div>
          {group.items.map((hit) => {
            const index = flat.indexOf(hit);
            return (
              <Link
                key={`${hit.kind}-${hit.id}`}
                href={hitHref(hit)}
                onClick={onPick}
                onMouseEnter={() => onHover(index)}
                className={cn(
                  "flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors",
                  index === active ? "bg-surface-3" : "hover:bg-surface-3/60",
                )}
              >
                <span className="mt-0.5 shrink-0 text-muted">
                  {hit.kind === "entry" && <FileText size={16} />}
                  {hit.kind === "topic" && <TopicIcon name="folder" color={hit.topic_color} size={16} />}
                  {hit.kind === "person" && <User size={16} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-medium text-text">{hit.title || "Unbenannt"}</span>
                    {hit.kind === "entry" && hit.topic_name && (
                      <span className="flex shrink-0 items-center gap-1 text-[12px] text-faint">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: hit.topic_color }} />
                        {hit.topic_name}
                      </span>
                    )}
                  </span>
                  {hit.snippet && (
                    <span className="mt-0.5 line-clamp-2 block text-[13px] leading-relaxed text-muted">
                      <Snippet text={hit.snippet} />
                    </span>
                  )}
                </span>
                {index === active && <CornerDownLeft size={14} className="mt-1 shrink-0 text-faint" />}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function AiPanel({ ai, onClose }: { ai: AiState; onClose: () => void }) {
  return (
    <div className="p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <p className="text-[13px] text-muted">
          <span className="text-faint">Frage:</span> {ai.question}
        </p>
        <button onClick={onClose} className="rounded-md p-1 text-faint hover:text-text" aria-label="Schließen">
          <X size={15} />
        </button>
      </div>

      {ai.status && (
        <div className="flex items-center gap-2 text-[13px] text-muted">
          <span className="flex gap-1">
            <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-accent [animation-delay:150ms]" />
            <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-accent [animation-delay:300ms]" />
          </span>
          {ai.status}
        </div>
      )}

      {ai.answer && <Markdown text={ai.answer} />}
      {ai.error && <p className="mt-2 text-sm text-danger">{ai.error}</p>}

      {ai.sources.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">Quellen</div>
          <div className="flex flex-wrap gap-2">
            {ai.sources.map((s) => (
              <Link
                key={s.id}
                href={s.href}
                onClick={onClose}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12.5px] text-text-2 transition hover:border-accent/50 hover:text-text"
              >
                <FileText size={13} className="text-faint" />
                <span className="max-w-56 truncate">{s.title}</span>
                <span className="text-faint">· {s.topic}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-[11.5px] text-faint">
        KI-Antworten basieren auf den Inhalten in Lynn und können Fehler enthalten. Quellen prüfen.
      </p>
    </div>
  );
}
