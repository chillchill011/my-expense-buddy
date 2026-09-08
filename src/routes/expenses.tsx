import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/AppShell";
import { SetupNotice } from "@/components/DashboardState";
import { SelectField } from "@/components/Filters";
import {
  ChartTooltip,
  EmptyState,
  Panel,
  RankedBars,
  SectionHeading,
} from "@/components/Panels";
import { StatCard } from "@/components/StatCard";
import { availableYears, byCategory, monthlySeries, sum } from "@/lib/analytics";
import { dashboardQueryOptions } from "@/lib/dashboard-query";
import { yearOf } from "@/lib/expense-normalize";
import type { ExpenseDataset } from "@/lib/expense-types";
import { fullDateLabel, money, moneyCompact, userLabel } from "@/lib/format";

export const Route = createFileRoute("/expenses")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQueryOptions),
  head: () => ({
    meta: [
      { title: "Expenses | Expense Tracker Dashboard" },
      {
        name: "description",
        content:
          "Search and filter every household expense by category, person and description, with a month-by-month spending trend for the year.",
      },
      { property: "og:title", content: "Expenses | Expense Tracker Dashboard" },
      {
        property: "og:description",
        content: "Search and filter every household expense by category, person and description.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const { data: result } = useSuspenseQuery(dashboardQueryOptions);
  return (
    <AppShell>
      {result.status === "ok" ? <Expenses data={result.data} /> : <SetupNotice result={result} />}
    </AppShell>
  );
}

function Expenses({ data }: { data: ExpenseDataset }) {
  const years = useMemo(
    () => availableYears(data.expenses, data.investments, data.loanRepayments),
    [data],
  );
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(() =>
    years.includes(currentYear) ? currentYear : (years[0] ?? currentYear),
  );
  const [month, setMonth] = useState("all");
  const [category, setCategory] = useState("all");
  const [user, setUser] = useState("all");
  const [search, setSearch] = useState("");

  const yearExpenses = useMemo(
    () => data.expenses.filter((e) => yearOf(e.date) === year),
    [data.expenses, year],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return yearExpenses.filter((e) => {
      if (month !== "all" && e.date.slice(5, 7) !== month) return false;
      if (category !== "all" && e.category !== category) return false;
      if (user !== "all" && e.user !== user) return false;
      if (needle && !`${e.description} ${e.details} ${e.category}`.toLowerCase().includes(needle))
        return false;
      return true;
    });
  }, [yearExpenses, month, category, user, search]);

  const series = useMemo(() => monthlySeries(filtered, year), [filtered, year]);
  const total = sum(filtered);
  const busiest = series.reduce((a, b) => (b.total > a.total ? b : a), series[0]!);

  const categoryOptions = [
    { value: "all", label: "All categories" },
    ...Array.from(new Set(yearExpenses.map((e) => e.category)))
      .sort()
      .map((c) => ({ value: c, label: c })),
  ];
  const userOptions = [
    { value: "all", label: "Everyone" },
    ...data.users.map((u) => ({ value: u, label: userLabel(u) })),
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          Expenses
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every entry your bot has logged, searchable.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <SelectField
          ariaLabel="Choose year"
          value={String(year)}
          onChange={(v) => setYear(Number(v))}
          options={years.map((y) => ({ value: String(y), label: String(y) }))}
        />
        <SelectField
          ariaLabel="Filter by category"
          value={category}
          onChange={setCategory}
          options={categoryOptions}
        />
        <SelectField
          ariaLabel="Filter by person"
          value={user}
          onChange={setUser}
          options={userOptions}
        />
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search description…"
            aria-label="Search descriptions"
            className="h-9 w-full rounded-lg border border-input bg-card pl-8 pr-3 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={`Total in ${year}`} value={money(total)} tone="primary" />
        <StatCard label="Entries" value={String(filtered.length)} />
        <StatCard
          label="Busiest month"
          value={busiest && busiest.total > 0 ? busiest.month : "—"}
          hint={busiest && busiest.total > 0 ? money(busiest.total) : "Nothing recorded"}
        />
      </div>

      <Panel>
        <SectionHeading title="Monthly trend" description={`Spending pattern through ${year}`} />
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(value) => moneyCompact(Number(value))}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              />
              <Tooltip cursor={{ fill: "var(--color-muted)" }} content={<ChartTooltip />} />
              <Bar
                dataKey="total"
                name="Spent"
                fill="var(--color-chart-1)"
                radius={[5, 5, 0, 0]}
                maxBarSize={38}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-2">
          <SectionHeading title="By category" />
          <RankedBars buckets={byCategory(filtered)} limit={10} />
        </Panel>

        <Panel className="lg:col-span-3">
          <SectionHeading
            title="Transactions"
            description={`Showing ${Math.min(filtered.length, 60)} of ${filtered.length}`}
          />
          {filtered.length === 0 ? (
            <EmptyState message="No transactions match these filters." />
          ) : (
            <div className="-mx-1 max-h-[30rem] overflow-y-auto px-1">
              <ul className="divide-y divide-border">
                {filtered.slice(0, 60).map((expense, i) => (
                  <li key={i} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {expense.description || expense.category}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {expense.category} · {userLabel(expense.user)} ·{" "}
                        {fullDateLabel(expense.date)}
                      </p>
                    </div>
                    <span className="num shrink-0 text-sm font-semibold text-foreground">
                      {money(expense.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
