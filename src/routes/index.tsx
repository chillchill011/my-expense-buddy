import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownRight, Receipt, TrendingUp, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { DataQualityNotice, SetupNotice } from "@/components/DashboardState";
import { SelectField } from "@/components/Filters";
import { EmptyState, Panel, RankedBars, SectionHeading, UserSplit } from "@/components/Panels";
import { DeltaBadge, StatCard } from "@/components/StatCard";
import {
  availableMonths,
  byCategory,
  byUser,
  inMonth,
  inYear,
  pctChange,
  previousMonthKey,
  sum,
} from "@/lib/analytics";
import { dashboardQueryOptions } from "@/lib/dashboard-query";
import { yearOf } from "@/lib/expense-normalize";
import type { Expense, ExpenseDataset } from "@/lib/expense-types";
import { dayLabel, money, monthLabel, userLabel } from "@/lib/format";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQueryOptions),
  head: () => ({
    meta: [
      { title: "Overview | Expense Tracker Dashboard" },
      {
        name: "description",
        content:
          "Monthly household spending at a glance: totals, category breakdown, who spent what, and the latest transactions from your expense sheet.",
      },
      { property: "og:title", content: "Overview | Expense Tracker Dashboard" },
      {
        property: "og:description",
        content: "Monthly household spending at a glance, straight from your expense sheet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  const { data: result } = useSuspenseQuery(dashboardQueryOptions);

  if (result.status !== "ok") {
    return (
      <AppShell>
        <SetupNotice result={result} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Overview data={result.data} />
    </AppShell>
  );
}

function Overview({ data }: { data: ExpenseDataset }) {
  const { expenses, investments, loanRepayments, issues } = data;

  const months = useMemo(() => availableMonths(expenses), [expenses]);
  const [month, setMonth] = useState(() => months[0] ?? "");

  const monthExpenses = useMemo(() => inMonth(expenses, month), [expenses, month]);
  const prevKey = previousMonthKey(month || "2000-01");
  const prevExpenses = useMemo(() => inMonth(expenses, prevKey), [expenses, prevKey]);

  const total = sum(monthExpenses);
  const change = pctChange(total, sum(prevExpenses));

  const year = month ? Number(month.slice(0, 4)) : new Date().getFullYear();
  const yearInvested = sum(inYear(investments, year));
  const yearRepaid = sum(inYear(loanRepayments, year));

  const recent = monthExpenses.slice(0, 8);

  if (months.length === 0) {
    return <EmptyState message="No expenses found in your sheet yet." />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            {monthLabel(month)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {monthExpenses.length} transactions recorded
          </p>
        </div>
        <SelectField
          ariaLabel="Choose month"
          value={month}
          onChange={setMonth}
          options={months.map((key: string) => ({ value: key, label: monthLabel(key) }))}
        />
      </header>

      <DataQualityNotice issues={issues} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Spent this month"
          value={money(total)}
          tone="primary"
          icon={<Wallet className="size-4" />}
          hint={
            <span className="flex items-center gap-1.5">
              <DeltaBadge change={change} /> vs {monthLabel(prevKey)}
            </span>
          }
        />
        <StatCard
          label={`Invested in ${year}`}
          value={money(yearInvested)}
          tone="positive"
          icon={<TrendingUp className="size-4" />}
          hint={`${inYear(investments, year).length} contributions`}
        />
        <StatCard
          label={`Loan repaid in ${year}`}
          value={money(yearRepaid)}
          icon={<ArrowDownRight className="size-4" />}
          hint={`${inYear(loanRepayments, year).length} payments`}
        />
        <StatCard
          label="Average per entry"
          value={money(monthExpenses.length ? total / monthExpenses.length : 0)}
          icon={<Receipt className="size-4" />}
          hint={`Across ${byCategory(monthExpenses).length} categories`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <SectionHeading title="Where the money went" description="Top categories this month" />
          <RankedBars buckets={byCategory(monthExpenses)} />
        </Panel>
        <Panel className="lg:col-span-2">
          <SectionHeading title="Who spent it" />
          <UserSplit buckets={byUser(monthExpenses)} />
        </Panel>
      </div>

      <Panel>
        <SectionHeading title="Latest transactions" description={`Most recent in ${monthLabel(month)}`} />
        {recent.length === 0 ? (
          <EmptyState message="No transactions in this month." />
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((expense: Expense, i: number) => (
              <li key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {expense.description || expense.category}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {expense.category} · {userLabel(expense.user)} · {dayLabel(expense.date)}
                  </p>
                </div>
                <span className="num shrink-0 text-sm font-semibold text-foreground">
                  {money(expense.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <p className="pb-2 text-center text-xs text-muted-foreground">
        Reading {expenses.length} expenses across {new Set(expenses.map((e) => yearOf(e.date))).size} years
      </p>
    </div>
  );
}
