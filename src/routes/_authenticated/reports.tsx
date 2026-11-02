import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Copy, RotateCcw } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { SetupNotice } from "@/components/DashboardState";
import { SelectField } from "@/components/Filters";
import { ChartTooltip, EmptyState, Panel, RankedBars, SectionHeading } from "@/components/Panels";
import { StatCard } from "@/components/StatCard";
import { byCategory, byLoan, byUser, colorAt, sum } from "@/lib/analytics";
import { dashboardQueryOptions } from "@/lib/dashboard-query";
import { yearOf } from "@/lib/expense-normalize";
import type { ExpenseDataset } from "@/lib/expense-types";
import { MONTH_SHORT, fullDateLabel, money, moneyCompact, userLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/reports")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQueryOptions),
  head: () => ({
    meta: [
      { title: "Reports | Rupeeflow" },
      {
        name: "description",
        content:
          "Detailed charts of spending, investments and loan payments, filtered by year, month, category and person.",
      },
      { property: "og:title", content: "Reports | Rupeeflow" },
      {
        property: "og:description",
        content: "Spending, investing and loan charts with per-person and per-category comparisons.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data: result } = useSuspenseQuery(dashboardQueryOptions);
  return (
    <AppShell>
      {result.status === "ok" ? <Reports data={result.data} /> : <SetupNotice result={result} />}
    </AppShell>
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const axisProps = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

function Reports({ data }: { data: ExpenseDataset }) {
  const [year, setYear] = useState("all");
  const [month, setMonth] = useState("all");
  const [category, setCategory] = useState("all");
  const [user, setUser] = useState("all");
  const [copied, setCopied] = useState("");

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const r of [...data.expenses, ...data.investments, ...data.loanRepayments])
      set.add(yearOf(r.date));
    return Array.from(set).sort((a, b) => b - a);
  }, [data]);
  const categories = useMemo(
    () => Array.from(new Set(data.expenses.map((e) => e.category || "Unknown"))).sort(),
    [data.expenses],
  );
  const users = useMemo(() => {
    const set = new Set<string>();
    for (const r of [...data.expenses, ...data.investments, ...data.loanRepayments])
      if (r.user) set.add(r.user);
    return Array.from(set).sort();
  }, [data]);

  const matchDate = (d: string) =>
    (year === "all" || d.slice(0, 4) === year) && (month === "all" || d.slice(5, 7) === month);
  const matchUser = (u: string) => user === "all" || u === user;

  const expenses = useMemo(
    () =>
      data.expenses.filter(
        (e) =>
          matchDate(e.date) &&
          matchUser(e.user) &&
          (category === "all" || (e.category || "Unknown") === category),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.expenses, year, month, category, user],
  );
  const investments = useMemo(
    () => data.investments.filter((i) => matchDate(i.date) && matchUser(i.user)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.investments, year, month, user],
  );
  const loans = useMemo(
    () => data.loanRepayments.filter((l) => matchDate(l.date) && matchUser(l.user)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.loanRepayments, year, month, user],
  );

  const spent = sum(expenses);
  const invested = sum(investments);
  const loanPaid = sum(loans);
  const outflow = spent + loanPaid;
  const investRate = invested + outflow > 0 ? (invested / (invested + outflow)) * 100 : 0;
  const periodLabel =
    (month === "all" ? "All months" : MONTH_SHORT[Number(month) - 1]) +
    " · " +
    (year === "all" ? "All years" : year);

  // Trend: monthly when a year is chosen, yearly otherwise.
  const trend = useMemo(() => {
    const byYearMode = year === "all";
    const map = new Map<string, { key: string; Spends: number; Invested: number; Loans: number }>();
    if (!byYearMode)
      MONTH_SHORT.forEach((_, i) => {
        const k = `${year}-${String(i + 1).padStart(2, "0")}`;
        if (month === "all" || k.slice(5) === month)
          map.set(k, { key: k, Spends: 0, Invested: 0, Loans: 0 });
      });
    const keyOf = (d: string) => (byYearMode ? d.slice(0, 4) : d.slice(0, 7));
    const add = (d: string, field: "Spends" | "Invested" | "Loans", amt: number) => {
      const k = keyOf(d);
      const row = map.get(k) ?? { key: k, Spends: 0, Invested: 0, Loans: 0 };
      row[field] += amt;
      map.set(k, row);
    };
    expenses.forEach((e) => add(e.date, "Spends", e.amount));
    investments.forEach((i) => add(i.date, "Invested", i.amount));
    loans.forEach((l) => add(l.date, "Loans", l.amount));
    return Array.from(map.values())
      .sort((a, b) => (a.key < b.key ? -1 : 1))
      .map((r) => ({
        ...r,
        label: byYearMode ? r.key : (MONTH_SHORT[Number(r.key.slice(5)) - 1] ?? r.key),
      }));
  }, [expenses, investments, loans, year, month]);

  const userSpend = byUser(expenses);
  const catSpend = byCategory(expenses);
  const invCats = byCategory(investments);
  const loanBuckets = byLoan(loans);

  // Phase 2 data
  const spendUsers = userSpend.map((u) => u.key);
  const userCategory = useMemo(() => {
    const top = catSpend.slice(0, 10).map((c) => c.key);
    return top.map((cat) => {
      const row: Record<string, number | string> = { category: cat };
      for (const e of expenses)
        if ((e.category || "Unknown") === cat) {
          const u = e.user || "Unknown";
          row[u] = ((row[u] as number) ?? 0) + e.amount;
        }
      return row;
    });
  }, [catSpend, expenses]);

  const topCats = catSpend.slice(0, 5).map((c) => c.key);
  const categoryTrend = useMemo(() => {
    const byYearMode = year === "all";
    const map = new Map<string, Record<string, number | string>>();
    for (const e of expenses) {
      const k = byYearMode ? e.date.slice(0, 4) : e.date.slice(0, 7);
      const row = map.get(k) ?? { key: k };
      const c = topCats.includes(e.category) ? e.category : "Other";
      row[c] = ((row[c] as number) ?? 0) + e.amount;
      map.set(k, row);
    }
    return Array.from(map.values())
      .sort((a, b) => (String(a["key"]) < String(b["key"]) ? -1 : 1))
      .map((r) => ({
        ...r,
        label: byYearMode ? r["key"] : MONTH_SHORT[Number(String(r["key"]).slice(5)) - 1],
      }));
  }, [expenses, topCats, year]);

  const yoy = useMemo(() => {
    const ys = Array.from(new Set(expenses.map((e) => e.date.slice(0, 4)))).sort().slice(-4);
    const rows = MONTH_SHORT.map((m) => ({ label: m }) as Record<string, number | string>);
    for (const e of expenses) {
      const y = e.date.slice(0, 4);
      if (!ys.includes(y)) continue;
      const r = rows[Number(e.date.slice(5, 7)) - 1];
      if (r) r[y] = ((r[y] as number) ?? 0) + e.amount;
    }
    return { years: ys, rows };
  }, [expenses]);

  const dayOfMonth = useMemo(() => {
    const arr = Array.from({ length: 31 }, (_, i) => ({ day: String(i + 1), total: 0 }));
    for (const e of expenses) {
      const d = Number(e.date.slice(8, 10));
      if (arr[d - 1]) arr[d - 1]!.total += e.amount;
    }
    return arr;
  }, [expenses]);
  const weekday = useMemo(() => {
    const arr = WEEKDAYS.map((d) => ({ day: d, total: 0 }));
    for (const e of expenses) {
      const wd = new Date(`${e.date}T00:00:00`).getDay();
      if (arr[wd]) arr[wd]!.total += e.amount;
    }
    return arr;
  }, [expenses]);

  const budgetRows = useMemo(() => {
    return data.budgets
      .filter((b) => matchDate(`${b.month}-01`))
      .sort((a, b) => (a.month < b.month ? -1 : 1))
      .slice(-12)
      .map((b) => ({
        label: `${MONTH_SHORT[Number(b.month.slice(5)) - 1]} ${b.month.slice(2, 4)}`,
        Budget: b.amount,
        Spent: sum(expenses.filter((e) => e.date.startsWith(b.month))),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.budgets, expenses, year, month]);

  const biggest = useMemo(
    () => [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 10),
    [expenses],
  );

  const reset = () => {
    setYear("all");
    setMonth("all");
    setCategory("all");
    setUser("all");
  };

  const copySummary = async () => {
    const lines = [
      `Rupeeflow report — ${periodLabel}`,
      `Spent: ${money(spent)}`,
      `Loan payments: ${money(loanPaid)}`,
      `Total outflow: ${money(outflow)}`,
      `Invested: ${money(invested)}`,
      "",
      "Top categories:",
      ...catSpend.slice(0, 5).map((c, i) => `${i + 1}. ${c.key} — ${money(c.total)}`),
      "",
      "By person:",
      ...userSpend.map((u) => `${userLabel(u.key)} — ${money(u.total)}`),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied("Copied — paste in WhatsApp");
    } catch {
      setCopied("Couldn't copy on this device");
    }
  };

  const empty = expenses.length + investments.length + loans.length === 0;

  return (
    <div className="space-y-6">
      <SectionHeading title="Reports" description={`Detailed view · ${periodLabel}`} />

      <Panel className="sticky top-[calc(4rem+env(safe-area-inset-top,0px))] z-10 lg:top-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SelectField
            ariaLabel="Year"
            value={year}
            onChange={setYear}
            options={[
              { value: "all", label: "All years" },
              ...years.map((y) => ({ value: String(y), label: String(y) })),
            ]}
          />
          <SelectField
            ariaLabel="Month"
            value={month}
            onChange={setMonth}
            options={[
              { value: "all", label: "All months" },
              ...MONTH_SHORT.map((m, i) => ({ value: String(i + 1).padStart(2, "0"), label: m })),
            ]}
          />
          <SelectField
            ariaLabel="Category"
            value={category}
            onChange={setCategory}
            options={[
              { value: "all", label: "All categories" },
              ...categories.map((c) => ({ value: c, label: c })),
            ]}
          />
          <SelectField
            ariaLabel="Person"
            value={user}
            onChange={setUser}
            options={[
              { value: "all", label: "Everyone" },
              ...users.map((u) => ({ value: u, label: userLabel(u) })),
            ]}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3.5" /> Reset
          </button>
          <button
            type="button"
            onClick={copySummary}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Copy className="size-3.5" /> {copied || "Copy summary"}
          </button>
          {category !== "all" ? (
            <span className="self-center text-xs text-muted-foreground">
              Category filter applies to spends only.
            </span>
          ) : null}
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Total spends" value={money(spent)} hint={`${expenses.length} entries`} />
        <StatCard label="Loan paid" value={money(loanPaid)} hint={`${loans.length} payments`} />
        <StatCard label="Total outflow" value={money(outflow)} tone="negative" hint="Spends + loans" />
        <StatCard label="Invested" value={money(invested)} tone="positive" hint={`${investments.length} entries`} />
        <StatCard
          label="Invest rate"
          value={`${investRate.toFixed(1)}%`}
          tone="primary"
          hint="Of all money moved"
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {empty ? (
        <EmptyState message="No data for these filters. Try Reset." />
      ) : (
        <>
          <h2 className="pt-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Basic
          </h2>

          <ChartPanel title={year === "all" ? "Money flow by year" : "Money flow by month"}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={trend}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={moneyCompact} width={52} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-muted)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Spends" fill={colorAt(0)} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Loans" fill={colorAt(2)} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Invested" fill={colorAt(1)} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartPanel title="Spends by person">
              <Donut buckets={userSpend} label={userLabel} />
            </ChartPanel>
            <ChartPanel title="Spends by category">
              <Donut buckets={catSpend} />
            </ChartPanel>
            <ChartPanel title="Category ranking">
              <RankedBars buckets={catSpend} limit={10} />
            </ChartPanel>
            <ChartPanel title="Investments by category">
              <RankedBars buckets={invCats} limit={10} emptyMessage="No investments here." />
            </ChartPanel>
          </div>

          <h2 className="pt-4 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Advanced
          </h2>

          <ChartPanel title="Who spends on what (top 10 categories)">
            {userCategory.length ? (
              <ResponsiveContainer width="100%" height={Math.max(260, userCategory.length * 38)}>
                <BarChart data={userCategory} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid horizontal={false} stroke="var(--color-border)" />
                  <XAxis type="number" {...axisProps} tickFormatter={moneyCompact} />
                  <YAxis type="category" dataKey="category" {...axisProps} width={96} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-muted)" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => userLabel(String(v))} />
                  {spendUsers.map((u, i) => (
                    <Bar key={u} dataKey={u} name={u} stackId="u" fill={colorAt(i)} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No spends here." />
            )}
          </ChartPanel>

          <ChartPanel title="Top categories over time">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={categoryTrend}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={moneyCompact} width={52} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {[...topCats, "Other"].map((c, i) => (
                  <Area
                    key={c}
                    type="monotone"
                    dataKey={c}
                    stackId="c"
                    stroke={colorAt(i)}
                    fill={colorAt(i)}
                    fillOpacity={0.35}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </ChartPanel>

          {yoy.years.length > 1 ? (
            <ChartPanel title="Year vs year spends">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={yoy.rows}>
                  <CartesianGrid vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} tickFormatter={moneyCompact} width={52} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {yoy.years.map((y, i) => (
                    <Line key={y} type="monotone" dataKey={y} stroke={colorAt(i)} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartPanel>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartPanel title="Spends by day of month">
              <SimpleBars data={dayOfMonth} color={colorAt(3)} />
            </ChartPanel>
            <ChartPanel title="Spends by weekday">
              <SimpleBars data={weekday} color={colorAt(4)} />
            </ChartPanel>
            <ChartPanel title="Budget vs spent">
              {budgetRows.length ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={budgetRows}>
                    <CartesianGrid vertical={false} stroke="var(--color-border)" />
                    <XAxis dataKey="label" {...axisProps} />
                    <YAxis {...axisProps} tickFormatter={moneyCompact} width={52} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-muted)" }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Budget" fill={colorAt(5)} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Spent" fill={colorAt(0)} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="No budgets set for this period." />
              )}
            </ChartPanel>
            <ChartPanel title="Loan payments by loan">
              <RankedBars buckets={loanBuckets} emptyMessage="No loan payments here." />
            </ChartPanel>
          </div>

          <ChartPanel title="10 biggest spends">
            {biggest.length ? (
              <ol className="divide-y divide-border">
                {biggest.map((e, i) => (
                  <li key={`${e.sheet}-${i}`} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="w-6 text-xs text-muted-foreground">#{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{e.description || e.category}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {fullDateLabel(e.date)} · {e.category} · {userLabel(e.user)}
                      </p>
                    </div>
                    <span className="num font-semibold">{money(e.amount)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState message="No spends here." />
            )}
          </ChartPanel>
        </>
      )}
    </div>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel>
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </Panel>
  );
}

function SimpleBars({ data, color }: { data: Array<{ day: string; total: number }>; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid vertical={false} stroke="var(--color-border)" />
        <XAxis dataKey="day" {...axisProps} interval="preserveStartEnd" />
        <YAxis {...axisProps} tickFormatter={moneyCompact} width={48} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-muted)" }} />
        <Bar dataKey="total" name="Spent" fill={color} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Donut({
  buckets,
  label = (s: string) => s,
}: {
  buckets: Array<{ key: string; total: number }>;
  label?: (s: string) => string;
}) {
  if (!buckets.length) return <EmptyState message="Nothing here." />;
  const top = buckets.slice(0, 7);
  const rest = buckets.slice(7).reduce((a, b) => a + b.total, 0);
  const rows = rest ? [...top, { key: "Other", total: rest }] : top;
  const total = rows.reduce((a, b) => a + b.total, 0) || 1;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="total" nameKey="key" innerRadius="58%" outerRadius="95%" paddingAngle={2} stroke="none">
              {rows.map((r, i) => (
                <Cell key={r.key} fill={colorAt(i)} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-1.5 text-sm">
        {rows.map((r, i) => (
          <li key={r.key} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorAt(i) }} />
            <span className="min-w-0 flex-1 truncate">{label(r.key)}</span>
            <span className="text-xs text-muted-foreground">{((r.total / total) * 100).toFixed(0)}%</span>
            <span className="num shrink-0 text-right font-medium">{moneyCompact(r.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
