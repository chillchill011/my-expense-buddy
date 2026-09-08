import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UserSettings = {
  spreadsheetId: string | null;
  defaultPerson: string | null;
  lastQuickAddUser: string | null;
  /** The Google address a user must share their sheet with, when self-hosted. */
  shareWith: string | null;
};

export type LinkSheetResult =
  | { status: "linked"; spreadsheetId: string }
  | { status: "invalid_link"; message: string }
  | { status: "no_access"; message: string }
  | { status: "missing_tabs"; message: string; tabs: string[] }
  | { status: "error"; message: string };

/** Tabs the dashboard and the Telegram bot both depend on. */
const REQUIRED_TABS = ["Master", "Loan Master", "Investment Master"];

/** Pulls the id out of a full Google Sheets URL, or accepts a bare id. */
export function spreadsheetIdFrom(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  const fromUrl = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(value);
  if (fromUrl) return fromUrl[1] ?? null;
  return /^[a-zA-Z0-9-_]{20,}$/.test(value) ? value : null;
}

export const getMySettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserSettings> => {
    const { serviceAccountEmail } = await import("./google-auth.server");
    const { data } = await context.supabase
      .from("user_settings")
      .select("spreadsheet_id, default_person, last_quick_add_user")
      .eq("user_id", context.userId)
      .maybeSingle();

    return {
      spreadsheetId: data?.spreadsheet_id ?? null,
      defaultPerson: data?.default_person ?? null,
      lastQuickAddUser: data?.last_quick_add_user ?? null,
      shareWith: serviceAccountEmail(),
    };
  });

export const linkSpreadsheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { link: string; defaultPerson?: string }) => ({
    link: String(input.link ?? "").slice(0, 500),
    defaultPerson: String(input.defaultPerson ?? "").trim().slice(0, 60),
  }))
  .handler(async ({ data, context }): Promise<LinkSheetResult> => {
    const spreadsheetId = spreadsheetIdFrom(data.link);
    if (!spreadsheetId) {
      return {
        status: "invalid_link",
        message: "That doesn't look like a Google Sheets link. Paste the whole address bar link.",
      };
    }

    const { listTabTitles, SheetsAccessError, SheetsConfigError, SheetsRateLimitError } =
      await import("./sheets.server");

    try {
      const titles = await listTabTitles(spreadsheetId);
      const missing = REQUIRED_TABS.filter((t) => !titles.includes(t));
      if (missing.length > 0) {
        return {
          status: "missing_tabs",
          tabs: missing,
          message: `Your sheet is missing these tabs: ${missing.join(", ")}. Start from the template copy.`,
        };
      }

      const { error } = await context.supabase.from("user_settings").upsert(
        {
          user_id: context.userId,
          spreadsheet_id: spreadsheetId,
          default_person: data.defaultPerson || null,
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;

      return { status: "linked", spreadsheetId };
    } catch (error) {
      if (error instanceof SheetsAccessError) {
        return { status: "no_access", message: error.message };
      }
      if (error instanceof SheetsConfigError) {
        return { status: "error", message: error.message };
      }
      if (error instanceof SheetsRateLimitError) {
        return { status: "error", message: error.message };
      }
      const message = error instanceof Error ? error.message : String(error);
      console.error("Failed to link spreadsheet:", message);
      return { status: "error", message };
    }
  });

export const unlinkSpreadsheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase
      .from("user_settings")
      .upsert({ user_id: context.userId, spreadsheet_id: null }, { onConflict: "user_id" });
    return { ok: true };
  });

export const saveQuickAddUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { person: string }) => ({
    person: String(input.person ?? "").trim().slice(0, 60),
  }))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("user_settings")
      .upsert(
        { user_id: context.userId, last_quick_add_user: data.person || null },
        { onConflict: "user_id" },
      );
    return { ok: true };
  });
