import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // The stored session is the source of truth. getSession() refreshes an
    // expired access token automatically, and only clears the session when the
    // refresh token is truly dead — a transient network or server error keeps
    // it, so a hiccup never throws the user back to the login screen.
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
    return { user: data.session.user };
  },
  component: () => <Outlet />,
});
