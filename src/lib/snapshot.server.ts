/**
 * The database copy of the spreadsheet.
 *
 * Google Sheets stays the master record. This is only a fast local copy so the
 * app can paint its screens in milliseconds instead of reading 30+ tabs from
 * Google on every page load. Nothing in this file ever writes to the sheet.
 */

import type { Expense, ExpenseDataset, Investment } from "./expense-types";

/** Loose shape of the authenticated Supabase client handed to server functions. */
export type Db = { from: (table: string) => any };

export type Snapshot = {
  data: ExpenseDataset;
  syncedAt: number;
};

export async function readSnapshot(
  db: Db,
  userId: string,
  spreadsheetId: string,
): Promise<Snapshot | null> {
  const { data, error } = await db
    .from("sheet_snapshots")
    .select("dataset, synced_at")
    .eq("user_id", userId)
    .eq("spreadsheet_id", spreadsheetId)
    .maybeSingle();

  if (error || !data?.dataset) return null;
  return {
    data: data.dataset as ExpenseDataset,
    syncedAt: new Date(data.synced_at as string).getTime(),
  };
}

export async function writeSnapshot(
  db: Db,
  userId: string,
  spreadsheetId: string,
  dataset: ExpenseDataset,
): Promise<number> {
  const syncedAt = new Date();
  const { error } = await db.from("sheet_snapshots").upsert(
    {
      user_id: userId,
      spreadsheet_id: spreadsheetId,
      dataset,
      expense_count: dataset.expenses.length,
      investment_count: dataset.investments.length,
      synced_at: syncedAt.toISOString(),
    },
    { onConflict: "user_id,spreadsheet_id" },
  );
  if (error) console.error("Failed to store the local copy:", error.message);
  return syncedAt.getTime();
}

const byDateDesc = <T extends { date: string }>(a: T, b: T) =>
  a.date < b.date ? 1 : a.date > b.date ? -1 : 0;

/**
 * Adds one just-written row to the local copy so the screens update instantly,
 * without waiting for a full re-read of the sheet.
 */
export async function appendToSnapshot(
  db: Db,
  userId: string,
  spreadsheetId: string,
  entry: { kind: "expense"; row: Expense } | { kind: "investment"; row: Investment },
): Promise<void> {
  const snapshot = await readSnapshot(db, userId, spreadsheetId);
  if (!snapshot) return; // No local copy yet — the next sync will pick the row up.

  const data = snapshot.data;
  if (entry.kind === "expense") {
    data.expenses = [entry.row, ...data.expenses].sort(byDateDesc);
    if (entry.row.category && !data.categories.includes(entry.row.category)) {
      data.categories = [...data.categories, entry.row.category].sort();
    }
    if (entry.row.user && entry.row.user !== "unknown" && !data.users.includes(entry.row.user)) {
      data.users = [...data.users, entry.row.user].sort();
    }
  } else {
    data.investments = [entry.row, ...data.investments].sort(byDateDesc);
  }

  await writeSnapshot(db, userId, spreadsheetId, data);
}

/** Removes an undone row from the local copy. */
export async function removeFromSnapshot(
  db: Db,
  userId: string,
  spreadsheetId: string,
  entry:
    | { kind: "expense"; date: string; amount: number; description: string }
    | { kind: "investment"; date: string; amount: number; category: string },
): Promise<void> {
  const snapshot = await readSnapshot(db, userId, spreadsheetId);
  if (!snapshot) return;

  const data = snapshot.data;
  if (entry.kind === "expense") {
    const i = data.expenses.findIndex(
      (e) =>
        e.date === entry.date && e.amount === entry.amount && e.description === entry.description,
    );
    if (i === -1) return;
    data.expenses = data.expenses.filter((_, n) => n !== i);
  } else {
    const i = data.investments.findIndex(
      (e) => e.date === entry.date && e.amount === entry.amount && e.category === entry.category,
    );
    if (i === -1) return;
    data.investments = data.investments.filter((_, n) => n !== i);
  }

  await writeSnapshot(db, userId, spreadsheetId, data);
}
