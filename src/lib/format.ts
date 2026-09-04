/** Indian-locale money and date formatting used across the dashboard. */

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrPrecise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const plain = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function money(value: number, precise = false): string {
  if (!Number.isFinite(value)) return "—";
  return precise ? inrPrecise.format(value) : inr.format(value);
}

/** Compact Indian notation: 1.2L, 45.3K, 2.6Cr. Used on chart axes and chips. */
export function moneyCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(abs >= 10_00_00_000 ? 0 : 1)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(abs >= 10_00_000 ? 0 : 1)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return `${sign}₹${plain.format(abs)}`;
}

export function count(value: number): string {
  return plain.format(value);
}

export function percent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "2025-08" -> "August 2025" */
export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  const idx = Number(m) - 1;
  return `${MONTH_NAMES[idx] ?? m} ${y}`;
}

/** "2025-08" -> "Aug 2025" */
export function monthLabelShort(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  const idx = Number(m) - 1;
  return `${MONTH_SHORT[idx] ?? m} ${y}`;
}

/** "2025-08-14" -> "14 Aug" */
export function dayLabel(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${Number(d)} ${MONTH_SHORT[Number(m) - 1] ?? m}`;
}

/** "2025-08-14" -> "14 Aug 2025" */
export function fullDateLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${Number(d)} ${MONTH_SHORT[Number(m) - 1] ?? m} ${y}`;
}

/** Turn a Telegram handle into something readable: "aniketthanage" -> "Aniketthanage". */
export function userLabel(user: string): string {
  if (!user) return "Unknown";
  const cleaned = user.replace(/_\d+$/, "").replace(/[._]/g, " ").trim();
  if (!cleaned) return user;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function initials(user: string): string {
  const label = userLabel(user);
  return label.slice(0, 2).toUpperCase();
}
