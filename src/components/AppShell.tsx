import { Link, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, ReceiptText, TrendingUp, Landmark, Settings, LogOut } from "lucide-react";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/expenses", label: "Expenses", icon: ReceiptText },
  { to: "/investments", label: "Invest", icon: TrendingUp },
  { to: "/loans", label: "Loans", icon: Landmark },
  { to: "/setup", label: "Sheet", icon: Settings },
] as const;

function SignOutButton({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={async () => {
        await supabase.auth.signOut();
        navigate({ to: "/auth" });
      }}
      className={cn(
        "flex items-center gap-2 rounded-lg text-muted-foreground transition-colors hover:text-foreground",
        compact ? "text-xs" : "px-3 py-2.5 text-sm font-medium hover:bg-sidebar-accent",
      )}
    >
      <LogOut className="size-4" />
      <span>Sign out</span>
    </button>
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
        <div className="mt-auto pt-6">
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/85 px-4 py-3 backdrop-blur-lg lg:hidden">
          <p className="font-display text-base font-semibold tracking-tight">
            Expense<span className="text-primary">.</span>
          </p>
          <SignOutButton compact />
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
