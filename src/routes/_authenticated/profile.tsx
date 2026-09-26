import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ExternalLink, Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { getMySettings, saveDefaultPerson } from "@/lib/settings.functions";
import { useTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your account | Rupeeflow" },
      {
        name: "description",
        content:
          "See your sign-in details, change your password, pick light or dark mode, and check which spreadsheet is connected.",
      },
      { property: "og:title", content: "Your account | Rupeeflow" },
      {
        property: "og:description",
        content: "Account details, password changes and appearance settings for your expense dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel space-y-4 p-5">
      <div>
        <h2 className="font-display text-base font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ProfilePage() {
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const fetchSettings = useServerFn(getMySettings);
  const savePerson = useServerFn(saveDefaultPerson);

  const [account, setAccount] = useState<{ email: string; createdAt: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return;
      setAccount({ email: data.user.email ?? "—", createdAt: data.user.created_at ?? null });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const settings = useQuery({ queryKey: ["user-settings"], queryFn: () => fetchSettings() });

  const [person, setPerson] = useState("");
  const [personSaved, setPersonSaved] = useState(false);
  useEffect(() => {
    if (settings.data) setPerson(settings.data.defaultPerson ?? "");
  }, [settings.data]);

  const personMutation = useMutation({
    mutationFn: (value: string) => savePerson({ data: { person: value } }),
    onSuccess: async () => {
      setPersonSaved(true);
      setTimeout(() => setPersonSaved(false), 2500);
      await queryClient.invalidateQueries({ queryKey: ["user-settings"] });
    },
  });

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwMessage, setPwMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const passwordMutation = useMutation({
    mutationFn: async () => {
      if (password.length < 8) throw new Error("Use at least 8 characters.");
      if (password !== confirm) throw new Error("The two passwords don't match.");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setPassword("");
      setConfirm("");
      setPwMessage({ tone: "ok", text: "Your password has been changed." });
    },
    onError: (error) =>
      setPwMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Something went wrong.",
      }),
  });

  const sheetId = settings.data?.spreadsheetId ?? null;
  const memberSince = account?.createdAt
    ? new Date(account.createdAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  const inputClass =
    "w-full rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary";

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Your account
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign-in details, password, appearance and the spreadsheet you are connected to.
          </p>
        </header>

        <Section title="Signed in as">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Email</dt>
              <dd className="mt-0.5 break-all text-foreground">{account?.email ?? "…"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Member since</dt>
              <dd className="mt-0.5 text-foreground">{memberSince ?? "…"}</dd>
            </div>
          </dl>
        </Section>

        <Section
          title="Appearance"
          description="Pick a look, or follow whatever your phone is set to."
        >
          <div className="flex flex-wrap gap-2">
            {THEMES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-2 text-sm text-muted-foreground transition hover:text-foreground",
                  theme === value && "border-ring bg-muted text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
        </Section>

        <Section
          title="Your name in entries"
          description="This name is picked by default when you add an expense or investment."
        >
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              personMutation.mutate(person.trim());
            }}
          >
            <input
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              placeholder="e.g. your first name"
              className={cn(inputClass, "min-w-0 flex-1")}
            />
            <button
              type="submit"
              disabled={personMutation.isPending}
              className="rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {personMutation.isPending ? "Saving…" : "Save"}
            </button>
          </form>
          {personSaved ? <p className="text-xs text-positive">Saved.</p> : null}
        </Section>

        <Section title="Change password" description="At least 8 characters.">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setPwMessage(null);
              passwordMutation.mutate();
            }}
          >
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              className={inputClass}
            />
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat new password"
              className={inputClass}
            />
            <button
              type="submit"
              disabled={passwordMutation.isPending || !password || !confirm}
              className="rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {passwordMutation.isPending ? "Updating…" : "Update password"}
            </button>
          </form>
          {pwMessage ? (
            <p
              className={cn(
                "text-sm",
                pwMessage.tone === "ok" ? "text-positive" : "text-destructive",
              )}
            >
              {pwMessage.text}
            </p>
          ) : null}
        </Section>

        <Section
          title="Connected spreadsheet"
          description="All your records live in this Google Sheet. The app only reads it and adds the rows you type."
        >
          {sheetId ? (
            <div className="flex flex-wrap items-center gap-3">
              <CheckCircle2 className="size-5 text-positive" />
              <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{sheetId}</p>
              <a
                href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted/60"
              >
                Open <ExternalLink className="size-3.5" />
              </a>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No spreadsheet connected yet.</p>
          )}
          <Link
            to="/setup"
            className="inline-flex rounded-full border border-border px-3.5 py-2 text-sm text-foreground hover:bg-muted/60"
          >
            Sheet settings
          </Link>
        </Section>
      </div>
    </AppShell>
  );
}
