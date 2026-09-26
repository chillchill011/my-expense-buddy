import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  ReceiptText,
  TrendingUp,
  Landmark,
  Search,
  Settings,
  LogOut,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { SyncButton } from "@/components/SyncButton";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/** Primary screens — these fill the phone's bottom bar and the sidebar. */
const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/expenses", label: "Expenses", icon: ReceiptText },
  { to: "/investments", label: "Invest", icon: TrendingUp },
  { to: "/loans", label: "Loans", icon: Landmark },
] as const;

function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}

/** Corner account button: sheet settings and sign out live behind this. */
function AccountMenu() {
  const [open, setOpen] = useState(false);
  const signOut = useSignOut();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        className={cn(
          "flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground",
          open && "border-ring text-foreground",
        )}
      >
        <UserRound className="size-4.5" />
      </button>

      {open ? (
        <div className="panel-raised absolute right-0 top-11 z-50 w-52 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-lg">
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <UserRound className="size-4 text-muted-foreground" />
            <span>Your account</span>
          </Link>
          <Link
            to="/setup"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <Settings className="size-4 text-muted-foreground" />
            <span>Sheet settings</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
          >
            <LogOut className="size-4 text-muted-foreground" />
            <span>Sign out</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function NavItems({ variant }: { variant: "bottom" | "side" }) {
  return (
    <>
      {NAV.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          activeOptions={{ exact: to === "/" }}
          className={cn(
            "group flex items-center gap-3 rounded-lg text-muted-foreground transition-colors",
            variant === "bottom"
              ? "flex-1 flex-col gap-1 px-1 py-2 text-[11px] font-medium"
              : "px-3 py-2.5 text-sm font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          )}
          activeProps={{
            className: cn(
              variant === "bottom"
                ? "text-primary"
                : "bg-sidebar-accent text-primary hover:text-primary",
            ),
          }}
        >
          <Icon className={variant === "bottom" ? "size-5" : "size-4.5"} strokeWidth={2} />
          <span>{label}</span>
        </Link>
      ))}
    </>
  );
}

/** Search now lives in the top corner instead of the bottom bar. */
function SearchLink() {
  return (
    <Link
      to="/search"
      aria-label="Open search"
      className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
      activeProps={{ className: "border-ring text-primary" }}
    >
      <Search className="size-4.5" />
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-6 lg:flex">
        <div className="px-3 pb-8">
          <p className="font-display text-lg font-semibold tracking-tight text-foreground">
            Expense<span className="text-primary">.</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Household ledger</p>
        </div>
        <nav className="flex flex-col gap-1">
          <NavItems variant="side" />
        </nav>
        <div className="mt-auto flex items-center justify-between gap-2 pt-6">
          <SyncButton compact />
          <div className="flex items-center gap-2">
            <SearchLink />
            <AccountMenu />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-lg lg:hidden">
          <div className="flex items-center gap-3">
            <SearchLink />
            <p className="font-display text-base font-semibold tracking-tight">
              Expense<span className="text-primary">.</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <SyncButton compact />
            <AccountMenu />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch gap-1 border-t border-border bg-background/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-lg lg:hidden">
        <NavItems variant="bottom" />
      </nav>
    </div>
  );
}
