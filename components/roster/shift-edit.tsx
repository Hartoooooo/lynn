"use client";

import { useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { setShift } from "@/app/actions";
import { useToast } from "@/components/toast";
import { Button, Dialog, Input, Label } from "@/components/ui";
import { compactTime, DAYS_LONG, displayValue, type RosterWeek, type ShiftValue } from "@/lib/roster";

/** Laurens darf jede Schicht beliebig setzen – freie Eingabe oder Schnellauswahl. */
export function ShiftEditDialog({
  week,
  person,
  day,
  current,
  version,
  onClose,
  onSaved,
}: {
  week: RosterWeek;
  person: string;
  day: number;
  current: ShiftValue;
  version: number;
  onClose: () => void;
  onSaved: (version: number) => void;
}) {
  const toast = useToast();
  const m = current ? /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(current) : null;
  const [from, setFrom] = useState(m ? `${m[1]!.padStart(2, "0")}:${m[2]}` : "");
  const [to, setTo] = useState(m ? `${m[3]!.padStart(2, "0")}:${m[4]}` : "");
  const [free, setFree] = useState(current && !m ? current : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(value: string | null) {
    setError(null);
    startTransition(async () => {
      const res = await setShift({ weekId: week.id, person, day, value, version });
      if (!res.ok) {
        setError(res.message);
        toast(res.message, "error");
        return;
      }
      onSaved(res.version);
      toast("Schicht gespeichert");
      onClose();
    });
  }

  return (
    <Dialog open sheet title={`${person} · ${DAYS_LONG[day]}, ${week.dates[day]}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (from && to) {
            save(`${compactTime(from)}-${compactTime(to)}`);
          } else {
            save(free.trim() || null);
          }
        }}
      >
        <p className="text-sm text-muted">
          Aktuell: <span className="font-mono text-text-2">{displayValue(current)}</span>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="shift-from">Von</Label>
            <Input id="shift-from" type="time" value={from} onChange={(e) => setFrom(e.target.value)} autoFocus />
          </div>
          <div>
            <Label htmlFor="shift-to">Bis</Label>
            <Input id="shift-to" type="time" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="shift-free">Oder freier Text (z. B. MP)</Label>
          <Input
            id="shift-free"
            value={free}
            onChange={(e) => {
              setFree(e.target.value);
              if (e.target.value) {
                setFrom("");
                setTo("");
              }
            }}
            placeholder="MP, Schulung …"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => save("frei")} disabled={pending}>
            frei
          </Button>
          <Button type="button" size="sm" onClick={() => save("MP")} disabled={pending}>
            MP
          </Button>
          <Button type="button" size="sm" onClick={() => save("URLAUB")} disabled={pending}>
            Urlaub
          </Button>
          <Button type="button" size="sm" onClick={() => save("boersenfrei")} disabled={pending}>
            börsenfrei
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => save(null)} disabled={pending}>
            Leeren
          </Button>
        </div>
        {error && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
            <button type="button" onClick={() => window.location.reload()} className="mt-2 flex items-center gap-1.5 underline">
              <RefreshCw size={13} /> Seite neu laden
            </button>
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
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
