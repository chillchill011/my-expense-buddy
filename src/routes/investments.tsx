import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
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
import { DataQualityNotice, SetupNotice } from "@/components/DashboardState";
import { SelectField } from "@/components/Filters";
import {
  ChartTooltip,
  EmptyState,
  Panel,
  RankedBars,
  SectionHeading,
  UserSplit,
} from "@/components/Panels";
import { StatCard } from "@/components/StatCard";
import { byCategory, byUser, byYear, inYear, sum } from "@/lib/analytics";
import { dashboardQueryOptions } from "@/lib/dashboard-query";
import { yearOf } from "@/lib/expense-normalize";
import type { ExpenseDataset } from "@/lib/expense-types";
import { money, moneyCompact } from "@/lib/format";

export const Route = createFileRoute("/investments")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQueryOptions),
  head: () => ({
    meta: [
      { title: "Investments | Expense Tracker Dashboard" },
      {
        name: "description",
        content:
          "Track contributions by year and category, see risk levels from your investment master list, and compare how much each person has put in.",
      },
      { property: "og:title", content: "Investments | Expense Tracker Dashboard" },
      {
        property: "og:description",
        content: "Contributions by year and category, with risk levels and per-person totals.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvestmentsPage,
});

function InvestmentsPage() {
  const { data: result } = useSuspenseQuery(dashboardQueryOptions);
  return (
    <AppShell>
      {result.status === "ok" ? (
        <Investments data={result.data} />
      ) : (
        <SetupNotice result={result} />
      )}
    </AppShell>
  );
}

function Investments({ data }: { data: ExpenseDataset }) {
  const { investments, investmentAccounts } = data;

  const years = useMemo(
    () => Array.from(new Set(investments.map((i) => yearOf(i.date)))).sort((a, b) => b - a),
    [investments],
  );
  const [year, setYear] = useState(() => years[0] ?? new Date().getFullYear());

  const forYear = useMemo(() => inYear(investments, year), [investments, year]);
  const lifetime = sum(investments);
  const yearTotal = sum(forYear);
  const returns = forYear.reduce((acc, i) => acc + (i.returns ?? 0), 0);
  const yearly = useMemo(() => byYear(investments), [investments]);

  const riskByCategory = new Map(investmentAccounts.map((a) => [a.category, a.risk]));
  const categories = byCategory(forYear);

  const issues = data.issues.filter((issue) => issue.sheet.includes("Overview"));

  if (investments.length === 0) {
    return <EmptyState message="No investments found in your sheet yet." />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Investments
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Contributions grouped by the date they actually happened.
          </p>
        </div>
        <SelectField
          ariaLabel="Choose year"
          value={String(year)}
          onChange={(v) => setYear(Number(v))}
          options={years.map((y) => ({ value: String(y), label: String(y) }))}
        />
      </header>

      <DataQualityNotice issues={issues} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={`Invested in ${year}`} value={money(yearTotal)} tone="primary" />
        <StatCard label="Lifetime invested" value={money(lifetime)} />
        <StatCard
          label={`Returns logged in ${year}`}
          value={money(returns)}
          tone={returns > 0 ? "positive" : "neutral"}
        />
        <StatCard label="Contributions" value={String(forYear.length)} />
      </div>

      <Panel>
        <SectionHeading title="Year on year" description="Total contributed each year" />
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={yearly} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="key"
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
                name="Invested"
                fill="var(--color-chart-2)"
                radius={[5, 5, 0, 0]}
                maxBarSize={44}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <SectionHeading title={`Categories in ${year}`} />
          <RankedBars buckets={categories} limit={10} />
          {investmentAccounts.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-1.5 border-t border-border pt-3">
              {categories.slice(0, 6).map((c) => (
                <li
                  key={c.key}
                  className="rounded-md bg-muted/70 px-2 py-1 text-[11px] text-muted-foreground"
                >
                  {c.key} · {riskByCategory.get(c.key) ?? "risk unknown"}
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>
        <Panel className="lg:col-span-2">
          <SectionHeading title="Per person" description={`Contributions in ${year}`} />
          <UserSplit buckets={byUser(forYear)} />
        </Panel>
      </div>
    </div>
  );
}
