// Dienstplan-Logik (Schichttausch) – rein, ohne UI, gemäß schichttausch-spec.

export type ShiftValue = string | null;

export type RosterWeek = {
  id: string;
  start_date: string;
  range: string;
  dates: string[];
  hint: string | null;
  shifts: Record<string, ShiftValue[]>;
};

export type RosterSwap = {
  weekRange: string;
  day: number;
  dateLabel: string;
  personA: string;
  oldA: ShiftValue;
  newA: ShiftValue;
  personB: string;
  oldB: ShiftValue;
  newB: ShiftValue;
};

export type RosterActivity = {
  id: string;
  created_at: string;
  note: string | null;
  swaps: RosterSwap[];
  author: { full_name: string } | null;
};

export const DAYS_SHORT = ["Mo", "Di", "Mi", "Do", "Fr"];
export const DAYS_LONG = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];

const TIME_START = /^(\d{1,2}):(\d{2})-/;

export function isTradeable(v: ShiftValue) {
  return typeof v === "string" && TIME_START.test(v);
}

export function isAvailableForExtra(v: ShiftValue) {
  return v === null || v === "" || v === "frei" || v === "boersenfrei";
}

/** Startzeit in Minuten (oder null, wenn kein regulärer Dienst). */
export function startMinutes(v: ShiftValue) {
  const m = typeof v === "string" ? TIME_START.exec(v) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export type ShiftKind = "frueh1" | "frueh2" | "frueh3" | "spaet" | "mp" | "frei" | "urlaub" | "boersenfrei" | "offen";

export function shiftKind(v: ShiftValue): ShiftKind {
  if (v === null || v === "") return "offen";
  if (v === "MP") return "mp";
  if (v === "frei") return "frei";
  if (v === "URLAUB") return "urlaub";
  if (v === "boersenfrei") return "boersenfrei";
  const start = startMinutes(v);
  if (start === null) return "offen";
  if (start < 7 * 60) return "frueh1";
  if (start < 8 * 60 + 30) return "frueh2";
  if (start < 10 * 60) return "frueh3";
  return "spaet";
}

/** Lynn-Palette: gedämpfte Töne, Hintergrund ~16 % wie bei den Themen-Icons. */
export const SHIFT_STYLE: Record<ShiftKind, { label: string; color: string; bg: string }> = {
  frueh1: { label: "Früh 1 (vor 7:00)", color: "#e0a050", bg: "rgba(224,160,80,0.16)" },
  frueh2: { label: "Früh 2 (7:00–8:29)", color: "#8fb573", bg: "rgba(143,181,115,0.16)" },
  frueh3: { label: "Früh 3 (8:30–9:59)", color: "#5fae9b", bg: "rgba(95,174,155,0.16)" },
  spaet: { label: "Spät (ab 10:00)", color: "#7c8fd6", bg: "rgba(124,143,214,0.16)" },
  mp: { label: "MP (Marktpflege)", color: "#a58bd0", bg: "rgba(165,139,208,0.16)" },
  frei: { label: "frei", color: "#a6a39a", bg: "rgba(166,163,154,0.10)" },
  urlaub: { label: "Urlaub", color: "#d97757", bg: "rgba(217,119,87,0.22)" },
  boersenfrei: { label: "börsenfrei", color: "#78756d", bg: "rgba(120,117,109,0.10)" },
  offen: { label: "offen", color: "#78756d", bg: "transparent" },
};

export function displayValue(v: ShiftValue) {
  if (v === null || v === "") return "offen";
  if (v === "boersenfrei") return "börsenfrei";
  if (v === "URLAUB") return "Urlaub";
  return v;
}

export type Candidate = {
  person: string;
  /** Tag, an dem ich den Dienst von `person` übernehme (= day beim gleichen Tag). */
  day: number;
  theirShift: ShiftValue;
  sameDay: boolean;
};

export function findSameDayCandidates(week: RosterWeek, day: number, me: string, earliest?: number | null) {
  return Object.keys(week.shifts)
    .filter((n) => n !== me && isTradeable(week.shifts[n]?.[day] ?? null))
    .map<Candidate>((n) => ({ person: n, day, theirShift: week.shifts[n]![day]!, sameDay: true }))
    .filter((c) => earliest == null || (startMinutes(c.theirShift) ?? 0) >= earliest)
    .sort((a, b) => (startMinutes(a.theirShift) ?? 0) - (startMinutes(b.theirShift) ?? 0));
}

export function findCrossDayCandidates(week: RosterWeek, day: number, me: string, earliest?: number | null) {
  const out: Candidate[] = [];
  for (const n of Object.keys(week.shifts)) {
    if (n === me) continue;
    if (!isAvailableForExtra(week.shifts[n]?.[day] ?? null)) continue;
    for (let dd = 0; dd < 5; dd++) {
      if (dd === day) continue;
      const theirs = week.shifts[n]?.[dd] ?? null;
      if (!isTradeable(theirs)) continue;
      if (!isAvailableForExtra(week.shifts[me]?.[dd] ?? null)) continue;
      if (earliest != null && (startMinutes(theirs) ?? 0) < earliest) continue;
      out.push({ person: n, day: dd, theirShift: theirs, sameDay: false });
    }
  }
  return out.sort((a, b) => a.person.localeCompare(b.person, "de") || a.day - b.day);
}

/** Wendet den Tausch lokal an (tiefe Kopie) – für Vorschau/Zusammenfassung. */
export function previewSwap(week: RosterWeek, me: string, myDay: number, c: Candidate): RosterSwap[] {
  const s = week.shifts;
  const myShift = s[me]![myDay] ?? null;
  if (c.sameDay) {
    const theirs = s[c.person]![myDay] ?? null;
    return [
      {
        weekRange: week.range, day: myDay, dateLabel: week.dates[myDay]!,
        personA: me, oldA: myShift, newA: theirs, personB: c.person, oldB: theirs, newB: myShift,
      },
    ];
  }
  const theirAtMine = s[c.person]![myDay] ?? null;
  const mineAtTheirs = s[me]![c.day] ?? null;
  return [
    {
      weekRange: week.range, day: myDay, dateLabel: week.dates[myDay]!,
      personA: me, oldA: myShift, newA: theirAtMine, personB: c.person, oldB: theirAtMine, newB: myShift,
    },
    {
      weekRange: week.range, day: c.day, dateLabel: week.dates[c.day]!,
      personA: me, oldA: mineAtTheirs, newA: c.theirShift, personB: c.person, oldB: c.theirShift, newB: mineAtTheirs,
    },
  ];
}

const short = (dateLabel: string) => dateLabel.slice(0, 6);

export function requestText(week: RosterWeek, me: string, myDay: number, c: Candidate) {
  const myShift = displayValue(week.shifts[me]![myDay] ?? null);
  const first = c.person.split(" ")[0];
  if (c.sameDay) {
    return (
      `Hi ${first}, könntest du am ${DAYS_LONG[myDay]} (${short(week.dates[myDay]!)}) mit mir tauschen? ` +
      `Ich würde deinen Dienst ${displayValue(c.theirShift)} übernehmen und du meinen ${myShift}. ` +
      `Sag kurz Bescheid, ob das passt – danke!`
    );
  }
  return (
    `Hi ${first}, könntest du am ${DAYS_LONG[myDay]} (${short(week.dates[myDay]!)}) meinen Dienst ${myShift} übernehmen? ` +
    `Im Gegenzug übernehme ich deinen Dienst am ${DAYS_LONG[c.day]} (${short(week.dates[c.day]!)}) ${displayValue(c.theirShift)}. ` +
    `Sag kurz Bescheid, ob das passt – danke!`
  );
}

/** Kompakte Gruppennachricht: nur neuer Stand pro Tag. */
export function groupMessage(swaps: RosterSwap[], note?: string | null) {
  const lines = swaps.map(
    (s) =>
      `${DAYS_SHORT[s.day]} ${short(s.dateLabel)}: ${s.personA} ${displayValue(s.newA)} · ${s.personB} ${displayValue(s.newB)}`,
  );
  return ["Dienstplan-Änderung (Tausch):", ...lines, note ? `Grund: ${note}` : null].filter(Boolean).join("\n");
}

/** Index der Woche, die heute enthält – sonst die nächste kommende, sonst die letzte. */
export function currentWeekIndex(weeks: RosterWeek[], today = new Date()) {
  const iso = today.toISOString().slice(0, 10);
  let idx = weeks.findIndex((w) => {
    const end = new Date(w.start_date);
    end.setDate(end.getDate() + 6);
    return w.start_date <= iso && iso <= end.toISOString().slice(0, 10);
  });
  if (idx < 0) idx = weeks.findIndex((w) => w.start_date > iso);
  return idx < 0 ? Math.max(0, weeks.length - 1) : idx;
}

export function parseTimeInput(value: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
