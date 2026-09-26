import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { dashboardQueryOptions } from "@/lib/dashboard-query";
import { syncFromSheets, type DashboardResult } from "@/lib/expense.functions";
import { cn } from "@/lib/utils";

/** Refresh silently in the background when the stored copy is older than this. */
const AUTO_SYNC_AFTER_MS = 15 * 60_000;

/** Shared across route changes so the automatic check runs once, not per page. */
let lastAutoSyncAttempt = 0;

function agoLabel(syncedAt: number | null): string {
  if (!syncedAt) return "Not synced yet";
  const mins = Math.floor((Date.now() - syncedAt) / 60_000);
  if (mins < 1) return "Synced just now";
  if (mins < 60) return `Synced ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Synced ${hours}h ago`;
  return `Synced ${Math.floor(hours / 24)}d ago`;
}

export function SyncButton({ compact = false }: { compact?: boolean }) {
  const queryClient = useQueryClient();
  const run = useServerFn(syncFromSheets);
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);

  const cached = queryClient.getQueryData<DashboardResult>(dashboardQueryOptions.queryKey);
  const syncedAt = cached && cached.status === "ok" ? cached.syncedAt : null;

  // Keep the "x minutes ago" label honest while the app stays open.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const sync = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await run({});
      queryClient.setQueryData(dashboardQueryOptions.queryKey, result);
    } catch {
      await queryClient.invalidateQueries({ queryKey: dashboardQueryOptions.queryKey });
    } finally {
      setBusy(false);
    }
  }, [busy, queryClient, run]);

  // Automatic background check when the app is opened.
  useEffect(() => {
    if (!syncedAt) return;
    const now = Date.now();
    if (now - syncedAt < AUTO_SYNC_AFTER_MS) return;
    if (now - lastAutoSyncAttempt < AUTO_SYNC_AFTER_MS) return;
    lastAutoSyncAttempt = now;
    void sync();
  }, [syncedAt, sync]);

  return (
    <button
      type="button"
      onClick={() => void sync()}
      disabled={busy}
      title="Read the latest rows from your Google Sheet"
      className={cn(
        "flex items-center gap-2 rounded-lg text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60",
        compact ? "text-xs" : "px-3 py-2.5 text-sm font-medium hover:bg-sidebar-accent",
      )}
    >
      <RefreshCw className={cn("size-4", busy && "animate-spin")} />
      <span>{busy ? "Syncing…" : agoLabel(syncedAt)}</span>
    </button>
  );
}
