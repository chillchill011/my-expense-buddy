import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import { dashboardQueryOptions } from "@/lib/dashboard-query";
import { deleteExpenseEntry } from "@/lib/expense.functions";
import type { Expense } from "@/lib/expense-types";

/**
 * Two-tap delete for a saved expense: the first tap asks, the second removes
 * the row from Google Sheets (master) and from the fast local copy.
 */
export function DeleteEntryButton({
  expense,
  onDeleted,
}: {
  expense: Expense;
  onDeleted?: (message: string) => void;
}) {
  const remove = useServerFn(deleteExpenseEntry);
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await remove({
        data: {
          sheet: expense.sheet,
          date: expense.date,
          amount: expense.amount,
          description: expense.description,
          category: expense.category,
          user: expense.user,
          details: expense.details,
        },
      });

      if (result.status === "deleted") {
        await queryClient.invalidateQueries({ queryKey: dashboardQueryOptions.queryKey });
        onDeleted?.("Entry deleted from your sheet.");
      } else {
        onDeleted?.(result.message);
      }
    } catch (error) {
      onDeleted?.(error instanceof Error ? error.message : "Could not delete that entry.");
    } finally {
      setBusy(false);
      setAsking(false);
    }
  };

  if (asking) {
    return (
      <span className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={busy}
          className="rounded-md bg-destructive px-2 py-1 text-[11px] font-semibold text-destructive-foreground disabled:opacity-60"
        >
          {busy ? "Deleting…" : "Delete"}
        </button>
        <button
          type="button"
          onClick={() => setAsking(false)}
          disabled={busy}
          className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setAsking(true)}
      aria-label="Delete this entry"
      title="Delete this entry"
      className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
    >
      <Trash2 className="size-4" />
    </button>
  );
}
