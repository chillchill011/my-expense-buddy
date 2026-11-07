import { yearOf } from "./expense-normalize";
import type { Earning } from "./expense-types";

export const DEFAULT_EARNING_CATEGORIES = [
  "Salary",
  "Freelance",
  "Business",
  "Interest & Dividends",
  "Rental",
  "Bonus",
  "Gifts",
  "Other",
] as const;

export function withEarningsDefaults<T extends object>(
  dataset: T,
): T & { earnings: Earning[]; earningCategories: string[] } {
  const source = dataset as T & { earnings?: unknown; earningCategories?: unknown };
  return {
    ...dataset,
    earnings: Array.isArray(source.earnings) ? (source.earnings as Earning[]) : [],
    earningCategories: Array.isArray(source.earningCategories)
      ? (source.earningCategories as string[])
      : [],
  };
}

export function totalsByEarningYear(records: Earning[]): Map<number, number> {
  const totals = new Map<number, number>();
  for (const earning of records) {
    const year = yearOf(earning.date);
    if (Number.isFinite(year) && year > 0) {
      totals.set(year, (totals.get(year) ?? 0) + earning.amount);
    }
  }
  return totals;
}