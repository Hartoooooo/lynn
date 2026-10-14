"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, History, Info, Upload } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import {
  currentWeekIndex,
  DAYS_SHORT,
  displayValue,
  isTradeable,
  SHIFT_STYLE,
  shiftKind,
  type RosterActivity,
  type RosterWeek,
} from "@/lib/roster";
import { cn, timeAgo } from "@/lib/utils";
import { ImportDialog } from "./import-dialog";
import { SwapLine, SwapSheet } from "./swap-sheet";

const WHO_KEY = "lynn.roster.who";

function todayLabel() {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }).format(
    new Date(),
  );
}

export function RosterView({
  weeks,
  names,
  activity,
  version: initialVersion,
  isAdmin,
}: {
  weeks: RosterWeek[];
  names: string[];
  activity: RosterActivity[];
  version: number;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [idx, setIdx] = useState(() => currentWeekIndex(weeks));
  const [who, setWho] = useState<string>("");
  const [version, setVersion] = useState(initialVersion);
  const [sheet, setSheet] = useState<{ day: number } | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => setVersion(initialVersion), [initialVersion]);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(WHO_KEY);
      if (stored && names.includes(stored)) setWho(stored);
    } catch {}
  }, [names]);

  function chooseWho(name: string) {
    setWho(name);
    try {
      if (name) localStorage.setItem(WHO_KEY, name);
      else localStorage.removeItem(WHO_KEY);
    } catch {}
  }

  const week = weeks[idx];
  const today = todayLabel();
  const rows = useMemo(() => {
    if (!week) return [];
    const ordered = names.filter((n) => n in week.shifts);
    return [...ordered, ...Object.keys(week.shifts).filter((n) => !ordered.includes(n))];
  }, [week, names]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[30px] font-medium tracking-tight">Dienstplan</h1>
          <p className="mt-1 text-muted">Eigene Schicht antippen, um sie zu tauschen.</p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="who" className="text-sm text-muted">
            Ich bin
          </label>
          <select
            id="who"
            value={who}
            onChange={(e) => chooseWho(e.target.value)}
            className="h-9 rounded-[10px] border border-border bg-surface px-3 text-sm text-text focus:border-accent focus:outline-none"
          >
            <option value="">– auswählen –</option>
            {names.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {isAdmin && (
            <Button variant="ghost" size="icon" onClick={() => setImportOpen(true)} title="Dienstplan importieren (Excel)" aria-label="Dienstplan importieren">
              <Upload size={16} />
            </Button>
          )}
        </div>
      </div>

      {!week ? (
        <div className="mt-8">
          <EmptyState icon={<CalendarDays size={28} />} title="Noch kein Dienstplan">
            {isAdmin ? "Importiere oben über das Upload-Symbol eine Excel-Datei." : "Ein Admin muss zuerst einen Plan importieren."}
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-7 flex items-center gap-2">
            <Button variant="secondary" size="icon" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} aria-label="Vorherige Woche">
              <ChevronLeft size={17} />
            </Button>
            <div className="min-w-0 flex-1 text-center">
              <div className="font-medium text-text">KW {isoWeek(week.start_date)} · {week.range}</div>
              <div className="text-[12.5px] text-faint">
                {week.dates[0]} – {week.dates[4]}
              </div>
            </div>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setIdx((i) => Math.min(weeks.length - 1, i + 1))}
              disabled={idx === weeks.length - 1}
              aria-label="Nächste Woche"
            >
              <ChevronRight size={17} />
            </Button>
          </div>

          {week.hint && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-2">
              <Info size={16} className="mt-0.5 shrink-0 text-accent" />
              {week.hint}
            </div>
          )}

          {!who && (
            <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted">
              Wähle oben bei „Ich bin“ deinen Namen, damit du deine Schichten tauschen kannst.
            </p>
          )}

          <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="bg-surface">
                  <th className="sticky left-0 z-10 bg-surface px-3 py-2.5 text-left text-[12px] font-medium text-faint">Name</th>
                  {DAYS_SHORT.map((d, i) => {
                    const isToday = week.dates[i] === today;
                    return (
                      <th key={d} className={cn("px-1.5 py-2.5 text-center text-[12px] font-medium", isToday ? "text-accent" : "text-faint")}>
                        <div>{d}</div>
                        <div className="font-normal">{week.dates[i]?.slice(0, 6)}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((name) => {
                  const mine = name === who;
                  return (
                    <tr key={name} className={cn("border-t border-border", mine && "bg-accent-soft/40")}>
                      <th
                        scope="row"
                        className={cn(
                          "sticky left-0 z-10 whitespace-nowrap px-3 py-1.5 text-left text-[13px] font-medium",
                          mine ? "bg-[#2e2724] text-text" : "bg-bg text-text-2",
                        )}
                      >
                        {name}
                      </th>
                      {[0, 1, 2, 3, 4].map((day) => {
                        const value = week.shifts[name]?.[day] ?? null;
                        const style = SHIFT_STYLE[shiftKind(value)];
                        const clickable = mine && isTradeable(value);
                        const content = (
                          <span
                            className="flex h-9 w-full items-center justify-center whitespace-nowrap rounded-lg px-1.5 font-mono text-[12.5px] tabular-nums max-sm:text-[11.5px]"
                            style={{ color: style.color, background: style.bg }}
                          >
                            {displayValue(value)}
                          </span>
                        );
                        return (
                          <td key={day} className={cn("p-1", week.dates[day] === today && "bg-surface/60")}>
                            {clickable ? (
                              <button
                                onClick={() => setSheet({ day })}
                                className="block w-full rounded-lg ring-1 ring-accent/60 transition hover:ring-2 hover:ring-accent focus-visible:ring-2"
                                aria-label={`${name}, ${DAYS_SHORT[day]} ${displayValue(value)} tauschen`}
                              >
                                {content}
                              </button>
                            ) : (
                              content
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </>
      )}

      <section className="mt-10">
        <h2 className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-faint">
          <History size={13} /> Letzter Tausch
        </h2>
        {activity.length === 0 ? (
          <p className="text-sm text-muted">Noch keine Tausche.</p>
        ) : (
          <ul className="space-y-2">
            {activity.slice(0, 1).map((a) => (
              <li key={a.id} className="rounded-xl border border-border bg-surface px-4 py-3">
                <div className="mb-1.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-faint">
                  <span>{timeAgo(a.created_at)}</span>
                  {a.author?.full_name && <span>· eingetragen von {a.author.full_name}</span>}
                </div>
                {a.swaps.map((s, i) => (
                  <div key={i} className="mb-1 last:mb-0">
                    <div className="text-[12.5px] font-medium text-muted">
                      {DAYS_SHORT[s.day]} {s.dateLabel}
                    </div>
                    <SwapLine person={s.personA} from={s.oldA} to={s.newA} />
                    <SwapLine person={s.personB} from={s.oldB} to={s.newB} />
                  </div>
                ))}
                {a.note && <p className="mt-1.5 text-[13px] text-text-2">Grund: {a.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {sheet && week && who && (
        <SwapSheet
          key={`${week.id}-${sheet.day}`}
          week={week}
          day={sheet.day}
          me={who}
          version={version}
          onClose={() => setSheet(null)}
          onSaved={(v) => {
            setVersion(v);
            router.refresh();
          }}
        />
      )}

      {importOpen && <ImportDialog onClose={() => setImportOpen(false)} />}
    </div>
  );
}

function isoWeek(isoDate: string) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}
