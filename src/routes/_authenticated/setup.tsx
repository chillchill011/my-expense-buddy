import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ExternalLink, Sheet } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { dashboardQueryOptions } from "@/lib/dashboard-query";
import {
  getMySettings,
  linkSpreadsheet,
  unlinkSpreadsheet,
  type LinkSheetResult,
} from "@/lib/settings.functions";

/** Optional: a public, view-only starter spreadsheet users can copy. */
const TEMPLATE_ID = import.meta.env["VITE_TEMPLATE_SHEET_ID"] as string | undefined;

const REQUIRED_TABS = [
  "Master",
  "Loan Master",
  "Investment Master",
  "Loan repayment",
  "Investment Summary",
  "YYYY Overview",
  "YYYY-MM (one per month)",
];

export const Route = createFileRoute("/_authenticated/setup")({
  head: () => ({
    meta: [
      { title: "Connect your sheet | Expense Tracker Dashboard" },
      {
        name: "description",
        content:
          "Copy the starter spreadsheet, share it with the app, and paste the link to fill your expense dashboard with your own data.",
      },
      { property: "og:title", content: "Connect your sheet | Expense Tracker Dashboard" },
      {
        property: "og:description",
        content: "Link your own Google Sheet to your private expense dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SetupPage,
});

function SetupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchSettings = useServerFn(getMySettings);
  const link = useServerFn(linkSpreadsheet);
  const unlink = useServerFn(unlinkSpreadsheet);

  const settings = useQuery({
    queryKey: ["user-settings"],
    queryFn: () => fetchSettings(),
  });

  const [value, setValue] = useState("");
  const [result, setResult] = useState<LinkSheetResult | null>(null);

  const save = useMutation({
    mutationFn: (input: string) => link({ data: { link: input } }),
    onSuccess: async (res) => {
      setResult(res);
      if (res.status === "linked") {
        setValue("");
        await queryClient.invalidateQueries({ queryKey: ["user-settings"] });
        await queryClient.invalidateQueries({ queryKey: dashboardQueryOptions.queryKey });
        navigate({ to: "/" });
      }
    },
    onError: (error) =>
      setResult({
        status: "error",
        message: error instanceof Error ? error.message : "Something went wrong.",
      }),
  });

  const remove = useMutation({
    mutationFn: () => unlink(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["user-settings"] });
      await queryClient.invalidateQueries({ queryKey: dashboardQueryOptions.queryKey });
    },
  });

  const current = settings.data?.spreadsheetId ?? null;
  const shareWith = settings.data?.shareWith ?? null;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Connect your spreadsheet
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your entries stay in your own Google Sheet. This app only reads it and adds the rows you
            type.
          </p>
        </header>

        {current ? (
          <div className="panel flex flex-wrap items-center gap-3 p-4">
            <CheckCircle2 className="size-5 text-positive" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">A sheet is connected</p>
              <p className="truncate text-xs text-muted-foreground">{current}</p>
            </div>
            <a
              href={`https://docs.google.com/spreadsheets/d/${current}/edit`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted/60"
            >
              Open <ExternalLink className="size-3.5" />
            </a>
            <button
              type="button"
              onClick={() => remove.mutate()}
              className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Disconnect
            </button>
          </div>
        ) : null}

        <ol className="panel space-y-5 p-5 text-sm">
          <li>
            <p className="font-medium text-foreground">1. Start from the template</p>
            {TEMPLATE_ID ? (
              <a
                href={`https://docs.google.com/spreadsheets/d/${TEMPLATE_ID}/copy`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Sheet className="size-3.5" /> Make a copy
              </a>
            ) : (
              <div className="mt-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                <p>Your sheet needs these tabs, with the same column headings:</p>
                <ul className="mt-1.5 list-inside list-disc space-y-0.5">
                  {REQUIRED_TABS.map((tab) => (
                    <li key={tab}>{tab}</li>
                  ))}
                </ul>
              </div>
            )}
          </li>

          <li>
            <p className="font-medium text-foreground">2. Share it with the app</p>
            {shareWith ? (
              <p className="mt-1.5 break-all rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                Give edit access to <span className="text-foreground">{shareWith}</span>
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">
                This copy of the app already has access through its own Google connection — nothing
                to share.
              </p>
            )}
          </li>

          <li>
            <p className="font-medium text-foreground">3. Paste the link</p>
            <form
              className="mt-2 flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setResult(null);
                save.mutate(value);
              }}
            >
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/…"
                className="min-w-0 flex-1 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={save.isPending || !value.trim()}
                className="rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                {save.isPending ? "Checking…" : "Connect"}
              </button>
            </form>
            {result && result.status !== "linked" ? (
              <p className="mt-2 text-sm text-destructive">{result.message}</p>
            ) : null}
          </li>
        </ol>
      </div>
    </AppShell>
  );
}
