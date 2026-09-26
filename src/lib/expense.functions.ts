import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { EMPTY_DATASET, type ExpenseDataset } from "./expense-types";

export type DashboardResult =
  | { status: "ok"; data: ExpenseDataset; syncedAt: number; source: "cache" | "sheets" }
  | { status: "setup"; code: "missing_spreadsheet_id" | "missing_credentials"; message: string }
  | { status: "error"; message: string; reason?: "rate_limited" | "no_access" };

type Ctx = { supabase: { from: (table: any) => any }; userId: string };

/** The spreadsheet linked to the signed-in account, or null when none is set. */
async function spreadsheetFor(context: Ctx): Promise<string | null> {
  const { data } = await context.supabase
    .from("user_settings")
    .select("spreadsheet_id")
    .eq("user_id", context.userId)
    .maybeSingle();
  return (data?.spreadsheet_id as string | null) ?? null;
}

/** Turns any Sheets failure into a result the screens can render. */
async function toResult(error: unknown): Promise<DashboardResult> {
  const { SheetsAccessError, SheetsConfigError, SheetsRateLimitError } = await import(
    "./sheets.server"
  );
  if (error instanceof SheetsConfigError) {
    return { status: "setup", code: error.code, message: error.message };
  }
  if (error instanceof SheetsRateLimitError) {
    return { status: "error", reason: "rate_limited", message: error.message };
  }
  if (error instanceof SheetsAccessError) {
    return { status: "error", reason: "no_access", message: error.message };
  }
  const message = error instanceof Error ? error.message : String(error);
  console.error("Expense data failure:", message);
  return { status: "error", message };
}

/**
 * Single entry point for all dashboard data. Reads the stored local copy first
 * so screens open instantly; only falls back to Google Sheets when no copy
 * exists yet (first run after linking a sheet).
 */
export const getExpenseDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardResult> => {
    const { readSnapshot, writeSnapshot } = await import("./snapshot.server");

    try {
      const spreadsheetId = await spreadsheetFor(context);
      if (!spreadsheetId) {
        return {
          status: "setup",
          code: "missing_spreadsheet_id",
          message: "Link your Google Sheet to see your dashboard.",
        };
      }

      const stored = await readSnapshot(context.supabase, context.userId, spreadsheetId);
      if (stored) {
        return {
          status: "ok",
          data: { ...stored.data, fetchedAt: stored.syncedAt },
          syncedAt: stored.syncedAt,
          source: "cache",
        };
      }

      const { loadExpenseDataset } = await import("./expense-data.server");
      const data = await loadExpenseDataset(spreadsheetId, true);
      const syncedAt = await writeSnapshot(
        context.supabase,
        context.userId,
        spreadsheetId,
        data,
      );
      return { status: "ok", data, syncedAt, source: "sheets" };
    } catch (error) {
      return toResult(error);
    }
  });

/**
 * "Sync from Sheets" — one way only. Re-reads every tab from Google Sheets and
 * refreshes the stored local copy. The spreadsheet itself is never modified.
 */
export const syncFromSheets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardResult> => {
    const { writeSnapshot } = await import("./snapshot.server");
    const { loadExpenseDataset, invalidateExpenseCache } = await import("./expense-data.server");

    try {
      const spreadsheetId = await spreadsheetFor(context);
      if (!spreadsheetId) {
        return {
          status: "setup",
          code: "missing_spreadsheet_id",
          message: "Link your Google Sheet to see your dashboard.",
        };
      }

      invalidateExpenseCache(spreadsheetId);
      const data = await loadExpenseDataset(spreadsheetId, true);
      const syncedAt = await writeSnapshot(context.supabase, context.userId, spreadsheetId, data);
      return { status: "ok", data, syncedAt, source: "sheets" };
    } catch (error) {
      return toResult(error);
    }
  });

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
  | { status: "added"; tab: string; row: number | null; date: string; createdTab?: boolean }
  | { status: "no_tab"; tab: string; message: string }
  | { status: "error"; message: string };

/** Column headings used when a new monthly expense tab has to be created. */
const EXPENSE_HEADERS = ["Date", "Amount", "Description", "Category", "User", "Details"];
/** Column headings used when a new "<year> Overview" investment tab has to be created. */
const INVESTMENT_HEADERS = [
  "Date",
  "Amount",
  "Category",
  "User",
  "Description",
  "Returns",
  "Return Date",
];


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
  .middleware([requireSupabaseAuth])
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
  .handler(async ({ data, context }): Promise<AddExpenseResult> => {
    const { appendRow, ensureTab } = await import("./sheets.server");
    const { invalidateExpenseCache } = await import("./expense-data.server");

    const now = new Date();
    const tab = monthTab(now);

    try {
      const spreadsheetId = await spreadsheetFor(context);
      if (!spreadsheetId) {
        return { status: "error", message: "Link your Google Sheet before adding entries." };
      }

      // The month's tab is created on demand, so nothing external has to
      // prepare next month's sheet in advance.
      const createdTab = await ensureTab(spreadsheetId, tab, EXPENSE_HEADERS);

      const row = await appendRow(spreadsheetId, tab, [
        dmy(now),
        data.amount,
        data.description,
        data.category,
        data.user,
        data.details,
      ]);

      invalidateExpenseCache(spreadsheetId);
      return { status: "added", tab, row, date: dmy(now), createdTab };

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
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tab: string; row: number; amount: number; description: string }) => ({
    tab: String(input.tab),
    row: Number(input.row),
    amount: Number(input.amount),
    description: String(input.description ?? ""),
  }))
  .handler(
    async ({ data, context }): Promise<{ status: "removed" | "skipped"; message?: string }> => {
      const { a1, deleteRow, getRange } = await import("./sheets.server");
      const { invalidateExpenseCache } = await import("./expense-data.server");

      try {
        const spreadsheetId = await spreadsheetFor(context);
        if (!spreadsheetId) return { status: "skipped", message: "No sheet is linked." };

        const range = a1(data.tab, `A${data.row}:F${data.row}`);
        const rows = await getRange(spreadsheetId, range);
        const row = rows[0];
        const amount = Number(String(row?.[1] ?? "").replace(/[^0-9.-]/g, ""));
        const description = String(row?.[2] ?? "").trim();

        if (!row || amount !== data.amount || description !== data.description.trim()) {
          return { status: "skipped", message: "That entry has already changed in the sheet." };
        }

        await deleteRow(spreadsheetId, data.tab, data.row);
        invalidateExpenseCache(spreadsheetId);
        return { status: "removed" };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Failed to undo expense:", message);
        return { status: "skipped", message };
      }
    },
  );

export type AddInvestmentInput = {
  amount: number;
  /** ISO yyyy-mm-dd, never in the future. */
  date: string;
  category: string;
  user: string;
  description: string;
};

export type AddInvestmentResult =
  | { status: "added"; tab: string; row: number | null; date: string; createdTab?: boolean }
  | { status: "no_tab"; tab: string; message: string }
  | { status: "error"; message: string };

function overviewTab(year: number): string {
  return `${year} Overview`;
}

/**
 * Appends one investment to the "<year> Overview" tab that matches the chosen
 * date: Date | Amount | Category | User | Description (Returns columns stay blank).
 */
export const addInvestment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AddInvestmentInput) => {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid amount");

    const date = String(input.date ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date");
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate(),
    ).padStart(2, "0")}`;
    if (date > iso) throw new Error("Date cannot be in the future");

    const category = String(input.category ?? "").trim();
    if (!category) throw new Error("Missing category");
    const user = String(input.user ?? "").trim();
    if (!user) throw new Error("Missing user");

    return {
      amount,
      date,
      category: category.slice(0, 120),
      user: user.slice(0, 60),
      description: String(input.description ?? "").trim().slice(0, 300),
    } satisfies AddInvestmentInput;
  })
  .handler(async ({ data, context }): Promise<AddInvestmentResult> => {
    const { appendRow, ensureTab } = await import("./sheets.server");
    const { invalidateExpenseCache } = await import("./expense-data.server");

    const [y, m, d] = data.date.split("-") as [string, string, string];
    const tab = overviewTab(Number(y));
    const displayDate = `${d}/${m}/${y}`;

    try {
      const spreadsheetId = await spreadsheetFor(context);
      if (!spreadsheetId) {
        return { status: "error", message: "Link your Google Sheet before adding entries." };
      }

      // The year's Overview tab is created on demand with the right headings.
      const createdTab = await ensureTab(spreadsheetId, tab, INVESTMENT_HEADERS);

      const row = await appendRow(spreadsheetId, tab, [
        displayDate,
        data.amount,
        data.category,
        data.user,
        data.description,
      ]);

      invalidateExpenseCache(spreadsheetId);
      return { status: "added", tab, row, date: displayDate, createdTab };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Failed to add investment:", message);
      return { status: "error", message };
    }
  });

/** Removes a just-added investment row, only when it still matches what we wrote. */
export const undoInvestment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tab: string; row: number; amount: number; category: string }) => ({
    tab: String(input.tab),
    row: Number(input.row),
    amount: Number(input.amount),
    category: String(input.category ?? ""),
  }))
  .handler(
    async ({ data, context }): Promise<{ status: "removed" | "skipped"; message?: string }> => {
      const { a1, deleteRow, getRange } = await import("./sheets.server");
      const { invalidateExpenseCache } = await import("./expense-data.server");

      try {
        const spreadsheetId = await spreadsheetFor(context);
        if (!spreadsheetId) return { status: "skipped", message: "No sheet is linked." };

        const range = a1(data.tab, `A${data.row}:G${data.row}`);
        const rows = await getRange(spreadsheetId, range);
        const row = rows[0];
        const amount = Number(String(row?.[1] ?? "").replace(/[^0-9.-]/g, ""));
        const category = String(row?.[2] ?? "").trim();

        if (!row || amount !== data.amount || category !== data.category.trim()) {
          return { status: "skipped", message: "That entry has already changed in the sheet." };
        }

        await deleteRow(spreadsheetId, data.tab, data.row);
        invalidateExpenseCache(spreadsheetId);
        return { status: "removed" };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Failed to undo investment:", message);
        return { status: "skipped", message };
      }
    },
  );
