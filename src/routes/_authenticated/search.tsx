import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Search as SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { SetupNotice } from "@/components/DashboardState";
import { DeleteEntryButton } from "@/components/DeleteEntryButton";
import { SelectField } from "@/components/Filters";
import { EmptyState, Panel, SectionHeading } from "@/components/Panels";

import { availableYears } from "@/lib/analytics";
import { dashboardQueryOptions } from "@/lib/dashboard-query";
import { yearOf } from "@/lib/expense-normalize";
import type { ExpenseDataset } from "@/lib/expense-types";
import { MONTH_SHORT, fullDateLabel, money, userLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/search")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQueryOptions),
  head: () => ({
    meta: [
      { title: "Search | Expense Tracker Dashboard" },
      {
        name: "description",
        content:
          "Search household entries by category, month, person or keyword and see the ten most recent matches.",
      },
      { property: "og:title", content: "Search | Expense Tracker Dashboard" },
      {
        property: "og:description",
        content: "Find past entries by category, month, person or keyword.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { data: result } = useSuspenseQuery(dashboardQueryOptions);
  return (
    <AppShell>
      {result.status === "ok" ? (
        <SearchView data={result.data} />
      ) : (
        <SetupNotice result={result} />
      )}
    </AppShell>
  );
}

const LIMIT = 10;

function SearchView({ data }: { data: ExpenseDataset }) {
  const years = useMemo(
    () => availableYears(data.expenses, data.investments, data.loanRepayments),
    [data],
  );
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState<string>(() =>
    years.includes(currentYear) ? String(currentYear) : "all",
  );
  const [month, setMonth] = useState("all");
  const [category, setCategory] = useState("all");
  const [user, setUser] = useState("all");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.expenses
      .filter((e) => {
        if (year !== "all" && yearOf(e.date) !== Number(year)) return false;
        if (month !== "all" && e.date.slice(5, 7) !== month) return false;
        if (category !== "all" && e.category !== category) return false;
        if (user !== "all" && e.user !== user) return false;
        if (
          needle &&
          !`${e.description} ${e.details} ${e.category} ${e.user}`.toLowerCase().includes(needle)
        )
          return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data.expenses, year, month, category, user, query]);

  const rows = matches.slice(0, LIMIT);
  const total = matches.reduce((acc, e) => acc + e.amount, 0);

  const yearOptions = [
    { value: "all", label: "All years" },
    ...years.map((y) => ({ value: String(y), label: String(y) })),
  ];
  const monthOptions = [
    { value: "all", label: "All months" },
    ...MONTH_SHORT.map((m, i) => ({ value: String(i + 1).padStart(2, "0"), label: m })),
  ];
  const categoryOptions = [
    { value: "all", label: "All categories" },
    ...Array.from(new Set(data.expenses.map((e) => e.category).filter(Boolean)))
      .sort()
      .map((c) => ({ value: c, label: c })),
  ];
  const userOptions = [
    { value: "all", label: "Everyone" },
    ...data.users.map((u) => ({ value: u, label: userLabel(u) })),
  ];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
          Search
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Pick a category or month to see the latest {LIMIT} matching entries.
        </p>
      </header>

      <Panel>
        <div className="space-y-3">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search description, details or category"
              aria-label="Search entries"
              className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <SelectField
              value={category}
              onChange={setCategory}
              options={categoryOptions}
              ariaLabel="Category"
            />
            <SelectField
              value={month}
              onChange={setMonth}
              options={monthOptions}
              ariaLabel="Month"
            />
            <SelectField value={year} onChange={setYear} options={yearOptions} ariaLabel="Year" />
            <SelectField value={user} onChange={setUser} options={userOptions} ariaLabel="Person" />
          </div>
        </div>
      </Panel>

      <section>
        <SectionHeading
          title="Results"
          description={
            matches.length === 0
              ? "No matching entries."
              : `${matches.length} match${matches.length === 1 ? "" : "es"} · ${money(total)} total${
                  matches.length > LIMIT ? ` · showing latest ${LIMIT}` : ""
                }`
          }
        />
        {notice ? (
          <p className="mb-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {notice}
          </p>
        ) : null}
        <Panel>
          {rows.length === 0 ? (
            <EmptyState message="Nothing found. Try a different category, month or keyword." />
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((expense, i) => (
                <li
                  key={`${expense.sheet}-${expense.date}-${i}`}
                  className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <span className="num mt-0.5 w-6 shrink-0 text-xs text-muted-foreground">
                    #{i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {expense.description || expense.category}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {fullDateLabel(expense.date)} · {expense.category} ·{" "}
                      {userLabel(expense.user)}
                    </p>
                    {expense.details ? (
                      <p className="mt-1 truncate text-xs text-muted-foreground/80">
                        {expense.details}
                      </p>
                    ) : null}
                  </div>
                  <span className="num shrink-0 text-sm font-semibold text-foreground">
                    {money(expense.amount)}
                  </span>
                  <DeleteEntryButton expense={expense} onDeleted={setNotice} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>
    </div>
  );
}
