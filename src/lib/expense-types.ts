/** Shared, browser-safe types for everything read out of the expense spreadsheet. */

export type Expense = {
  /** ISO yyyy-mm-dd */
  date: string;
  amount: number;
  description: string;
  category: string;
  user: string;
  details: string;
  /** Source tab, e.g. "2025-08" */
  sheet: string;
};

export type Investment = {
  date: string;
  amount: number;
  category: string;
  user: string;
  description: string;
  returns: number | null;
  returnDate: string | null;
  sheet: string;
};

export type LoanRepayment = {
  date: string;
  amount: number;
  user: string;
  loan: string;
  description: string;
};

export type LoanAccount = {
  category: string;
  bank: string;
  description: string;
  principal: number;
};

export type InvestmentAccount = {
  category: string;
  risk: string;
  description: string;
};

export type CategoryRule = {
  item: string;
  category: string;
  keywords: string[];
};

/** A row whose sheet tab disagrees with the row's own date. */
export type DataQualityIssue = {
  sheet: string;
  expectedYear: number;
  actualDate: string;
  amount: number;
  label: string;
};

export type ExpenseDataset = {
  expenses: Expense[];
  investments: Investment[];
  loanRepayments: LoanRepayment[];
  loanAccounts: LoanAccount[];
  investmentAccounts: InvestmentAccount[];
  categories: string[];
  users: string[];
  /** Master tab rules used to auto-categorize a typed entry. */
  rules: CategoryRule[];
  issues: DataQualityIssue[];
  /** Epoch ms when this snapshot was read from Google Sheets. */
  fetchedAt: number;
};

export const EMPTY_DATASET: ExpenseDataset = {
  expenses: [],
  investments: [],
  loanRepayments: [],
  loanAccounts: [],
  investmentAccounts: [],
  categories: [],
  users: [],
  rules: [],
  issues: [],
  fetchedAt: 0,
};

