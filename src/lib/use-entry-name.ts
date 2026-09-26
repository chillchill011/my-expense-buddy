import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { getMySettings } from "@/lib/settings.functions";

/** Turns rahul@gmail.com into "rahul". */
export function nameFromEmail(email: string | null | undefined): string {
  const prefix = (email ?? "").split("@")[0] ?? "";
  return prefix.trim().slice(0, 60);
}

/**
 * The name this account writes into the sheet: their saved profile name, or
 * their email handle as a fallback. Never a hardcoded person.
 */
export function useEntryName(): string {
  const fetchSettings = useServerFn(getMySettings);
  const settings = useQuery({ queryKey: ["user-settings"], queryFn: () => fetchSettings() });
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setEmail(data.session?.user.email ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (settings.data?.defaultPerson ?? "").trim() || nameFromEmail(email);
}

/** Merges the signed-in person into the names discovered from the sheet. */
export function peopleWithMe(sheetUsers: string[], me: string): string[] {
  const all = me ? [me, ...sheetUsers] : sheetUsers;
  return Array.from(new Set(all.filter(Boolean)));
}
