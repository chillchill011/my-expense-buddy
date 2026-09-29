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
import { DataQualityNotice, SetupNotice } from "@/components/DashboardState";
import { SelectField } from "@/components/Filters";
import { InvestmentAdd } from "@/components/InvestmentAdd";
import {
  ChartTooltip,
  EmptyState,
  Panel,
  RankedBars,
  SectionHeading,
} from "@/components/Panels";
import { StatCard } from "@/components/StatCard";
import { byCategory, byUser, colorAt, inYear, sum } from "@/lib/analytics";
import { dashboardQueryOptions } from "@/lib/dashboard-query";
import { yearOf } from "@/lib/expense-normalize";
import type { ExpenseDataset, Investment } from "@/lib/expense-types";
import { MONTH_SHORT, fullDateLabel, money, moneyCompact, userLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/investments")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQueryOptions),
  head: () => ({
    meta: [
      { title: "Investments | Rupeeflow" },
      {
        name: "description",
        content:
          "Track contributions by year and category, see risk levels from your investment master list, and compare how much each person has put in.",
      },
      { property: "og:title", content: "Investments | Rupeeflow" },
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
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(() =>
    years.includes(currentYear) ? currentYear : (years[0] ?? currentYear),
  );
  const [month, setMonth] = useState<string>("all");

  const forYear = useMemo(() => inYear(investments, year), [investments, year]);
  const lifetime = sum(investments);
  const yearTotal = sum(forYear);
  const returns = forYear.reduce((acc, i) => acc + (i.returns ?? 0), 0);

  // Contributions per year, split per person, for the stacked chart.
  const people = useMemo(
    () => Array.from(new Set(investments.map((i) => i.user || "Unknown"))).sort(),
    [investments],
  );
  const yearlyByUser = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const i of investments) {
      const key = String(yearOf(i.date));
      const row = map.get(key) ?? {};
      const person = i.user || "Unknown";
      row[person] = (row[person] ?? 0) + i.amount;
      map.set(key, row);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([key, values]) => ({ key, ...values }));
  }, [investments]);

  const monthsInYear = useMemo(
    () => Array.from(new Set(forYear.map((i) => i.date.slice(5, 7)))).sort(),
    [forYear],
  );
  const monthOptions = [
    { value: "all", label: "All months" },
    ...monthsInYear.map((m) => ({ value: m, label: MONTH_SHORT[Number(m) - 1] ?? m })),
  ];
  const monthSelected = month !== "all" && monthsInYear.includes(month);

  const listRows = useMemo(() => {
    const rows = monthSelected ? forYear.filter((i) => i.date.slice(5, 7) === month) : forYear;
    const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date));
    return monthSelected ? sorted : sorted.slice(0, 5);
  }, [forYear, month, monthSelected]);

  const listTitle = monthSelected
    ? `All investments · ${MONTH_SHORT[Number(month) - 1] ?? month} ${year}`
    : `Last 5 investments in ${year}`;

  const riskByCategory = new Map(investmentAccounts.map((a) => [a.category, a.risk]));
  const categories = byCategory(forYear);

  // Per-person totals plus their own category split for the selected year.
  const perPerson = useMemo(() => {
    return byUser(forYear).map((b) => ({
      ...b,
      categories: byCategory(forYear.filter((i) => (i.user || "Unknown") === b.key)),
    }));
  }, [forYear]);
  const perPersonTotal = perPerson.reduce((acc, p) => acc + p.total, 0) || 1;

  const issues = data.issues.filter((issue) => issue.sheet.includes("Overview"));

  if (investments.length === 0) {
    return (
      <div className="space-y-6">
        <InvestmentAdd data={data} />
        <EmptyState message="No investments found in your sheet yet." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <InvestmentAdd data={data} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Investments
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Contributions grouped by the date they actually happened.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SelectField
            ariaLabel="Choose year"
            value={String(year)}
            onChange={(v) => {
              setYear(Number(v));
              setMonth("all");
            }}
            options={years.map((y) => ({ value: String(y), label: String(y) }))}
          />
          <SelectField
            ariaLabel="Choose month"
            value={month}
            onChange={setMonth}
            options={monthOptions}
          />
        </div>
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
        <SectionHeading title="Year on year" description="Contributions each year, per person" />
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={yearlyByUser} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
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
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                iconType="circle"
                iconSize={8}
              />
              {people.map((person, i) => (
                <Bar
                  key={person}
                  dataKey={person}
                  stackId="invested"
                  name={userLabel(person)}
                  fill={colorAt(i)}
                  radius={i === people.length - 1 ? [5, 5, 0, 0] : [0, 0, 0, 0]}
                  maxBarSize={44}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel>
        <SectionHeading
          title={listTitle}
          description={
            monthSelected
              ? `${listRows.length} contribution${listRows.length === 1 ? "" : "s"} this month`
              : "Pick a month above to see every entry for that month"
          }
        />
        <InvestmentList rows={listRows} />
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
          {perPerson.length === 0 ? (
            <EmptyState message="No entries yet." />
          ) : (
            <div className="space-y-4">
              <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                {perPerson.map((p, i) => (
                  <div
                    key={p.key}
                    style={{
                      width: `${(p.total / perPersonTotal) * 100}%`,
                      backgroundColor: colorAt(i),
                    }}
                  />
                ))}
              </div>
              <ul className="space-y-4">
                {perPerson.map((p, i) => (
                  <li key={p.key} className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: colorAt(i) }}
                      />
                      <span className="truncate text-xs text-muted-foreground">
                        {userLabel(p.key)}
                      </span>
                    </div>
                    <p className="num mt-0.5 text-base font-semibold text-foreground">
                      {money(p.total)}
                    </p>
                    <p className="num text-[11px] text-muted-foreground">
                      {((p.total / perPersonTotal) * 100).toFixed(0)}% · {p.count} entries
                    </p>
                    <ul className="mt-2 space-y-1 border-l border-border pl-2.5">
                      {p.categories.map((c) => (
                        <li
                          key={c.key}
                          className="flex items-baseline justify-between gap-3 text-xs"
                        >
                          <span className="truncate text-muted-foreground">{c.key}</span>
                          <span className="num shrink-0 text-foreground">{money(c.total)}</span>
                        </li>
                      ))}
                    </ul>
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

function InvestmentList({ rows }: { rows: Investment[] }) {
  if (rows.length === 0) {
    return <EmptyState message="No investments recorded for this period." />;
  }

  return (
    <ul className="divide-y divide-border">
      {rows.map((row, i) => (
        <li
          key={`${row.date}-${row.category}-${i}`}
          className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0"
        >
          <span className="num mt-0.5 w-7 shrink-0 text-xs text-muted-foreground">#{i + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {row.description || row.category}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {row.category} · {userLabel(row.user)} · {fullDateLabel(row.date)}
            </p>
          </div>
          <span className="num shrink-0 text-sm font-semibold text-foreground">
            {money(row.amount)}
          </span>
        </li>
      ))}
    </ul>
  );
}
