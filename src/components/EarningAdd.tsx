import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Plus, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dashboardQueryOptions } from "@/lib/dashboard-query";
import { addEarning, undoEarning } from "@/lib/expense.functions";
import type { ExpenseDataset } from "@/lib/expense-types";
import { DEFAULT_EARNING_CATEGORIES } from "@/lib/earnings";
import { money, userLabel } from "@/lib/format";
import { peopleWithMe, useEntryName } from "@/lib/use-entry-name";

const USER_STORAGE_KEY = "expense-quick-add-user";
const fieldClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40";

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

type SavedEarning = {
  row: number | null;
  amount: number;
  category: string;
  user: string;
  date: string;
  description: string;
};

export function EarningAdd({ data }: { data: ExpenseDataset }) {
  const queryClient = useQueryClient();
  const save = useServerFn(addEarning);
  const undo = useServerFn(undoEarning);
  const me = useEntryName();
  const people = peopleWithMe(data.users, me);
  const categories = useMemo(
    () => Array.from(new Set([...DEFAULT_EARNING_CATEGORIES, ...data.earningCategories])).sort((a, b) => a.localeCompare(b)),
    [data.earningCategories],
  );
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso);
  const [category, setCategory] = useState("");
  const [user, setUser] = useState(people[0] ?? "");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<SavedEarning | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(USER_STORAGE_KEY);
    if (stored && people.includes(stored)) setUser(stored);
    else if (!user || !people.includes(user)) setUser(me || people[0] || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.users.join("|"), me]);

  function chooseUser(next: string) {
    setUser(next);
    window.localStorage.setItem(USER_STORAGE_KEY, next);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const value = Number(amount);
    const today = todayIso();
    if (!Number.isFinite(value) || value <= 0) return setError("Enter an amount greater than zero.");
    if (!date || date > today) return setError("Pick today or an earlier date.");
    if (!category) return setError("Choose an earning category.");
    if (!user) return setError("Choose who received this earning.");

    setBusy(true);
    setError("");
    const result = await save({ data: { amount: value, date, category, user, description } }).catch(
      (err: unknown) => ({ status: "error" as const, message: err instanceof Error ? err.message : String(err) }),
    );
    setBusy(false);
    if (result.status !== "added") {
      setError("message" in result ? result.message : "Couldn't save this earning.");
      return;
    }
    setSaved({ row: result.row, amount: value, category, user, date: result.date, description });
    setAmount("");
    setDescription("");
    setDate(today);
    setOpen(false);
    void queryClient.invalidateQueries({ queryKey: dashboardQueryOptions.queryKey });
  }

  async function undoSaved() {
    if (!saved || saved.row === null) return;
    setBusy(true);
    const result = await undo({ data: { ...saved, row: saved.row } }).catch(() => ({
      status: "skipped" as const,
      message: "Couldn't undo this earning.",
    }));
    setBusy(false);
    if (result.status === "skipped") setError(result.message ?? "Couldn't undo this earning.");
    else setSaved(null);
    void queryClient.invalidateQueries({ queryKey: dashboardQueryOptions.queryKey });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" onClick={() => { setError(""); setOpen(true); }}>
        <Plus /> Add earning
      </Button>
      {saved ? (
        <div className="flex max-w-full items-center gap-2 text-xs text-muted-foreground">
          <Check className="size-4 shrink-0 text-positive" />
          <span className="truncate">{money(saved.amount)} · {saved.category} · {userLabel(saved.user)}</span>
          {saved.row !== null ? (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void undoSaved()}>
              Undo
            </Button>
          ) : null}
        </div>
      ) : null}
      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add earning</DialogTitle>
            <DialogDescription>Save income to your household sheet.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void submit(event)} className="space-y-3">
            <label className="block space-y-1 text-xs font-medium text-muted-foreground">
              Amount (₹)
              <input autoFocus inputMode="decimal" type="number" min="0" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} className={fieldClass} />
            </label>
            <label className="block space-y-1 text-xs font-medium text-muted-foreground">
              Date
              <input type="date" max={todayIso()} value={date} onChange={(event) => setDate(event.target.value)} className={fieldClass} />
            </label>
            <label className="block space-y-1 text-xs font-medium text-muted-foreground">
              Category
              <select value={category} onChange={(event) => setCategory(event.target.value)} className={fieldClass}>
                <option value="">Choose a category</option>
                {categories.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <label className="block space-y-1 text-xs font-medium text-muted-foreground">
              Received by
              <select value={user} onChange={(event) => chooseUser(event.target.value)} className={fieldClass}>
                {people.map((person) => <option key={person} value={person}>{userLabel(person)}</option>)}
              </select>
            </label>
            <label className="block space-y-1 text-xs font-medium text-muted-foreground">
              Description (optional)
              <input value={description} onChange={(event) => setDescription(event.target.value)} className={fieldClass} />
            </label>
            {error ? <p role="alert" className="text-xs font-medium text-destructive">{error}</p> : null}
            <DialogFooter>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Send />} Save earning
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}