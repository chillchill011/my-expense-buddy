import { createServerFn } from "@tanstack/react-start";

import { EMPTY_DATASET, type ExpenseDataset } from "./expense-types";

export type DashboardResult =
  | { status: "ok"; data: ExpenseDataset }
  | { status: "setup"; code: "missing_spreadsheet_id" | "missing_credentials"; message: string }
  | { status: "error"; message: string; reason?: "rate_limited" };

/**
 * Single entry point for all dashboard data. Returns a discriminated result
 * instead of throwing so the UI can render a helpful setup screen when the
 * spreadsheet has not been wired up yet.
 */
export const getExpenseDashboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardResult> => {
    const { loadExpenseDataset } = await import("./expense-data.server");
    const { SheetsConfigError, SheetsRateLimitError } = await import("./sheets.server");

    try {
      const data = await loadExpenseDataset();
      return { status: "ok", data };
    } catch (error) {
      if (error instanceof SheetsConfigError) {
        return { status: "setup", code: error.code, message: error.message };
      }
      if (error instanceof SheetsRateLimitError) {
        return { status: "error", reason: "rate_limited", message: error.message };
      }
      const message = error instanceof Error ? error.message : String(error);
      console.error("Failed to load expense dashboard:", message);
      return { status: "error", message };
    }
  },
);

export function datasetOf(result: DashboardResult): ExpenseDataset {
  return result.status === "ok" ? result.data : EMPTY_DATASET;
}

export type AddExpenseInput = {
  amount: number;
  description: string;
  details: string;
  category: string;
  user: string;
};

export type AddExpenseResult =
  | { status: "added"; tab: string; row: number | null; date: string }
  | { status: "no_tab"; tab: string; message: string }
  | { status: "error"; message: string };

function monthTab(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function dmy(now: Date): string {
  const d = String(now.getDate()).padStart(2, "0");
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${now.getFullYear()}`;
}

/**
 * Appends one expense to the current month's tab, exactly the way the Telegram
 * bot does: Date | Amount | Description | Category | User | Details.
 */
export const addExpense = createServerFn({ method: "POST" })
  .inputValidator((input: AddExpenseInput) => {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid amount");
    const description = String(input.description ?? "").trim();
    if (!description) throw new Error("Missing description");
    return {
      amount,
      description: description.slice(0, 300),
      details: String(input.details ?? "").trim().slice(0, 300),
      category: String(input.category ?? "").trim().slice(0, 120) || "Uncategorized",
      user: String(input.user ?? "").trim().slice(0, 60) || "unknown",
    } satisfies AddExpenseInput;
  })
  .handler(async ({ data }): Promise<AddExpenseResult> => {
    const { appendRow, listTabTitles } = await import("./sheets.server");
    const { invalidateExpenseCache } = await import("./expense-data.server");

    const now = new Date();
    const tab = monthTab(now);

    try {
      const titles = await listTabTitles();
      if (!titles.includes(tab)) {
        return {
          status: "no_tab",
          tab,
          message: `The ${tab} tab hasn't been created in your sheet yet, so there's nowhere to save this.`,
        };
      }

      const row = await appendRow(tab, [
        dmy(now),
        data.amount,
        data.description,
        data.category,
        data.user,
        data.details,
      ]);

      invalidateExpenseCache();
      return { status: "added", tab, row, date: dmy(now) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Failed to add expense:", message);
      return { status: "error", message };
    }
  });

/**
 * Removes a row that was just appended. The row is re-read first and only
 * deleted when its amount and description still match, so a concurrent write
 * from the Telegram bot can never be removed by an undo.
 */
export const undoExpense = createServerFn({ method: "POST" })
  .inputValidator((input: { tab: string; row: number; amount: number; description: string }) => ({
    tab: String(input.tab),
    row: Number(input.row),
    amount: Number(input.amount),
    description: String(input.description ?? ""),
  }))
  .handler(async ({ data }): Promise<{ status: "removed" | "skipped"; message?: string }> => {
    const { a1, deleteRow, getRange } = await import("./sheets.server");
    const { invalidateExpenseCache } = await import("./expense-data.server");

    try {
      const range = a1(data.tab, `A${data.row}:F${data.row}`);
      const rows = await getRange(range);
      const row = rows[0];
      const amount = Number(String(row?.[1] ?? "").replace(/[^0-9.-]/g, ""));
      const description = String(row?.[2] ?? "").trim();

      if (!row || amount !== data.amount || description !== data.description.trim()) {
        return { status: "skipped", message: "That entry has already changed in the sheet." };
      }

      await deleteRow(data.tab, data.row);
      invalidateExpenseCache();
      return { status: "removed" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Failed to undo expense:", message);
      return { status: "skipped", message };
    }
  });

