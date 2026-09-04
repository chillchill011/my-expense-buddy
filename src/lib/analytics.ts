/** Pure aggregation helpers shared by every dashboard screen. */

import { monthKeyOf, yearOf } from "./expense-normalize";
import type { Expense, Investment, LoanAccount, LoanRepayment } from "./expense-types";

export type Bucket = { key: string; total: number; count: number };

function bucket<T>(rows: T[], keyOf: (row: T) => string, amountOf: (row: T) => number): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const row of rows) {
    const key = keyOf(row) || "Unknown";
    const existing = map.get(key);
    if (existing) {
      existing.total += amountOf(row);
      existing.count += 1;
    } else {
      map.set(key, { key, total: amountOf(row), count: 1 });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export function sum(rows: Array<{ amount: number }>): number {
  return rows.reduce((acc, r) => acc + r.amount, 0);
}

export function byCategory(rows: Array<{ category: string; amount: number }>): Bucket[] {
  return bucket(rows, (r) => r.category, (r) => r.amount);
}

export function byUser(rows: Array<{ user: string; amount: number }>): Bucket[] {
  return bucket(rows, (r) => r.user, (r) => r.amount);
}

export function byLoan(rows: LoanRepayment[]): Bucket[] {
  return bucket(rows, (r) => r.loan, (r) => r.amount);
}

export function byMonth(rows: Array<{ date: string; amount: number }>): Bucket[] {
  return bucket(rows, (r) => monthKeyOf(r.date), (r) => r.amount).sort((a, b) =>
    a.key < b.key ? -1 : 1,
  );
}

export function byYear(rows: Array<{ date: string; amount: number }>): Bucket[] {
  return bucket(rows, (r) => String(yearOf(r.date)), (r) => r.amount).sort((a, b) =>
    a.key < b.key ? -1 : 1,
  );
}

/** All month keys present in the data, newest first. */
export function availableMonths(expenses: Expense[]): string[] {
  return Array.from(new Set(expenses.map((e) => monthKeyOf(e.date)))).sort((a, b) =>
    a < b ? 1 : -1,
  );
}

/** All years present across expenses, investments and repayments, newest first. */
export function availableYears(
  expenses: Expense[],
  investments: Investment[],
  repayments: LoanRepayment[],
): number[] {
  const years = new Set<number>();
  for (const row of [...expenses, ...investments, ...repayments]) years.add(yearOf(row.date));
  return Array.from(years).sort((a, b) => b - a);
}

export function inMonth<T extends { date: string }>(rows: T[], monthKey: string): T[] {
  return rows.filter((r) => monthKeyOf(r.date) === monthKey);
}

export function inYear<T extends { date: string }>(rows: T[], year: number): T[] {
  return rows.filter((r) => yearOf(r.date) === year);
}

/** "2025-08" -> "2025-07". */
export function previousMonthKey(monthKey: string): string {
  const [ys, ms] = monthKey.split("-");
  let year = Number(ys);
  let month = Number(ms) - 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

/** Fill a full 12-month series for a year so charts do not skip empty months. */
export function monthlySeries(
  rows: Array<{ date: string; amount: number }>,
  year: number,
): Array<{ month: string; monthKey: string; total: number }> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (yearOf(row.date) !== year) continue;
    const key = monthKeyOf(row.date);
    totals.set(key, (totals.get(key) ?? 0) + row.amount);
  }
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return labels.map((label, idx) => {
    const monthKey = `${year}-${String(idx + 1).padStart(2, "0")}`;
    return { month: label, monthKey, total: totals.get(monthKey) ?? 0 };
  });
}

export type LoanProgress = LoanAccount & {
  repaid: number;
  outstanding: number;
  progress: number;
  payments: number;
  lastPayment: string | null;
};

export function loanProgress(
  accounts: LoanAccount[],
  repayments: LoanRepayment[],
): LoanProgress[] {
  const totals = byLoan(repayments);
  const byKey = new Map(totals.map((t) => [t.key, t]));
  const known = new Set(accounts.map((a) => a.category));

  const rows: LoanProgress[] = accounts.map((account) => {
    const stat = byKey.get(account.category);
    const repaid = stat?.total ?? 0;
    const last = repayments.find((r) => r.loan === account.category);
    return {
      ...account,
      repaid,
      outstanding: Math.max(account.principal - repaid, 0),
      progress: account.principal > 0 ? Math.min((repaid / account.principal) * 100, 100) : 0,
      payments: stat?.count ?? 0,
      lastPayment: last?.date ?? null,
    };
  });

  // Repayments pointing at a loan that is missing from Loan Master still show up.
  for (const stat of totals) {
    if (known.has(stat.key)) continue;
    const last = repayments.find((r) => r.loan === stat.key);
    rows.push({
      category: stat.key,
      bank: "",
      description: "Not in Loan Master",
      principal: 0,
      repaid: stat.total,
      outstanding: 0,
      progress: 0,
      payments: stat.count,
      lastPayment: last?.date ?? null,
    });
  }

  return rows.sort((a, b) => b.principal - a.principal || b.repaid - a.repaid);
}

export const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
  "var(--color-chart-8)",
];

export function colorAt(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length] as string;
}
