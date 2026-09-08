# Multi-user, self-hostable expense dashboard

Turn the current single-sheet dashboard into an app where anyone can sign up, link their own Google Sheet, and see only their own data — and where the whole thing can be run by someone else from your Git repo.

## What changes for a new user

1. Sign up with email and password.
2. Click "Make a copy" on the template sheet we link to. They get their own copy in their Drive with all the tabs the bot and dashboard expect.
3. Share that copy (edit access) with the app's Google address, which the setup screen shows them.
4. Paste the sheet link. The app checks the tabs, saves the link to their account, and the dashboard fills up.
5. Everything after that — Overview, Expenses, Investments, Loans, quick add, undo — works exactly as today, but scoped to their sheet.

If a tab is missing or the sheet isn't shared, the setup screen says exactly which one and how to fix it.

## Login and accounts

- Email + password sign-up and sign-in, with a password reset by email.
- Pages are private: not signed in means you land on the sign-in screen.
- Each account stores: their sheet link, the person handles they use, and their last quick-add choice.
- No one can read another account's sheet link or data.

## Self-hosting

Today the app reads Google through Lovable's shared connector, which only works while hosted here. For a self-hosted copy that must go away, so the app moves to a standard Google service account:

- Whoever runs the app creates a Google Cloud service account (free), enables the Sheets API, and puts its credentials in the app's settings. That account's email address is what users share their sheet with.
- This also removes the "quota exceeded" problem you hit, because the quota becomes yours alone instead of shared with every other Lovable app.
- The README gets a short setup guide: create the service account, create the accounts database, set five settings, run it.

The hosted Lovable version and a self-hosted version then run the same code.

## Template sheet

A public, view-only spreadsheet with empty `Master`, `Loan Master`, `Investment Master`, `Loan repayment`, `Investment Summary`, one `YYYY Overview` and one `YYYY-MM` tab, with the exact column headers the app and your Telegram bot use, plus a starter category list in `Master`. The app links to it with `/copy` so one click makes a personal copy.

## Technical notes

- Accounts and sessions come from Lovable Cloud (Supabase) with email/password auth. A `user_settings` table holds `user_id`, `spreadsheet_id`, `default_person`, protected by row-level security so a row is only readable by its owner; grants for `authenticated` and `service_role`.
- New `src/lib/google-auth.server.ts` mints a Google access token from a service-account JWT (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`) using Web Crypto, cached until expiry. `sheets.server.ts` swaps the connector gateway base URL and headers for `https://sheets.googleapis.com/v4` with a bearer token; every exported function takes `spreadsheetId` as an argument instead of reading one env var.
- All server functions in `expense.functions.ts` gain `.middleware([requireSupabaseAuth])`, look up the caller's `spreadsheet_id`, and pass it down. The in-memory dataset cache becomes keyed by spreadsheet id.
- Routes move under `_authenticated/`; new public `/auth` (sign in / sign up / reset) and gated `/setup` (paste link, validate tabs) routes. `/setup` redirects here when the account has no sheet yet.
- Sheet validation reads tab titles once and reports missing tabs and permission errors distinctly (403 = not shared with the service account).
- `README.md` rewritten as a self-hosting guide; `.env.example` added.

## Out of scope for this phase

- Editing or deleting older entries
- Investment and loan entry from the app
- Teams or shared sheets between accounts
- Native App Store builds
