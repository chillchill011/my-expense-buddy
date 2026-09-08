import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { dashboardQueryOptions } from "@/lib/dashboard-query";
import { addExpense, undoExpense } from "@/lib/expense.functions";
import { matchCategory, parseEntry, type ParsedEntry } from "@/lib/expense-parse";
import type { ExpenseDataset } from "@/lib/expense-types";
import { money, userLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

const USER_STORAGE_KEY = "expense-quick-add-user";

type Saved = {
  tab: string;
  row: number | null;
  amount: number;
  description: string;
  category: string;
  user: string;
};

export function QuickAdd({ data }: { data: ExpenseDataset }) {
  const queryClient = useQueryClient();
  const save = useServerFn(addExpense);
  const undo = useServerFn(undoExpense);
  const inputRef = useRef<HTMLInputElement>(null);

  const people = data.users.length ? data.users : ["aniketthanage", "gauri_2009"];
  // Several sheet handles collapse to the same friendly name, so show the raw
  // handle whenever the label alone would be ambiguous.
  const labelCounts = new Map<string, number>();
  for (const person of people) {
    labelCounts.set(userLabel(person), (labelCounts.get(userLabel(person)) ?? 0) + 1);
  }
  const personLabel = (person: string) =>
    (labelCounts.get(userLabel(person)) ?? 0) > 1 ? person : userLabel(person);
  const [user, setUser] = useState(people[0]!);

  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [pending, setPending] = useState<ParsedEntry | null>(null);

  // Remember the last person used on this device until real logins arrive.
  useEffect(() => {
    const stored = window.localStorage.getItem(USER_STORAGE_KEY);
    if (stored && people.includes(stored)) setUser(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.users.join("|")]);

  function chooseUser(next: string) {
    setUser(next);
    window.localStorage.setItem(USER_STORAGE_KEY, next);
  }

  async function commit(entry: ParsedEntry, category: string) {
    setBusy(true);
    setError(null);
    setPending(null);

    const result = await save({
      data: { ...entry, category, user },
    }).catch((err: unknown) => ({
      status: "error" as const,
      message: err instanceof Error ? err.message : String(err),
    }));

    setBusy(false);

    if (result.status !== "added") {
      setError("message" in result ? result.message : "Couldn't save that entry.");
      return;
    }

    setSaved({
      tab: result.tab,
      row: result.row,
      amount: entry.amount,
      description: entry.description,
      category,
      user,
    });
    setValue("");
    inputRef.current?.focus();
    void queryClient.invalidateQueries({ queryKey: dashboardQueryOptions.queryKey });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    const parsed = parseEntry(value);
    if (!parsed.ok) {
      setError(parsed.message);
      setPending(null);
      return;
    }

    setSaved(null);
    const category = matchCategory(parsed.entry.description, data.rules);
    if (!category) {
      setError(null);
      setPending(parsed.entry);
      return;
    }
    void commit(parsed.entry, category);
  }

  async function removeLast() {
    if (!saved || saved.row === null) return;
    setBusy(true);
    const result = await undo({
      data: {
        tab: saved.tab,
        row: saved.row,
        amount: saved.amount,
        description: saved.description,
      },
    }).catch(() => ({ status: "skipped" as const, message: "Couldn't undo that." }));
    setBusy(false);
    setSaved(null);
    if (result.status === "skipped" && result.message) setError(result.message);
    void queryClient.invalidateQueries({ queryKey: dashboardQueryOptions.queryKey });
  }

  const categoryChoices = data.categories.slice(0, 40);

  return (
    <section className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          placeholder="250 lunch with team, office card"
          aria-label="Add an expense"
          autoComplete="off"
          className="h-10 min-w-48 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
        />
        <select
          aria-label="Save as"
          value={user}
          onChange={(event) => chooseUser(event.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-2.5 text-xs font-medium text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          {people.map((person) => (
            <option key={person} value={person}>
              {userLabel(person)}
            </option>
          ))}
        </select>
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
        Type it just like your bot: amount first, then what it was for, and anything after a comma
        becomes extra details.
      </p>

      {error ? <p className="mt-2 text-xs font-medium text-destructive">{error}</p> : null}

      {pending ? (
        <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">
            No category matched <span className="font-medium text-foreground">{pending.description}</span> — pick one:
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {categoryChoices.map((category) => (
              <button
                key={category}
                type="button"
                disabled={busy}
                onClick={() => void commit(pending, category)}
                className={cn(
                  "rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground",
                  "transition-colors hover:border-ring hover:text-primary disabled:opacity-60",
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {saved ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 p-2.5 text-xs">
          <Check className="size-4 text-positive" />
          <span className="text-foreground">
            <span className="num font-semibold">{money(saved.amount)}</span> · {saved.description} ·{" "}
            {saved.category} · {userLabel(saved.user)}
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
