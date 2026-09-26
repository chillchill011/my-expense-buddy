import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { dashboardQueryOptions } from "@/lib/dashboard-query";
import { addInvestment, undoInvestment } from "@/lib/expense.functions";
import type { ExpenseDataset } from "@/lib/expense-types";
import { money, userLabel } from "@/lib/format";

const USER_STORAGE_KEY = "expense-quick-add-user";

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

type Saved = {
  tab: string;
  row: number | null;
  amount: number;
  category: string;
  user: string;
  date: string;
  createdTab?: boolean;
};

const fieldClass =
  "h-10 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40";

export function InvestmentAdd({ data }: { data: ExpenseDataset }) {
  const queryClient = useQueryClient();
  const save = useServerFn(addInvestment);
  const undo = useServerFn(undoInvestment);

  const people = data.users.length ? data.users : ["aniketthanage", "gauri_2009"];
  const labelCounts = new Map<string, number>();
  for (const person of people) {
    labelCounts.set(userLabel(person), (labelCounts.get(userLabel(person)) ?? 0) + 1);
  }
  const personLabel = (person: string) =>
    (labelCounts.get(userLabel(person)) ?? 0) > 1 ? person : userLabel(person);

  const categories = useMemo(() => {
    const fromMaster = data.investmentAccounts.map((a) => a.category).filter(Boolean);
    const fromRows = data.investments.map((i) => i.category).filter(Boolean);
    return Array.from(new Set([...fromMaster, ...fromRows])).sort((a, b) => a.localeCompare(b));
  }, [data.investmentAccounts, data.investments]);

  const today = todayIso();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState("");
  const [user, setUser] = useState(people[0]!);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(USER_STORAGE_KEY);
    if (stored && people.includes(stored)) setUser(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.users.join("|")]);

  function chooseUser(next: string) {
    setUser(next);
    window.localStorage.setItem(USER_STORAGE_KEY, next);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!date || date > today) {
      setError("Pick today or an earlier date.");
      return;
    }
    if (!category) {
      setError("Choose a category.");
      return;
    }
    if (!user) {
      setError("Choose who this is for.");
      return;
    }

    setBusy(true);
    setError(null);
    setSaved(null);

    const result = await save({
      data: { amount: value, date, category, user, description },
    }).catch((err: unknown) => ({
      status: "error" as const,
      message: err instanceof Error ? err.message : String(err),
    }));

    setBusy(false);

    if (result.status !== "added") {
      setError("message" in result ? result.message : "Couldn't save that investment.");
      return;
    }

    setSaved({
      tab: result.tab,
      row: result.row,
      amount: value,
      category,
      user,
      date: result.date,
      createdTab: result.createdTab === true,
    });
    setAmount("");
    setDescription("");
    setCategory("");
    setDate(today);
    void queryClient.invalidateQueries({ queryKey: dashboardQueryOptions.queryKey });
  }

  async function removeLast() {
    if (!saved || saved.row === null) return;
    setBusy(true);
    const result = await undo({
      data: { tab: saved.tab, row: saved.row, amount: saved.amount, category: saved.category },
    }).catch(() => ({ status: "skipped" as const, message: "Couldn't undo that." }));
    setBusy(false);
    setSaved(null);
    if (result.status === "skipped" && result.message) setError(result.message);
    void queryClient.invalidateQueries({ queryKey: dashboardQueryOptions.queryKey });
  }

  return (
    <section className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <input
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value);
            setError(null);
          }}
          inputMode="decimal"
          type="number"
          min="0"
          step="0.01"
          placeholder="Amount"
          aria-label="Amount"
          className={`${fieldClass} w-28`}
        />
        <input
          type="date"
          value={date}
          max={today}
          onChange={(event) => {
            setDate(event.target.value);
            setError(null);
          }}
          aria-label="Date"
          className={`${fieldClass} w-40`}
        />
        <select
          aria-label="Category"
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setError(null);
          }}
          className={`${fieldClass} min-w-40`}
        >
          <option value="">Select category</option>
          {categories.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Save as"
          value={user}
          onChange={(event) => chooseUser(event.target.value)}
          className={`${fieldClass} min-w-32`}
        >
          {people.map((person) => (
            <option key={person} value={person}>
              {personLabel(person)}
            </option>
          ))}
        </select>
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Description (optional)"
          aria-label="Description"
          autoComplete="off"
          className={`${fieldClass} min-w-48 flex-1`}
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Add
        </button>
      </form>

      <p className="mt-2 text-xs text-muted-foreground">
        Saved to the overview tab for the year you pick. Future dates aren't allowed.
      </p>

      {error ? <p className="mt-2 text-xs font-medium text-destructive">{error}</p> : null}

      {saved ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 p-2.5 text-xs">
          <Check className="size-4 text-positive" />
          <span className="text-foreground">
            <span className="num font-semibold">{money(saved.amount)}</span> · {saved.category} ·{" "}
            {userLabel(saved.user)} · {saved.date}
          </span>
          {saved.row !== null ? (
            <button
              type="button"
              onClick={() => void removeLast()}
              disabled={busy}
              className="ml-auto rounded-md px-2 py-1 font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-60"
            >
              Undo
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
