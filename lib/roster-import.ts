import ExcelJS from "exceljs";
import type { ShiftValue } from "@/lib/roster";

export type ImportedWeek = {
  startDate: string;
  range: string;
  dates: string[];
  hint: string | null;
  shifts: Record<string, ShiftValue[]>;
};

const WEEK_ROW = /^\d{2}\.\d{2}-\d{2}\.\d{2}$/;

function cellText(value: ExcelJS.CellValue): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    const d = String(value.getUTCDate()).padStart(2, "0");
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    return `${d}.${m}.${value.getUTCFullYear()}`;
  }
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((r) => r.text).join("").trim() || null;
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("text" in value) return String(value.text).trim() || null;
  }
  const s = String(value).trim();
  return s || null;
}

/**
 * Format wie „Dienstplan_….xlsx“: Kopfzeile je Woche (Spanne, 5 Datumswerte, Hinweis),
 * darunter je Person eine Zeile mit 5 Schichtwerten.
 */
export async function parseRosterWorkbook(buffer: ArrayBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("Die Datei enthält kein Tabellenblatt.");

  const weeks: ImportedWeek[] = [];
  const names: string[] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells = [1, 2, 3, 4, 5, 6, 7].map((i) => cellText(row.getCell(i).value));
    const first = cells[0];
    if (!first) return;
    if (WEEK_ROW.test(first)) {
      const dates = cells.slice(1, 6).map((d) => d ?? "");
      const [d, m, y] = (dates[0] ?? "").split(".");
      if (!d || !m || !y) throw new Error(`Woche „${first}“: Datum für Montag fehlt oder ist ungültig.`);
      weeks.push({ startDate: `${y}-${m}-${d}`, range: first, dates, hint: cells[6] ?? null, shifts: {} });
    } else if (weeks.length) {
      weeks[weeks.length - 1]!.shifts[first] = cells.slice(1, 6).map((v) => v ?? null);
      if (!names.includes(first)) names.push(first);
    }
  });

  if (!weeks.length) throw new Error("Keine Woche erkannt – erwartet z. B. „19.10-23.10“ in Spalte A.");
  return { weeks, names };
}
