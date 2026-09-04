import { createServerFn } from "@tanstack/react-start";

import { EMPTY_DATASET, type ExpenseDataset } from "./expense-types";

export type DashboardResult =
  | { status: "ok"; data: ExpenseDataset }
  | { status: "setup"; code: "missing_spreadsheet_id" | "missing_credentials"; message: string }
  | { status: "error"; message: string };

/**
 * Single entry point for all dashboard data. Returns a discriminated result
 * instead of throwing so the UI can render a helpful setup screen when the
 * spreadsheet has not been wired up yet.
 */
export const getExpenseDashboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardResult> => {
    const { loadExpenseDataset } = await import("./expense-data.server");
    const { SheetsConfigError } = await import("./sheets.server");

    try {
      const data = await loadExpenseDataset();
      return { status: "ok", data };
    } catch (error) {
      if (error instanceof SheetsConfigError) {
        return { status: "setup", code: error.code, message: error.message };
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
