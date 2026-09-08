/**
 * Reads the whole expense spreadsheet and normalizes it into one typed dataset.
 * Server-only. Cached briefly so a page with several panels does not hammer the
 * Sheets API quota.
 */

import {
  isHeaderRow,
  isMonthlyTab,
  normalizeLabel,
  overviewTabYear,
  parseAmount,
  parseDate,
  text,
  yearOf,
  type Row,
} from "./expense-normalize";
import { a1, batchGetRanges, listTabTitles } from "./sheets.server";
import type {
  CategoryRule,
  DataQualityIssue,
  Expense,
  ExpenseDataset,
  Investment,
  InvestmentAccount,
  LoanAccount,
  LoanRepayment,
} from "./expense-types";

const MASTER_TAB = "Master";
const LOAN_MASTER_TAB = "Loan Master";
const INVESTMENT_MASTER_TAB = "Investment Master";

/** The bot has used both spellings over time. */
const LOAN_REPAYMENT_TABS = ["Loan repayment", "Loan Repayment"];

// The sheet only changes when the Telegram bot writes, so 5 minutes of caching
// is plenty and keeps us well under Google's shared per-minute read quota.
const CACHE_TTL_MS = 5 * 60_000;
let cache: { data: ExpenseDataset; at: number } | null = null;

export function invalidateExpenseCache(): void {
  cache = null;
}

export async function loadExpenseDataset(force = false): Promise<ExpenseDataset> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

  const titles = await listTabTitles();
  const monthlyTabs = titles.filter(isMonthlyTab).sort();
  const overviewTabs = titles.filter((t) => overviewTabYear(t) !== null);
  const loanTab = LOAN_REPAYMENT_TABS.find((t) => titles.includes(t));

  const ranges: string[] = [];
  const monthlyRanges = new Map<string, string>();
  for (const tab of monthlyTabs) {
    const range = a1(tab, "A2:F");
    monthlyRanges.set(tab, range);
    ranges.push(range);
  }

  const overviewRanges = new Map<string, string>();
  for (const tab of overviewTabs) {
    const range = a1(tab, "A2:G");
    overviewRanges.set(tab, range);
    ranges.push(range);
  }

  const masterRange = titles.includes(MASTER_TAB) ? a1(MASTER_TAB, "A2:C") : null;
  const loanMasterRange = titles.includes(LOAN_MASTER_TAB) ? a1(LOAN_MASTER_TAB, "A2:D") : null;
  const investmentMasterRange = titles.includes(INVESTMENT_MASTER_TAB)
    ? a1(INVESTMENT_MASTER_TAB, "A2:C")
    : null;
  const loanRepaymentRange = loanTab ? a1(loanTab, "A2:E") : null;

  for (const r of [masterRange, loanMasterRange, investmentMasterRange, loanRepaymentRange]) {
    if (r) ranges.push(r);
  }

  const values = await batchGetRanges(ranges);
  const rowsFor = (range: string | null): Row[] => (range ? (values.get(range) ?? []) : []);

  const issues: DataQualityIssue[] = [];

  // --- Expenses: Date | Amount | Description | Category | User | Details ---
  const expenses: Expense[] = [];
  for (const tab of monthlyTabs) {
    const expectedYear = Number(tab.slice(0, 4));
    for (const row of rowsFor(monthlyRanges.get(tab) ?? null)) {
      if (isHeaderRow(row)) continue;
      const date = parseDate(row[0]);
      const amount = parseAmount(row[1]);
      if (!date || amount === null || amount === 0) continue;

      const description = text(row[2]);
      const category = normalizeLabel(row[3]) || "Uncategorized";
      const user = text(row[4]) || "unknown";

      expenses.push({
        date,
        amount,
        description,
        category,
        user,
        details: text(row[5]),
        sheet: tab,
      });

      if (yearOf(date) !== expectedYear) {
        issues.push({
          sheet: tab,
          expectedYear,
          actualDate: date,
          amount,
          label: description || category,
        });
      }
    }
  }
  expenses.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  // --- Investments: Date | Amount | Category | User | Description | Returns | Return Date ---
  // Overview tabs have historically carried stray rows from other years. Rows are
  // deduplicated on their content so a row repeated across tabs counts once.
  const investments: Investment[] = [];
  const seenInvestment = new Set<string>();
  for (const tab of overviewTabs) {
    const expectedYear = overviewTabYear(tab);
    for (const row of rowsFor(overviewRanges.get(tab) ?? null)) {
      if (isHeaderRow(row)) continue;
      const date = parseDate(row[0]);
      const amount = parseAmount(row[1]);
      if (!date || amount === null || amount === 0) continue;

      const category = normalizeLabel(row[2]) || "Uncategorized";
      const user = text(row[3]) || "unknown";
      const fingerprint = `${date}|${amount}|${category}|${user}|${text(row[4])}`;
      if (seenInvestment.has(fingerprint)) continue;
      seenInvestment.add(fingerprint);

      investments.push({
        date,
        amount,
        category,
        user,
        description: text(row[4]),
        returns: parseAmount(row[5]),
        returnDate: parseDate(row[6]),
        sheet: tab,
      });

      if (expectedYear !== null && yearOf(date) !== expectedYear) {
        issues.push({
          sheet: tab,
          expectedYear,
          actualDate: date,
          amount,
          label: category,
        });
      }
    }
  }
  investments.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  // --- Loan repayments: Date | Amount | User | Loan | Description ---
  const loanRepayments: LoanRepayment[] = [];
  for (const row of rowsFor(loanRepaymentRange)) {
    if (isHeaderRow(row)) continue;
    const date = parseDate(row[0]);
    const amount = parseAmount(row[1]);
    if (!date || amount === null || amount === 0) continue;
    loanRepayments.push({
      date,
      amount,
      user: text(row[2]) || "unknown",
      loan: normalizeLabel(row[3]) || "Unassigned",
      description: text(row[4]),
    });
  }
  loanRepayments.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  // --- Loan Master: Category | Bank | Description | Amount ---
  const loanAccounts: LoanAccount[] = [];
  for (const row of rowsFor(loanMasterRange)) {
    const category = normalizeLabel(row[0]);
    if (!category || category.toLowerCase() === "category") continue;
    loanAccounts.push({
      category,
      bank: text(row[1]),
      description: text(row[2]),
      principal: parseAmount(row[3]) ?? 0,
    });
  }

  // --- Investment Master: Category | Risk Level | Description ---
  const investmentAccounts: InvestmentAccount[] = [];
  for (const row of rowsFor(investmentMasterRange)) {
    const category = normalizeLabel(row[0]);
    if (!category || category.toLowerCase() === "category") continue;
    investmentAccounts.push({
      category,
      risk: text(row[1]) || "Unknown",
      description: text(row[2]),
    });
  }

  // --- Master: Expense Item | Category | Keywords ---
  const rules: CategoryRule[] = [];
  for (const row of rowsFor(masterRange)) {
    const item = text(row[0]);
    const category = normalizeLabel(row[1]);
    if (!item || !category) continue;
    rules.push({
      item: item.toLowerCase(),
      category,
      keywords: text(row[2])
        .split(",")
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean),
    });
  }

  const categories = Array.from(
    new Set([...rules.map((r) => r.category), ...expenses.map((e) => e.category)]),
  )
    .filter(Boolean)
    .sort();

  const users = Array.from(new Set(expenses.map((e) => e.user)))
    .filter((u) => u && u !== "unknown")
    .sort();

  const data: ExpenseDataset = {
    expenses,
    investments,
    loanRepayments,
    loanAccounts,
    investmentAccounts,
    categories,
    users,
    rules,
    issues,
    fetchedAt: Date.now(),
  };


  cache = { data, at: Date.now() };
  return data;
}
