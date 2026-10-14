"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, ClipboardCopy, Loader2, Mail, MessageCircle, RefreshCw } from "lucide-react";
import { swapShifts } from "@/app/actions";
import { Button, Dialog, Input, Label, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import {
  type Candidate,
  DAYS_LONG,
  DAYS_SHORT,
  findCrossDayCandidates,
  findSameDayCandidates,
  groupMessage,
  parseTimeInput,
  previewSwap,
  requestText,
  type RosterSwap,
  type RosterWeek,
} from "@/lib/roster";
import { cn } from "@/lib/utils";
import { ShiftChip } from "./shift-chip";

type Step = "pick" | "ask" | "confirm" | "done";

export function SwapSheet({
  week,
  day,
  me,
  version,
  onClose,
  onSaved,
}: {
  week: RosterWeek;
  day: number;
  me: string;
  version: number;
  onClose: () => void;
  onSaved: (version: number) => void;
}) {
  const toast = useToast();
  const [step, setStep] = useState<Step>("pick");
  const [earliest, setEarliest] = useState("");
  const [choice, setChoice] = useState<Candidate | null>(null);
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<{ kind: string; message: string } | null>(null);
  const [saved, setSaved] = useState<RosterSwap[] | null>(null);
  const [pending, startTransition] = useTransition();

  const myShift = week.shifts[me]?.[day] ?? null;
  const earliestMin = parseTimeInput(earliest);
  const sameDay = useMemo(() => findSameDayCandidates(week, day, me, earliestMin), [week, day, me, earliestMin]);
  const crossDay = useMemo(() => findCrossDayCandidates(week, day, me, earliestMin), [week, day, me, earliestMin]);
  const preview = choice ? previewSwap(week, me, day, choice) : [];

  function pick(c: Candidate) {
    setChoice(c);
    setMessage(requestText(week, me, day, c));
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    toast("In die Zwischenablage kopiert");
  }

  function save() {
    if (!choice) return;
    setError(null);
    startTransition(async () => {
      const result = await swapShifts({
        weekId: week.id,
        dayA: day,
        personA: me,
        dayB: choice.day,
        personB: choice.person,
        note,
        version,
      });
      if (!result.ok) {
        setError({ kind: result.kind, message: result.message });
        toast(result.message, "error");
        return;
      }
      setSaved(preview);
      setStep("done");
      onSaved(result.version);
      toast("Tausch gespeichert");
    });
  }

  const titles: Record<Step, string> = {
    pick: "Tausch anfragen",
    ask: `Anfrage an ${choice?.person ?? ""}`,
    confirm: "Tausch eintragen",
    done: "Gespeichert – Gruppe informieren",
  };

  return (
    <Dialog open sheet wide title={titles[step]} onClose={onClose}>
      {step === "pick" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3">
            <div className="text-sm">
              <div className="font-medium text-text">{me}</div>
              <div className="text-[12.5px] text-muted">
                {DAYS_LONG[day]}, {week.dates[day]}
              </div>
            </div>
            <ShiftChip value={myShift} />
          </div>

          <div>
            <Label htmlFor="earliest">Frühester möglicher Beginn (optional)</Label>
            <Input
              id="earliest"
              type="time"
              value={earliest}
              onChange={(e) => setEarliest(e.target.value)}
              className="max-w-40"
            />
          </div>

          <CandidateList
            title="Gleicher Tag"
            empty="Niemand mit tauschbarem Dienst an diesem Tag."
            items={sameDay}
            week={week}
            selected={choice}
            onPick={pick}
          />
          <CandidateList
            title="Anderer Tag in der Woche"
            empty="Kein passender Tausch über andere Tage dieser Woche."
            items={crossDay}
            week={week}
            selected={choice}
            onPick={pick}
          />

          <div className="flex justify-end pt-1">
            <Button variant="primary" disabled={!choice} onClick={() => setStep("ask")}>
              Weiter <ArrowRight size={15} />
            </Button>
          </div>
        </div>
      )}

      {step === "ask" && choice && (
        <div className="space-y-4">
          <SwapSummary swaps={preview} />
          <div>
            <Label htmlFor="msg">Nachricht an {choice.person}</Label>
            <Textarea id="msg" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void copy(message)}>
              <ClipboardCopy size={14} /> Kopieren
            </Button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-border bg-surface-2 px-3.5 text-sm font-medium text-text-2 hover:bg-surface-3 hover:text-text"
            >
              <MessageCircle size={14} /> WhatsApp
            </a>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={() => setStep("pick")}>
              <ArrowLeft size={15} /> Zurück
            </Button>
            <Button variant="primary" onClick={() => setStep("confirm")}>
              <Check size={15} /> {choice.person.split(" ")[0]} hat zugesagt – eintragen
            </Button>
          </div>
        </div>
      )}

      {step === "confirm" && choice && (
        <div className="space-y-4">
          <SwapSummary swaps={preview} />
          <div>
            <Label htmlFor="note">Grund (optional)</Label>
            <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Arzttermin" />
          </div>
          {error && (
            <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error.message}
              {error.kind === "conflict" && (
                <button onClick={() => window.location.reload()} className="mt-2 flex items-center gap-1.5 underline">
                  <RefreshCw size={13} /> Seite neu laden
                </button>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={() => setStep("ask")} disabled={pending}>
              <ArrowLeft size={15} /> Zurück
            </Button>
            <Button variant="primary" onClick={save} disabled={pending}>
              {pending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Tausch speichern
            </Button>
          </div>
        </div>
      )}

      {step === "done" && saved && <GroupMessage swaps={saved} note={note} onCopy={copy} onClose={onClose} />}
    </Dialog>
  );
}

function CandidateList({
  title,
  empty,
  items,
  week,
  selected,
  onPick,
}: {
  title: string;
  empty: string;
  items: Candidate[];
  week: RosterWeek;
  selected: Candidate | null;
  onPick: (c: Candidate) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-faint">{title}</div>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((c) => {
            const active = selected?.person === c.person && selected.day === c.day;
            return (
              <li key={`${c.person}-${c.day}`}>
                <button
                  onClick={() => onPick(c)}
                  aria-pressed={active}
                  className={cn(
                    "flex min-h-12 w-full items-center gap-3 rounded-xl border px-3.5 py-2 text-left transition-colors",
                    active ? "border-accent bg-accent-soft" : "border-border bg-surface hover:border-border-strong",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text">{c.person}</span>
                    {!c.sameDay && (
                      <span className="block text-[12px] text-muted">
                        du übernimmst {DAYS_SHORT[c.day]} {week.dates[c.day]!.slice(0, 6)}
                      </span>
                    )}
                  </span>
                  <ShiftChip value={c.theirShift} />
                  {active && <Check size={16} className="shrink-0 text-accent" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SwapSummary({ swaps }: { swaps: RosterSwap[] }) {
  return (
    <div className="space-y-2">
      {swaps.map((s) => (
        <div key={s.day} className="rounded-xl border border-border bg-surface px-4 py-3">
          <div className="mb-2 text-[12.5px] font-medium text-muted">
            {DAYS_LONG[s.day]}, {s.dateLabel}
          </div>
          <SwapLine person={s.personA} from={s.oldA} to={s.newA} />
          <SwapLine person={s.personB} from={s.oldB} to={s.newB} />
        </div>
      ))}
    </div>
  );
}

export function SwapLine({ person, from, to }: { person: string; from: string | null; to: string | null }) {
  if (!person) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 py-0.5 text-sm">
      <span className="w-24 shrink-0 truncate text-text-2">{person}</span>
      <ShiftChip value={from} muted />
      <ArrowRight size={13} className="text-faint" />
      <ShiftChip value={to} />
    </div>
  );
}

function GroupMessage({
  swaps,
  note,
  onCopy,
  onClose,
}: {
  swaps: RosterSwap[];
  note: string;
  onCopy: (t: string) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState(() => groupMessage(swaps, note));
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Der Plan ist aktualisiert. Informiere die Gruppe:</p>
      <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-[13px]" />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void onCopy(text)}>
          <ClipboardCopy size={14} /> Kopieren
        </Button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-border bg-surface-2 px-3.5 text-sm font-medium text-text-2 hover:bg-surface-3 hover:text-text"
        >
          <MessageCircle size={14} /> WhatsApp-Gruppe
        </a>
        <a
          href={`mailto:?subject=${encodeURIComponent("Dienstplan-Änderung")}&body=${encodeURIComponent(text)}`}
          className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-border bg-surface-2 px-3.5 text-sm font-medium text-text-2 hover:bg-surface-3 hover:text-text"
        >
          <Mail size={14} /> E-Mail
        </a>
      </div>
      <div className="flex justify-end border-t border-border pt-4">
        <Button variant="primary" onClick={onClose}>
          Fertig
        </Button>
      </div>
    </div>
  );
}

