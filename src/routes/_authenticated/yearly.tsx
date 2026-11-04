import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/AppShell";
import { DataLoadError, SetupNotice } from "@/components/DashboardState";
import { SelectField } from "@/components/Filters";
import { ChartTooltip, EmptyState, Panel, SectionHeading } from "@/components/Panels";
import { StatCard } from "@/components/StatCard";
import { colorAt } from "@/lib/analytics";
import { dashboardQueryOptions } from "@/lib/dashboard-query";
import { yearOf } from "@/lib/expense-normalize";
import type { ExpenseDataset } from "@/lib/expense-types";
import { money, moneyCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/yearly")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQueryOptions),
  head: () => ({
    meta: [
      { title: "Yearly comparison | Rupeeflow" },
      {
        name: "description",
        content: "Compare yearly spends, investments and loan payments over 1, 2, 3, 5 or 10 years.",
      },
      { property: "og:title", content: "Yearly comparison | Rupeeflow" },
      {
        property: "og:description",
        content: "Your long-term money trend: spends vs investments, year by year.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error, reset }) => <DataLoadError error={error} reset={reset} />,
  component: YearlyPage,
});

function YearlyPage() {
  const { data: result } = useSuspenseQuery(dashboardQueryOptions);
  return (
    <AppShell>
      {result.status === "ok" ? <Yearly data={result.data} /> : <SetupNotice result={result} />}
    </AppShell>
  );
}

const HORIZONS = [
  { value: "1", label: "Last 1 year" },
  { value: "2", label: "Last 2 years" },
  { value: "3", label: "Last 3 years" },
  { value: "5", label: "Last 5 years" },
  { value: "10", label: "Last 10 years" },
  { value: "all", label: "All time" },
];

const axisProps = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

type YearRow = {
  year: number;
  key: string;
  spends: number;
  invested: number;
  loans: number;
  outflow: number;
  rate: number;
  avgMonthly: number;
  growth: number | null;
};

function Yearly({ data }: { data: ExpenseDataset }) {
  const [horizon, setHorizon] = useState("3");
  const now = new Date();
  const currentYear = now.getFullYear();

  const allRows = useMemo<YearRow[]>(() => {
    const totals = new Map<number, { spends: number; invested: number; loans: number }>();
    const add = (date: string, field: "spends" | "invested" | "loans", amount: number) => {
      const y = yearOf(date);
      if (!y || y > currentYear) return;
      const t = totals.get(y) ?? { spends: 0, invested: 0, loans: 0 };
      t[field] += amount;
      totals.set(y, t);
    };
    data.expenses.forEach((e) => add(e.date, "spends", e.amount));
    data.investments.forEach((i) => add(i.date, "invested", i.amount));
    data.loanRepayments.forEach((l) => add(l.date, "loans", l.amount));
    const first = totals.size ? Math.min(...totals.keys()) : currentYear;
    const rows: YearRow[] = [];
    for (let y = first; y <= currentYear; y++) {
      const t = totals.get(y) ?? { spends: 0, invested: 0, loans: 0 };
      const outflow = t.spends + t.loans;
      const months = y === currentYear ? now.getMonth() + 1 : 12;
      const prev = rows[rows.length - 1];
      rows.push({
        year: y,
        key: String(y),
        ...t,
        outflow,
        rate: t.invested + outflow > 0 ? (t.invested / (t.invested + outflow)) * 100 : 0,
        avgMonthly: t.spends / months,
        growth: prev && prev.spends > 0 ? ((t.spends - prev.spends) / prev.spends) * 100 : null,
      });
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, currentYear]);

  const rows = horizon === "all" ? allRows : allRows.filter((r) => r.year > currentYear - Number(horizon));
  const chartRows = rows.map((r) => ({
    key: r.key,
    Spends: r.spends,
    Invested: r.invested,
    Loans: r.loans,
  }));
  const hasData = rows.some((r) => r.spends || r.invested || r.loans);

  const totalInvested = rows.reduce((a, r) => a + r.invested, 0);
  const avgOutflow = rows.length ? rows.reduce((a, r) => a + r.outflow, 0) / rows.length : 0;
  const firstWithSpend = rows.find((r) => r.spends > 0);
  const last = rows[rows.length - 1];
  const trend =
    firstWithSpend && last && firstWithSpend !== last && firstWithSpend.spends > 0
      ? ((last.spends - firstWithSpend.spends) / firstWithSpend.spends) * 100
      : null;
  const peak = rows.reduce<YearRow | null>(
    (best, r) => (r.invested > 0 && (!best || r.rate > best.rate) ? r : best),
    null,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Yearly comparison</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your long-term picture — spends, investments and loans, year by year.
          </p>
        </div>
        <SelectField value={horizon} onChange={setHorizon} options={HORIZONS} ariaLabel="Time range" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total invested" value={moneyCompact(totalInvested)} tone="primary" hint="Across the chosen years" />
        <StatCard
          label="Spend trend"
          value={trend === null ? "—" : `${trend > 0 ? "+" : ""}${trend.toFixed(0)}%`}
          tone={trend === null ? "neutral" : trend > 0 ? "negative" : "positive"}
          hint={firstWithSpend && last && trend !== null ? `${firstWithSpend.year} → ${last.year}` : "Needs 2+ years"}
        />
        <StatCard label="Avg yearly outflow" value={moneyCompact(avgOutflow)} hint="Spends + loans" />
        <StatCard
          label="Best invest year"
          value={peak ? peak.key : "—"}
          tone="positive"
          hint={peak ? `${peak.rate.toFixed(1)}% invested` : "No investments yet"}
        />
      </div>

      <Panel>
        <SectionHeading title="Year summary" description="Current year counts months so far for the monthly average." />
        {!hasData ? (
          <EmptyState message="No entries in this time range." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-3">Year</th>
                  <th className="py-2 pr-3 text-right">Spends</th>
                  <th className="py-2 pr-3 text-right">Invested</th>
                  <th className="py-2 pr-3 text-right">Loans</th>
                  <th className="py-2 pr-3 text-right">Outflow</th>
                  <th className="py-2 pr-3 text-right">Invest %</th>
                  <th className="py-2 pr-3 text-right">Spend vs last yr</th>
                  <th className="py-2 text-right">Avg / month</th>
                </tr>
              </thead>
              <tbody className="num">
                {[...rows].reverse().map((r) => (
                  <tr key={r.year} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-3 font-semibold">{r.year}</td>
                    <td className="py-2.5 pr-3 text-right">{money(r.spends)}</td>
                    <td className="py-2.5 pr-3 text-right">{money(r.invested)}</td>
                    <td className="py-2.5 pr-3 text-right">{money(r.loans)}</td>
                    <td className="py-2.5 pr-3 text-right">{money(r.outflow)}</td>
                    <td className="py-2.5 pr-3 text-right">{r.rate.toFixed(1)}%</td>
                    <td
                      className={cn(
                        "py-2.5 pr-3 text-right",
                        r.growth !== null && (r.growth > 0 ? "text-destructive" : "text-positive"),
                      )}
                    >
                      {r.growth === null ? "—" : `${r.growth > 0 ? "▲ +" : "▼ "}${r.growth.toFixed(1)}%`}
                    </td>
                    <td className="py-2.5 text-right">{money(r.avgMonthly)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <SectionHeading title="Spends vs investments" description="Are investments growing faster than spending?" />
          {hasData ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartRows}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="key" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={(v) => moneyCompact(Number(v))} width={56} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-muted)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Spends" fill={colorAt(0)} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Invested" fill={colorAt(1)} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No entries in this time range." />
          )}
        </Panel>
        <Panel>
          <SectionHeading title="Where money went each year" description="Spends, loan payments and investments stacked." />
          {hasData ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartRows}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="key" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={(v) => moneyCompact(Number(v))} width={56} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-muted)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Spends" stackId="a" fill={colorAt(0)} />
                <Bar dataKey="Loans" stackId="a" fill={colorAt(2)} />
                <Bar dataKey="Invested" stackId="a" fill={colorAt(1)} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No entries in this time range." />
          )}
        </Panel>
      </div>
    </div>
  );
}
