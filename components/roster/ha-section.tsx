"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { setHaShift } from "@/app/actions";
import { useToast } from "@/components/toast";
import { Button, Dialog, Input, Label } from "@/components/ui";
import {
  compactTime,
  DAYS_LONG,
  DAYS_SHORT,
  displayValue,
  isValidHaValue,
  SHIFT_STYLE,
  shiftKind,
  type RosterWeek,
  type ShiftValue,
} from "@/lib/roster";
import { cn } from "@/lib/utils";

export type HaEdit = { person: string; day: number };

/** Handelsassistenz: Zeilen direkt im Kalender – jede Person trägt ihre Zeiten (von–bis) pro Woche selbst ein. */
export function HaRows({
  week,
  haNames,
  who,
  today,
  onEdit,
}: {
  week: RosterWeek;
  haNames: string[];
  who: string;
  today: string;
  onEdit: (edit: HaEdit) => void;
}) {
  const ha = week.ha_shifts ?? {};

  return (
    <tbody>
      <tr className="border-t border-border bg-surface">
        <th scope="colgroup" colSpan={6} className="bg-surface p-0 text-left">
          <div className="sticky left-0 z-10 inline-block bg-surface px-3 py-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-faint">
            Handelsassistenz (HA)
          </div>
        </th>
      </tr>
      {haNames.map((name) => {
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
              const value = ha[name]?.[day] ?? null;
              const empty = value === null || value === "";
              const style = SHIFT_STYLE[shiftKind(value)];
              const content = (
                <span
                  className="flex h-9 w-full items-center justify-center whitespace-nowrap rounded-lg px-1.5 font-mono text-[12.5px] tabular-nums max-sm:text-[11.5px]"
                  style={empty ? undefined : { color: style.color, background: style.bg }}
                >
                  {empty ? mine ? <Plus size={14} className="text-accent" /> : <span className="text-faint">–</span> : displayValue(value)}
                </span>
              );
              return (
                <td key={day} className={cn("p-1", week.dates[day] === today && "bg-surface/60")}>
                  {mine ? (
                    <button
                      onClick={() => onEdit({ person: name, day })}
                      className={cn(
                        "block w-full rounded-lg transition hover:ring-2 hover:ring-accent focus-visible:ring-2",
                        empty ? "outline-1 outline-dashed outline-accent/50" : "ring-1 ring-accent/60",
                      )}
                      aria-label={`${name}, ${DAYS_SHORT[day]} ${empty ? "Zeit eintragen" : `${displayValue(value)} ändern`}`}
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
  );
}

export function HaEditDialog({
  week,
  person,
  day,
  current,
  onClose,
}: {
  week: RosterWeek;
  person: string;
  day: number;
  current: ShiftValue;
  onClose: () => void;
}) {
  const toast = useToast();
  const m = current ? /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(current) : null;
  const [from, setFrom] = useState(m ? `${m[1]!.padStart(2, "0")}:${m[2]}` : "");
  const [to, setTo] = useState(m ? `${m[3]!.padStart(2, "0")}:${m[4]}` : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(value: string | null) {
    setError(null);
    if (!isValidHaValue(value)) {
      setError("Ungültige Zeit – „bis“ muss nach „von“ liegen.");
      return;
    }
    startTransition(async () => {
      const res = await setHaShift({ weekId: week.id, person, day, value });
      if (!res.ok) {
        setError(res.message);
        toast(res.message, "error");
        return;
      }
      toast("Zeit gespeichert");
      onClose();
    });
  }

  return (
    <Dialog open sheet title={`${DAYS_LONG[day]}, ${week.dates[day]}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!from || !to) {
            setError("Bitte „von“ und „bis“ ausfüllen.");
            return;
          }
          save(`${compactTime(from)}-${compactTime(to)}`);
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ha-from">Von</Label>
            <Input id="ha-from" type="time" value={from} onChange={(e) => setFrom(e.target.value)} autoFocus />
          </div>
          <div>
            <Label htmlFor="ha-to">Bis</Label>
            <Input id="ha-to" type="time" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => save("frei")} disabled={pending}>
            frei
          </Button>
          <Button type="button" size="sm" onClick={() => save("URLAUB")} disabled={pending}>
            Urlaub
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => save(null)} disabled={pending}>
            Leeren
          </Button>
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending && <Loader2 size={15} className="animate-spin" />} Speichern
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
