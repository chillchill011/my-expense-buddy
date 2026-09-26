import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownRight, Banknote, TrendingUp, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { BudgetPanel } from "@/components/BudgetPanel";
import { DataQualityNotice, SetupNotice } from "@/components/DashboardState";
import { SelectField } from "@/components/Filters";
import { EmptyState, Panel, SectionHeading, UserSplit } from "@/components/Panels";
import { QuickAdd } from "@/components/QuickAdd";

import { DeltaBadge, StatCard } from "@/components/StatCard";
import {
  availableMonths,
  byUser,
  inMonth,
  pctChange,
  previousMonthKey,
  sum,
} from "@/lib/analytics";
import { dashboardQueryOptions } from "@/lib/dashboard-query";
import { yearOf } from "@/lib/expense-normalize";
import type { ExpenseDataset } from "@/lib/expense-types";
import { money, monthLabel } from "@/lib/format";


export const Route = createFileRoute("/_authenticated/")({
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
  // Start on the real current month, never a stray future-dated row.
  const [month, setMonth] = useState(() => {
    const now = new Date();
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (months.includes(current)) return current;
    return months.find((m) => m <= current) ?? months[0] ?? "";
  });

  const monthExpenses = useMemo(() => inMonth(expenses, month), [expenses, month]);
  const prevKey = previousMonthKey(month || "2000-01");
  const prevExpenses = useMemo(() => inMonth(expenses, prevKey), [expenses, prevKey]);

  const total = sum(monthExpenses);
  const change = pctChange(total, sum(prevExpenses));

  const monthInvestments = useMemo(() => inMonth(investments, month), [investments, month]);
  const monthRepayments = useMemo(
    () => inMonth(loanRepayments ?? [], month),
    [loanRepayments, month],
  );
  const invested = sum(monthInvestments);
  const repaid = sum(monthRepayments);
  const outflow = total + repaid;

  if (months.length === 0) {
    return <EmptyState message="No expenses found in your sheet yet." />;
  }

  return (
    <div className="space-y-6">
      <QuickAdd data={data} />

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
          label="Total spends"
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
          label="Total outflow"
          value={money(outflow)}
          icon={<Banknote className="size-4" />}
          hint="Spends plus loan repayments"
        />
        <StatCard
          label="Total invested"
          value={money(invested)}
          tone="positive"
          icon={<TrendingUp className="size-4" />}
          hint={`${monthInvestments.length} contributions`}
        />
        <StatCard
          label="Total loan paid"
          value={money(repaid)}
          icon={<ArrowDownRight className="size-4" />}
          hint={`${monthRepayments.length} payments`}
        />
      </div>

      <BudgetPanel data={data} month={month} />

      <Panel>
        <SectionHeading title="Who spent it" description={`Split for ${monthLabel(month)}`} />
        <UserSplit buckets={byUser(monthExpenses)} />
      </Panel>


      <p className="pb-2 text-center text-xs text-muted-foreground">
        Reading {expenses.length} expenses across {new Set(expenses.map((e) => yearOf(e.date))).size} years
      </p>
    </div>
  );
}
