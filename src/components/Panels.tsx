import type { ReactNode } from "react";

import { colorAt, type Bucket } from "@/lib/analytics";
import { money, moneyCompact, userLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SectionHeading({
  title,
  action,
  description,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("panel p-4 sm:p-5", className)}>{children}</div>;
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

/** Ranked horizontal bars — the workhorse breakdown view. */
export function RankedBars({
  buckets,
  limit = 8,
  emptyMessage = "Nothing recorded for this period.",
}: {
  buckets: Bucket[];
  limit?: number;
  emptyMessage?: string;
}) {
  if (buckets.length === 0) return <EmptyState message={emptyMessage} />;

  const max = Math.max(...buckets.map((b) => b.total), 1);
  const shown = buckets.slice(0, limit);
  const rest = buckets.slice(limit);
  const restTotal = rest.reduce((acc, b) => acc + b.total, 0);

  return (
    <ul className="space-y-2.5">
      {shown.map((b, i) => (
        <li key={b.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium text-foreground">{b.key}</span>
            <span className="num shrink-0 text-foreground">{money(b.total)}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${(b.total / max) * 100}%`, backgroundColor: colorAt(i) }}
              />
            </div>
            <span className="num w-12 shrink-0 text-right text-[11px] text-muted-foreground">
              {b.count}×
            </span>
          </div>
        </li>
      ))}
      {rest.length > 0 ? (
        <li className="flex items-baseline justify-between gap-3 border-t border-border pt-2.5 text-xs text-muted-foreground">
          <span>{rest.length} more</span>
          <span className="num">{money(restTotal)}</span>
        </li>
      ) : null}
    </ul>
  );
}

/** Side-by-side share of spend per person. */
export function UserSplit({ buckets }: { buckets: Bucket[] }) {
  if (buckets.length === 0) return <EmptyState message="No entries yet." />;
  const total = buckets.reduce((acc, b) => acc + b.total, 0) || 1;

  return (
    <div className="space-y-3">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        {buckets.map((b, i) => (
          <div
            key={b.key}
            style={{ width: `${(b.total / total) * 100}%`, backgroundColor: colorAt(i) }}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-3">
        {buckets.map((b, i) => (
          <li key={b.key} className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: colorAt(i) }}
              />
              <span className="truncate text-xs text-muted-foreground">{userLabel(b.key)}</span>
            </div>
            <p className="num mt-0.5 text-base font-semibold text-foreground">{money(b.total)}</p>
            <p className="num text-[11px] text-muted-foreground">
              {((b.total / total) * 100).toFixed(0)}% · {b.count} entries
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="panel-raised px-3 py-2 text-xs">
      {label !== undefined ? (
        <p className="mb-1 font-semibold text-foreground">{String(label)}</p>
      ) : null}
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span>{entry.name}</span>
          <span className="num ml-auto font-semibold text-foreground">
            {moneyCompact(Number(entry.value ?? 0))}
          </span>
        </p>
      ))}
    </div>
  );
}
