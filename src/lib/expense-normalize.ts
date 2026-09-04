/**
 * Pure normalizers that turn raw Google Sheets cell values into typed records.
 *
 * The sheet was written by a Telegram bot over several years, so it is messy:
 * dates are sometimes real date cells (serial numbers) and sometimes
 * "DD/MM/YYYY" text, amounts are sometimes strings with separators, and
 * category/user casing drifts. Everything funnels through here.
 */

export type Cell = string | number | boolean | null | undefined;
export type Row = Cell[];

/** Google Sheets / Excel serial epoch: day 0 is 1899-12-30. */
const SERIAL_EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toIso(y: number, m: number, d: number): string | null {
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Parse a date cell to ISO yyyy-mm-dd, or null when unparseable.
 * Handles serial numbers, "DD/MM/YYYY", "D-M-YYYY" and ISO strings.
 */
export function parseDate(cell: Cell): string | null {
  if (cell === null || cell === undefined || cell === "") return null;

  if (typeof cell === "number" && Number.isFinite(cell)) {
    // Serial numbers below ~30000 (1982) are almost certainly not dates.
    if (cell < 30_000 || cell > 80_000) return null;
    const dt = new Date(SERIAL_EPOCH_MS + Math.floor(cell) * MS_PER_DAY);
    return toIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }

  const raw = String(cell).trim();
  if (!raw) return null;

  // ISO first: 2025-08-14 or 2025-08-14T...
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return toIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // Day-first with / . or - separators: 18/01/2025
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(raw);
  if (dmy) {
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    return toIso(year, Number(dmy[2]), Number(dmy[1]));
  }

  return null;
}

/** Parse an amount cell. Tolerates "1,234", "₹1234", "1234.50" and blanks. */
export function parseAmount(cell: Cell): number | null {
  if (cell === null || cell === undefined || cell === "") return null;
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
  const cleaned = String(cell).replace(/[^0-9.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Trim a text cell to a plain string. */
export function text(cell: Cell): string {
  if (cell === null || cell === undefined) return "";
  return String(cell).trim();
}

/**
 * Normalize a label used for grouping: collapse whitespace and title-case-ish
 * so "dining out", "Dining Out " and "Dining out" all bucket together.
 */
export function normalizeLabel(cell: Cell): string {
  const t = text(cell).replace(/\s+/g, " ");
  if (!t) return "";
  return t
    .split(" ")
    .map((word) =>
      word.length <= 1 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join(" ");
}

/** A header row is skipped when its first cell literally reads "date". */
export function isHeaderRow(row: Row): boolean {
  return text(row[0]).toLowerCase() === "date";
}

/** Tab names that hold monthly expenses, e.g. "2025-08". */
export function isMonthlyTab(title: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(title.trim());
}

/** Tab names that hold yearly investments, e.g. "2025 Overview". */
export function overviewTabYear(title: string): number | null {
  const m = /^(\d{4})\s+Overview$/i.exec(title.trim());
  return m ? Number(m[1]) : null;
}

export function yearOf(isoDate: string): number {
  return Number(isoDate.slice(0, 4));
}

export function monthKeyOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}
