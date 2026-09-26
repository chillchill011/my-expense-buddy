import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { dashboardQueryOptions } from "@/lib/dashboard-query";
import { addLoanRepayment, undoLoanRepayment } from "@/lib/expense.functions";
import type { ExpenseDataset } from "@/lib/expense-types";
import { money, userLabel } from "@/lib/format";
import { peopleWithMe, useEntryName } from "@/lib/use-entry-name";

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
  loan: string;
  date: string;
};

const fieldClass =
  "h-10 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40";

export function LoanRepaymentAdd({ data }: { data: ExpenseDataset }) {
  const queryClient = useQueryClient();
  const save = useServerFn(addLoanRepayment);
  const undo = useServerFn(undoLoanRepayment);

  const me = useEntryName();
  const people = peopleWithMe(data.users, me);
  const labelCounts = new Map<string, number>();
  for (const person of people) {
    labelCounts.set(userLabel(person), (labelCounts.get(userLabel(person)) ?? 0) + 1);
  }
  const personLabel = (person: string) =>
    (labelCounts.get(userLabel(person)) ?? 0) > 1 ? person : userLabel(person);

  const loans = useMemo(() => {
    const fromMaster = data.loanAccounts.map((a) => a.category).filter(Boolean);
    const fromRows = (data.loanRepayments ?? []).map((r) => r.loan).filter(Boolean);
    return Array.from(new Set([...fromMaster, ...fromRows])).sort((a, b) => a.localeCompare(b));
  }, [data.loanAccounts, data.loanRepayments]);

  const today = todayIso();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [loan, setLoan] = useState("");
  const [user, setUser] = useState(people[0] ?? "");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);

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
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!date || date > today) {
      setError("Pick today or an earlier date.");
      return;
    }
    if (!loan) {
      setError("Choose which loan this repays.");
      return;
    }

    setBusy(true);
    setError(null);
    setSaved(null);

    const result = await save({ data: { amount: value, date, loan, user, description } }).catch(
      (err: unknown) => ({
        status: "error" as const,
        message: err instanceof Error ? err.message : String(err),
      }),
    );

    setBusy(false);

    if (result.status !== "added") {
      setError("message" in result ? result.message : "Couldn't save that repayment.");
      return;
    }

    setSaved({ tab: result.tab, row: result.row, amount: value, loan, date: result.date });
    setAmount("");
    setDescription("");
    setDate(today);
    void queryClient.invalidateQueries({ queryKey: dashboardQueryOptions.queryKey });
  }

  async function removeLast() {
    if (!saved || saved.row === null) return;
    setBusy(true);
    const result = await undo({
      data: { tab: saved.tab, row: saved.row, amount: saved.amount, loan: saved.loan },
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
          placeholder="Amount paid"
          aria-label="Amount"
          className={`${fieldClass} w-32`}
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
          aria-label="Loan"
          value={loan}
          onChange={(event) => {
            setLoan(event.target.value);
            setError(null);
          }}
          className={`${fieldClass} min-w-40`}
        >
          <option value="">Select loan</option>
          {loans.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Paid by"
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
          placeholder="Note (optional)"
          aria-label="Note"
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
        {loans.length === 0
          ? "No loans listed yet — add them to the “Loan Master” tab of your sheet and they will appear here."
          : "Enter the full amount paid, interest included. Future dates aren't allowed."}
      </p>


      {error ? <p className="mt-2 text-xs font-medium text-destructive">{error}</p> : null}

      {saved ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 p-2.5 text-xs">
          <Check className="size-4 text-positive" />
          <span className="text-foreground">
            <span className="num font-semibold">{money(saved.amount)}</span> · {saved.loan} ·{" "}
            {saved.date}
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
