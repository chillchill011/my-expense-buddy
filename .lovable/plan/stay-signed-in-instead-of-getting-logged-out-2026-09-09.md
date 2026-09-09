# Stay signed in instead of getting logged out

## What happens today

Every time you open a page, the app asks the auth server "is this login still valid?" and if that single check fails for any reason — a token being refreshed, the phone waking from sleep, a moment of bad network — it treats you as signed out and sends you back to the login screen. The login itself is stored permanently, so this is the gate being too strict, not the session actually ending.

## What changes

1. **Softer gate on protected pages** — the check first looks at the login stored on your device. If a session exists, you stay in the app; a temporary server or network error no longer throws you out. You only land on the login screen when there is genuinely no stored session (or after you press Sign out).
2. **Refresh the token quietly** — when the stored token is near expiry, the gate asks for a fresh one in the background; only a definitive "session is gone" answer signs you out, not an error.
3. **Keep sign-in fresh across pages** — a single listener reacts when the session is renewed or truly ends, so every open tab stays in sync without extra checks per page.

## Technical notes

- `src/routes/_authenticated/route.tsx`: `beforeLoad` uses `supabase.auth.getSession()` as the source of truth; redirect to `/auth` only when there is no session. When a session exists, attempt `getUser()`/`refreshSession()` to revalidate, but swallow transient errors and let the user through.
- Add the root `onAuthStateChange` subscriber in `src/routes/__root.tsx` (filter to `SIGNED_IN` / `SIGNED_OUT` / `USER_UPDATED`, call `router.invalidate()`, clear cached data on `SIGNED_OUT`) so token refreshes propagate and a real sign-out still kicks to `/auth`.
- Update `SignOutButton` in `src/components/AppShell.tsx` to the four-step cleanup (cancel queries, clear cache, sign out, replace-navigate to `/auth`) so deliberate sign-out still works cleanly.
- No change to how the session is stored — it already persists; preview iframe brokering stays as-is.
