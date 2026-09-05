import { AlertTriangle, KeyRound, TriangleAlert } from "lucide-react";

import type { DashboardResult } from "@/lib/expense.functions";
import type { DataQualityIssue } from "@/lib/expense-types";
import { fullDateLabel, money } from "@/lib/format";

/** Shown when the spreadsheet is not wired up yet, or a fetch failed. */
export function SetupNotice({ result }: { result: DashboardResult }) {
  if (result.status === "ok") return null;

  const isSetup = result.status === "setup";

  return (
    <div className="panel mx-auto max-w-xl p-6 text-center sm:p-8">
      <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary/12 text-primary">
        {isSetup ? <KeyRound className="size-5" /> : <AlertTriangle className="size-5" />}
      </div>
      <h1 className="mt-4 font-display text-lg font-semibold tracking-tight text-foreground">
        {isSetup ? "Connect your spreadsheet" : "Couldn't load your data"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{result.message}</p>
      {isSetup && result.code === "missing_spreadsheet_id" ? (
        <p className="mt-4 rounded-lg bg-muted/60 px-4 py-3 text-left text-xs text-muted-foreground">
          Send the link to your expense sheet in chat and it will be connected for you. Nothing in
          the sheet gets changed — the dashboard only reads it.
        </p>
      ) : null}
    </div>
  );
}

/** Rows sitting in a year tab that don't match their own year. */
export function DataQualityNotice({ issues }: { issues: DataQualityIssue[] }) {
  if (issues.length === 0) return null;
  const shown = issues.slice(0, 4);

  return (
    <details className="panel group border-warning/35 bg-warning/[0.06] p-4">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 text-sm">
        <TriangleAlert className="size-4 shrink-0 text-warning" />
        <span className="font-medium text-foreground">
          {issues.length} {issues.length === 1 ? "row sits" : "rows sit"} in the wrong year tab
        </span>
        <span className="ml-auto text-xs text-muted-foreground group-open:hidden">Show</span>
      </summary>
      <ul className="mt-3 space-y-1.5 border-t border-warning/25 pt-3 text-xs text-muted-foreground">
        {shown.map((issue, i) => (
          <li key={i} className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium text-foreground">{issue.label || "Entry"}</span>
            <span className="num">{money(issue.amount)}</span>
            <span>
              dated {fullDateLabel(issue.actualDate)} but listed under {issue.sheet}
            </span>
          </li>
        ))}
        {issues.length > shown.length ? <li>and {issues.length - shown.length} more…</li> : null}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        These are counted by their real date here, so the totals stay correct.
      </p>
    </details>
  );
}
