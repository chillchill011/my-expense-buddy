import { EmptyState } from "@/components/Panels";
import type { Expense } from "@/lib/expense-types";
import { fullDateLabel, money, userLabel } from "@/lib/format";

export function RecentTransactions({
  expenses,
  monthLabel,
  limit = 5,
}: {
  expenses: Expense[];
  monthLabel: string;
  limit?: number;
}) {
  const sorted = [...expenses].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    return byDate;
  });
  const rows = sorted.slice(0, limit);

  if (rows.length === 0) {
    return <EmptyState message={`No transactions in ${monthLabel}.`} />;
  }

  return (
    <ul className="divide-y divide-border">
      {rows.map((expense, i) => (
        <li
          key={`${expense.date}-${i}`}
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
              {expense.category} · {userLabel(expense.user)} · {fullDateLabel(expense.date)}
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
        </li>
      ))}
    </ul>
  );
}
