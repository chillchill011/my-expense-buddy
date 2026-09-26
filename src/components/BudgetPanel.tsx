import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pencil } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState, Panel, SectionHeading } from "@/components/Panels";
import { SelectField } from "@/components/Filters";
import { byMonth } from "@/lib/analytics";
import { dashboardQueryOptions } from "@/lib/dashboard-query";
import { setMonthlyBudget } from "@/lib/expense.functions";
import type { ExpenseDataset } from "@/lib/expense-types";
import { money, monthLabel } from "@/lib/format";

type Period = "this-month" | "last-month" | "this-year" | "last-year" | "all";

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "this-year", label: "This year" },
  { value: "last-year", label: "Last year" },
  { value: "all", label: "All time" },
];

function prevMonth(key: string): string {
  const [ys, ms] = key.split("-");
  let year = Number(ys);
  let month = Number(ms) - 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function BudgetPanel({ data, month }: { data: ExpenseDataset; month: string }) {
  const queryClient = useQueryClient();
  const save = useServerFn(setMonthlyBudget);

  const budgets = data.budgets ?? [];
  const budgetOf = (key: string) => budgets.find((b) => b.month === key)?.amount ?? null;

  const spendByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of byMonth(data.expenses)) map.set(b.key, b.total);
    return map;
  }, [data.expenses]);

  const loanByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of byMonth(data.loanRepayments ?? [])) map.set(b.key, b.total);
    return map;
  }, [data.loanRepayments]);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [period, setPeriod] = useState<Period>("this-year");

  const months = useMemo(() => {
    const keys = new Set<string>([
      ...spendByMonth.keys(),
      ...loanByMonth.keys(),
      ...budgets.map((b) => b.month),
      currentMonth,
    ]);
    const all = Array.from(keys).sort((a, b) => (a < b ? 1 : -1));
    const thisYear = String(now.getFullYear());
    const lastYear = String(now.getFullYear() - 1);
    if (period === "this-month") return all.filter((k) => k === currentMonth);
    if (period === "last-month") return all.filter((k) => k === prevMonth(currentMonth));
    if (period === "this-year") return all.filter((k) => k.startsWith(thisYear));
    if (period === "last-year") return all.filter((k) => k.startsWith(lastYear));
    return all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, spendByMonth, loanByMonth, budgets, currentMonth]);

  const selectedBudget = budgetOf(month);
  const spent = spendByMonth.get(month) ?? 0;
  const loans = loanByMonth.get(month) ?? 0;
  const outflow = spent + loans;
  const pct = selectedBudget && selectedBudget > 0 ? (spent / selectedBudget) * 100 : 0;

  const [editing, setEditing] = useState(false);
  const [editMonth, setEditMonth] = useState(month);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(key: string) {
    setEditMonth(key);
    setEditing(true);
    setError(null);
    const b = budgetOf(key);
    setValue(b !== null ? String(b) : "");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a budget amount.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await save({ data: { month: editMonth, amount, notes: "" } }).catch((err: unknown) => ({
      status: "error" as const,
      message: err instanceof Error ? err.message : String(err),
    }));
    setBusy(false);
    if (result.status !== "saved") {
      setError("message" in result ? result.message : "Couldn't save that budget.");
      return;
    }
    setEditing(false);
    setValue("");
    void queryClient.invalidateQueries({ queryKey: dashboardQueryOptions.queryKey });
  }

  return (
    <Panel>
      <SectionHeading
        title="Monthly budget"
        description={`Spending against your limit for ${monthLabel(month)}`}
      />

      {selectedBudget === null ? (
        <p className="text-sm text-muted-foreground">
          No budget set for {monthLabel(month)} yet.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="num text-lg font-semibold text-foreground">{money(spent)}</span>
            <span className="text-sm text-muted-foreground">
              of <span className="num">{money(selectedBudget)}</span> ·{" "}
              {selectedBudget > spent
                ? `${money(selectedBudget - spent)} left`
                : `${money(spent - selectedBudget)} over`}
            </span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-[width] duration-700 ${
                pct > 100 ? "bg-destructive" : "bg-positive"
              }`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {pct.toFixed(0)}% used · loan repayments {money(loans)} · total out {money(outflow)}
          </p>
        </>
      )}

      {editing ? (
        <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
            type="number"
            min="0"
            step="1"
            inputMode="decimal"
            placeholder={`Budget for ${monthLabel(editMonth)}`}
            aria-label="Budget amount"
            className="h-9 w-44 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          />
          <span className="text-xs text-muted-foreground">for {monthLabel(editMonth)}</span>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="h-9 rounded-lg px-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => startEdit(month)}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          <Pencil className="size-3.5" />
          {selectedBudget === null ? "Set a budget" : "Change budget"}
        </button>
      )}

      {error ? <p className="mt-2 text-xs font-medium text-destructive">{error}</p> : null}

      <div className="mt-5 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-foreground">Budget history</h3>
        <SelectField
          ariaLabel="Choose period"
          value={period}
          onChange={(next: string) => setPeriod(next as Period)}
          options={PERIODS}
        />
      </div>

      {months.length === 0 ? (
        <div className="mt-3">
          <EmptyState message="No data for this period." />
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {months.map((key) => {
            const budget = budgetOf(key);
            const monthSpend = spendByMonth.get(key) ?? 0;
            const monthLoans = loanByMonth.get(key) ?? 0;
            return (
              <li key={key} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-sm text-foreground">{monthLabel(key)}</span>
                <span className="flex items-center gap-2">
                  <span className="num text-xs text-muted-foreground">
                    {budget === null ? "No budget set" : `Budget ${money(budget)}`} · Spent{" "}
                    {money(monthSpend)} · Out {money(monthSpend + monthLoans)}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(key)}
                    aria-label={`Edit budget for ${monthLabel(key)}`}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
