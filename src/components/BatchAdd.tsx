import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Send } from "lucide-react";
import { useMemo, useState } from "react";

import { dashboardQueryOptions } from "@/lib/dashboard-query";
import { addExpenses, undoExpense } from "@/lib/expense.functions";
import { matchCategory, parseEntry } from "@/lib/expense-parse";
import type { ExpenseDataset } from "@/lib/expense-types";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

type SavedBatch = {
  tab: string;
  firstRow: number | null;
  items: Array<{ amount: number; description: string }>;
  total: number;
};

/** Multi-line expense entry: one expense per line, saved together. */
export function BatchAdd({ data, user }: { data: ExpenseDataset; user: string }) {
  const queryClient = useQueryClient();
  const save = useServerFn(addExpenses);
  const undo = useServerFn(undoExpense);

  const [text, setText] = useState("");
  const [picked, setPicked] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedBatch | null>(null);

  const lines = useMemo(
    () =>
      text
        .split("\n")
        .map((raw, index) => ({ raw: raw.trim(), index }))
        .filter((l) => l.raw)
        .map((l) => {
          const parsed = parseEntry(l.raw);
          if (!parsed.ok) return { ...l, ok: false as const, message: parsed.message };
          const auto = matchCategory(parsed.entry.description, data.rules);
          return { ...l, ok: true as const, entry: parsed.entry, category: picked[l.index] ?? auto ?? "" };
        }),
    [text, picked, data.rules],
  );

  const valid = lines.filter((l) => l.ok);
  const hasBad = lines.some((l) => !l.ok);
  const needsCategory = valid.some((l) => l.ok && !l.category);
  const total = valid.reduce((s, l) => s + (l.ok ? l.entry.amount : 0), 0);
  const canSave = valid.length > 0 && !hasBad && !needsCategory && !busy;

  async function submit() {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    const entries = valid.map((l) => (l.ok ? { ...l.entry, category: l.category, user } : null!));
    const result = await save({ data: { entries } }).catch((err: unknown) => ({
      status: "error" as const,
      message: err instanceof Error ? err.message : String(err),
    }));
    setBusy(false);
    if (result.status !== "added") {
      setError(result.message);
      return;
    }
    setSaved({
      tab: result.tab,
      firstRow: result.firstRow,
      items: entries.map((e) => ({ amount: e.amount, description: e.description })),
      total,
    });
    setText("");
    setPicked({});
    void queryClient.invalidateQueries({ queryKey: dashboardQueryOptions.queryKey });
  }

  async function undoAll() {
    if (!saved || saved.firstRow === null) return;
    setBusy(true);
    // Remove from the bottom up so earlier row numbers stay valid.
    for (let i = saved.items.length - 1; i >= 0; i--) {
      const item = saved.items[i]!;
      await undo({
        data: { tab: saved.tab, row: saved.firstRow + i, amount: item.amount, description: item.description },
      }).catch(() => null);
    }
    setBusy(false);
    setSaved(null);
    void queryClient.invalidateQueries({ queryKey: dashboardQueryOptions.queryKey });
  }

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
          setSaved(null);
        }}
        rows={5}
        placeholder={"50 milk\n20+23+77 vegetables, weekly market\n250 petrol"}
        aria-label="Add several expenses, one per line"
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
      />

      {lines.length > 0 ? (
        <ol className="space-y-1.5">
          {lines.map((l, i) => (
            <li
              key={l.index}
              className={cn(
                "flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs",
                l.ok ? "border-border bg-muted/40" : "border-destructive/40 bg-destructive/5",
              )}
            >
              <span className="num text-muted-foreground">{i + 1}.</span>
              {l.ok ? (
                <>
                  <span className="num font-semibold text-foreground">{money(l.entry.amount)}</span>
                  <span className="text-foreground">
                    {l.entry.description}
                    {l.entry.details ? <span className="text-muted-foreground"> ({l.entry.details})</span> : null}
                  </span>
                  <select
                    aria-label={`Category for line ${i + 1}`}
                    value={l.category}
                    onChange={(e) => setPicked((p) => ({ ...p, [l.index]: e.target.value }))}
                    className={cn(
                      "ml-auto h-7 rounded-md border bg-background px-1.5 text-xs text-foreground",
                      l.category ? "border-input" : "border-destructive",
                    )}
                  >
                    <option value="">Pick category…</option>
                    {data.categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <span className="text-destructive">
                  “{l.raw}” — {l.message}
                </span>
              )}
            </li>
          ))}
        </ol>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          One expense per line. {valid.length > 0 ? `${valid.length} entries · ${money(total)}` : null}
        </span>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSave}
          className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {valid.length > 0 ? `Add ${valid.length} (${money(total)})` : "Add all"}
        </button>
      </div>

      {needsCategory ? (
        <p className="text-xs text-muted-foreground">Pick a category for the highlighted lines.</p>
      ) : null}
      {hasBad ? <p className="text-xs text-destructive">Fix the red lines before saving.</p> : null}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}

      {saved ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 p-2.5 text-xs">
          <Check className="size-4 text-positive" />
          <span className="text-foreground">
            Added {saved.items.length} entries · <span className="num font-semibold">{money(saved.total)}</span>
          </span>
          {saved.firstRow !== null ? (
            <button
              type="button"
              onClick={() => void undoAll()}
              disabled={busy}
              className="ml-auto rounded-md px-2 py-1 font-medium text-muted-foreground hover:text-foreground hover:underline disabled:opacity-60"
            >
              Undo all
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
