import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil } from "lucide-react";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dashboardQueryOptions } from "@/lib/dashboard-query";
import { editExpenseEntry } from "@/lib/expense.functions";
import type { Expense } from "@/lib/expense-types";
import { fullDateLabel, userLabel } from "@/lib/format";

const field =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40";

export function EditEntryButton({
  expense,
  categories,
  users,
  onDone,
}: {
  expense: Expense;
  categories: string[];
  users: string[];
  onDone?: (message: string) => void;
}) {
  const edit = useServerFn(editExpenseEntry);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState(String(expense.amount));
  const [description, setDescription] = useState(expense.description);
  const [category, setCategory] = useState(expense.category);
  const [user, setUser] = useState(expense.user);
  const [details, setDetails] = useState(expense.details);

  const openDialog = () => {
    setAmount(String(expense.amount));
    setDescription(expense.description);
    setCategory(expense.category);
    setUser(expense.user);
    setDetails(expense.details);
    setError("");
    setOpen(true);
  };

  const catOptions = Array.from(new Set([expense.category, ...categories].filter(Boolean)));
  const userOptions = Array.from(new Set([expense.user, ...users].filter(Boolean)));

  const save = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return setError("Enter a valid amount.");
    if (!description.trim()) return setError("Description is required.");
    setBusy(true);
    setError("");
    try {
      const result = await edit({
        data: {
          sheet: expense.sheet,
          date: expense.date,
          amount: expense.amount,
          description: expense.description,
          category: expense.category,
          user: expense.user,
          details: expense.details,
          next: { amount: value, description, category, user, details },
        },
      });
      if (result.status === "updated") {
        await queryClient.invalidateQueries({ queryKey: dashboardQueryOptions.queryKey });
        setOpen(false);
        onDone?.("Entry updated in your sheet.");
      } else {
        setError(result.message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update that entry.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        aria-label="Edit this entry"
        title="Edit this entry"
        className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Pencil className="size-4" />
      </button>
      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit entry</DialogTitle>
            <p className="text-xs text-muted-foreground">{fullDateLabel(expense.date)}</p>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block space-y-1 text-xs font-medium text-muted-foreground">
              Amount (₹)
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={field}
              />
            </label>
            <label className="block space-y-1 text-xs font-medium text-muted-foreground">
              Description
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={field}
              />
            </label>
            <label className="block space-y-1 text-xs font-medium text-muted-foreground">
              Category
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
                {catOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-xs font-medium text-muted-foreground">
              Paid by
              <select value={user} onChange={(e) => setUser(e.target.value)} className={field}>
                {userOptions.map((u) => (
                  <option key={u} value={u}>
                    {userLabel(u)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-xs font-medium text-muted-foreground">
              Details (optional)
              <input value={details} onChange={(e) => setDetails(e.target.value)} className={field} />
            </label>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
