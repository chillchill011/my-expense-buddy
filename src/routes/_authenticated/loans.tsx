import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/AppShell";
import { SetupNotice } from "@/components/DashboardState";
import {
  ChartTooltip,
  EmptyState,
  Panel,
  SectionHeading,
  UserSplit,
} from "@/components/Panels";
import { StatCard } from "@/components/StatCard";
import { byMonth, byUser, loanProgress, sum } from "@/lib/analytics";
import { dashboardQueryOptions } from "@/lib/dashboard-query";
import type { ExpenseDataset } from "@/lib/expense-types";
import { fullDateLabel, money, moneyCompact, monthLabelShort } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/loans")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQueryOptions),
  head: () => ({
    meta: [
      { title: "Loans | Expense Tracker Dashboard" },
      {
        name: "description",
        content:
          "See how much of each loan is paid off, the repayment timeline month by month, and how repayments split between people.",
      },
      { property: "og:title", content: "Loans | Expense Tracker Dashboard" },
      {
        property: "og:description",
        content: "Loan payoff progress, repayment timeline and per-person contributions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoansPage,
});

function LoansPage() {
  const { data: result } = useSuspenseQuery(dashboardQueryOptions);
  return (
    <AppShell>
      {result.status === "ok" ? <Loans data={result.data} /> : <SetupNotice result={result} />}
    </AppShell>
  );
}

function Loans({ data }: { data: ExpenseDataset }) {
  const { loanAccounts, loanRepayments } = data;

  const progress = useMemo(
    () => loanProgress(loanAccounts, loanRepayments),
    [loanAccounts, loanRepayments],
  );

  const principal = loanAccounts.reduce((acc, a) => acc + a.principal, 0);
  const repaid = sum(loanRepayments);
  const outstanding = Math.max(principal - repaid, 0);

  const timeline = useMemo(
    () =>
      byMonth(loanRepayments)
        .slice(-24)
        .map((b) => ({ label: monthLabelShort(b.key), total: b.total })),
    [loanRepayments],
  );

  if (loanAccounts.length === 0 && loanRepayments.length === 0) {
    return <EmptyState message="No loans or repayments found in your sheet yet." />;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          Loans
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Payoff progress across {progress.length} {progress.length === 1 ? "loan" : "loans"}.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total borrowed" value={money(principal)} />
        <StatCard label="Repaid so far" value={money(repaid)} tone="positive" />
        <StatCard label="Still outstanding" value={money(outstanding)} tone="primary" />
        <StatCard
          label="Payments made"
          value={String(loanRepayments.length)}
          hint={
            loanRepayments[0] ? `Last on ${fullDateLabel(loanRepayments[0].date)}` : "None recorded"
          }
        />
      </div>

      <Panel>
        <SectionHeading title="Payoff progress" description="Repaid against the original amount" />
        {progress.length === 0 ? (
          <EmptyState message="No loans listed." />
        ) : (
          <ul className="space-y-4">
            {progress.map((loan) => (
              <li key={loan.category}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="text-sm font-medium text-foreground">{loan.category}</span>
                  <span className="num text-sm text-foreground">
                    {money(loan.repaid)}
                    {loan.principal > 0 ? (
                      <span className="text-muted-foreground"> / {money(loan.principal)}</span>
                    ) : null}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-positive transition-[width] duration-700"
                    style={{ width: `${loan.progress}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {loan.bank ? `${loan.bank} · ` : ""}
                  {loan.principal > 0
                    ? `${loan.progress.toFixed(0)}% cleared · ${money(loan.outstanding)} left`
                    : loan.description}
                  {" · "}
                  {loan.payments} payments
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <SectionHeading title="Repayment timeline" description="Last 24 months with activity" />
          {timeline.length === 0 ? (
            <EmptyState message="No repayments recorded." />
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--color-border)"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={18}
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tickFormatter={(value) => moneyCompact(Number(value))}
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Repaid"
                    stroke="var(--color-chart-3)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
        <Panel className="lg:col-span-2">
          <SectionHeading title="Who repaid" description="All-time contributions" />
          <UserSplit buckets={byUser(loanRepayments)} />
        </Panel>
      </div>
    </div>
  );
}
