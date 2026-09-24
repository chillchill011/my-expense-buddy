# My Expense Buddy

A mobile-friendly dashboard for household expenses, investments and loans that keeps
all data in **your own Google Sheet**. It pairs with the
[expenseBot](https://github.com/chillchill011/expenseBot) Telegram bot, which writes to
the same sheet.

Each person signs up with an email and password, links their own spreadsheet, and only
ever sees their own data.

## What it does

- Overview: this month's spending, change vs last month, split per person, category
  breakdown, latest 5 entries
- Expenses: year and month filters, person and category filters, search, monthly trend
- Investments: totals per year, categories with risk levels, year-on-year, per person
- Loans: payoff progress, repayment timeline, per person
- Quick add: type `250 lunch with team, office card` and it lands in this month's tab,
  with the category picked from your `Master` list — same rules as the Telegram bot
- Installable on a phone home screen (PWA), works offline for the app shell

## Using the hosted app

1. Create an account.
2. Copy the starter spreadsheet (or use the sheet your Telegram bot already writes to).
3. On the **Sheet** screen, share it with the address shown, then paste its link.

## Self-hosting

### 1. Requirements

- Node.js 20+ (or Bun)
- A Supabase project (free tier is fine) for accounts and settings
- A Google Cloud project with the Google Sheets API enabled

### 2. Google service account

Using your own service account means the Google Sheets API quota is yours alone,
instead of being shared — which avoids `429 Quota exceeded` errors.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a
   project (or open an existing one).
2. Open **APIs & Services → Library**, search for **Google Sheets API**, and click
   **Enable**.
3. Open **APIs & Services → Credentials → Create credentials → Service account**.
   Give it a name (e.g. `expense-manager`) and click **Done**.
4. Click the new service account, open the **Keys** tab, then
   **Add key → Create new key → JSON**. The key file downloads once — keep it safe.
5. Open the JSON file and copy two values out of it:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
     (looks like `expense-manager@your-project.iam.gserviceaccount.com`)
   - `private_key` → `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
     (the whole block, including the `-----BEGIN PRIVATE KEY-----` and
     `-----END PRIVATE KEY-----` lines)
6. Set both as environment variables (see **4. Environment** below). On Lovable
   hosting they go in the project's secrets; on Render or another host they are
   normal environment variables.
7. **Share each spreadsheet with the service account.** Open the Google Sheet,
   click **Share**, paste the `client_email` address, set it to **Editor** so quick
   add can write rows, untick *Notify people*, and click **Share**.

The app picks the service account automatically as soon as both variables are set,
and falls back to the built-in Google connection when they are missing.

**Troubleshooting**

| What you see | What it means |
| --- | --- |
| `403 The caller does not have permission` | The sheet hasn't been shared with the service account address yet (step 7) |
| `404` when linking a sheet | Wrong spreadsheet link, or the sheet was deleted |
| `429 Quota exceeded` | Still running on the shared connection — check both variables are set and spelled correctly |
| `invalid_grant` on start-up | The private key was pasted incomplete; copy the whole block including the BEGIN/END lines |


### 3. Database

Apply the migration in `supabase/migrations/` to your Supabase project. It creates
`user_settings` (which sheet each account linked, their default person) with row-level
security so a row is only readable by its owner. Enable **email/password** sign-in in
your Supabase project's auth settings.

### 4. Environment

Copy `.env.example` to `.env` and fill in the values:

| Variable | What it is |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase, browser side |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Supabase, server side |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account address users share sheets with |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | The service account private key |
| `VITE_TEMPLATE_SHEET_ID` | Optional. A public, view-only starter spreadsheet |

### 5. Run

```sh
npm install
npm run dev      # http://localhost:8080
npm run build    # production build
npm run start    # serve the build
```

Deploys anywhere that runs a Node or edge server (Render, Vercel, Netlify, Cloudflare,
Fly). On Render: build `npm run build`, start `npm run start`, and add the same
environment variables.

## Spreadsheet structure

| Tab | Columns |
| --- | --- |
| `Master` | Expense Item, Category, Keywords |
| `Loan Master` | Category, Bank, Description, Amount |
| `Investment Master` | Category, Risk Level, Description |
| `Loan repayment` | Date, Amount, User, Loan, Description |
| `Investment Summary` | Year, Total Invested, Total Returns, ROI, Best Category |
| `YYYY Overview` | Date, Amount, Category, User, Description, Returns, Return Date |
| `YYYY-MM` (one per month) | Date, Amount, Description, Category, User, Details |

Monthly tabs are created by the Telegram bot's scheduled job; the dashboard never
creates tabs.

## Built with Lovable

Continue developing this project in the
[Lovable editor](https://lovable.dev/projects/bfee60cb-a904-459e-a55c-a3574b51849a).
