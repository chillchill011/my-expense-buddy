import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
  className,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  tone?: "neutral" | "positive" | "negative" | "primary";
  icon?: ReactNode;
  className?: string;
}) {
  const valueTone =
    tone === "positive"
      ? "text-positive"
      : tone === "negative"
        ? "text-destructive"
        : tone === "primary"
          ? "text-primary"
          : "text-foreground";

  return (
    <div className={cn("panel rise relative overflow-hidden p-4 sm:p-5", className)}>
      <div className="pointer-events-none absolute inset-0 grid-fade" aria-hidden />
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        </div>
        <p className={cn("num mt-2.5 text-2xl font-semibold sm:text-[1.7rem]", valueTone)}>{value}</p>
        {hint ? <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div> : null}
      </div>
    </div>
  );
}

export function DeltaBadge({ change }: { change: number | null }) {
  if (change === null) return <span className="text-muted-foreground">no prior data</span>;
  const up = change > 0;
  return (
    <span
      className={cn(
        "num inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
        up ? "bg-destructive/12 text-destructive" : "bg-positive/12 text-positive",
      )}
    >
      {up ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%
    </span>
  );
}
