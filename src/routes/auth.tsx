import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in | Expense Tracker Dashboard" },
      {
        name: "description",
        content:
          "Sign in or create an account to link your own Google Sheet and track household spending, investments and loans.",
      },
      { property: "og:title", content: "Sign in | Expense Tracker Dashboard" },
      {
        property: "og:description",
        content: "Sign in to your private expense dashboard, powered by your own Google Sheet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "reset";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      if (mode === "reset") {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (err) throw err;
        setNotice("Check your inbox for a link to set a new password.");
        return;
      }

      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (err) throw err;
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setNotice("Account created. Check your inbox to confirm your email, then sign in.");
          setMode("signin");
          return;
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }

      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="panel w-full max-w-sm p-6 sm:p-8">
        <p className="font-display text-lg font-semibold tracking-tight text-foreground">
          Expense<span className="text-primary">.</span>
        </p>
        <h1 className="mt-4 font-display text-xl font-semibold tracking-tight text-foreground">
          {mode === "signup"
            ? "Create your account"
            : mode === "reset"
              ? "Reset your password"
              : "Welcome back"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "reset"
            ? "We'll email you a link to choose a new password."
            : "Your data stays in your own Google Sheet."}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <label className="block text-sm">
            <span className="text-muted-foreground">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
            />
          </label>

          {mode !== "reset" ? (
            <label className="block text-sm">
              <span className="text-muted-foreground">Password</span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              />
            </label>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {notice ? <p className="text-sm text-positive">{notice}</p> : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {busy
              ? "Please wait…"
              : mode === "signup"
                ? "Create account"
                : mode === "reset"
                  ? "Send reset link"
                  : "Sign in"}
          </button>
        </form>

        <div className="mt-5 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <button
            type="button"
            className="underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => {
              setError(null);
              setNotice(null);
              setMode(mode === "signup" ? "signin" : "signup");
            }}
          >
            {mode === "signup" ? "I already have an account" : "Create an account"}
          </button>
          <button
            type="button"
            className="underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => {
              setError(null);
              setNotice(null);
              setMode(mode === "reset" ? "signin" : "reset");
            }}
          >
            {mode === "reset" ? "Back to sign in" : "Forgot password?"}
          </button>
        </div>
      </div>
    </main>
  );
}
