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

1. In Google Cloud, create a project and enable **Google Sheets API**.
2. Create a **service account** and download its JSON key.
3. Note `client_email` and `private_key` from that file.
4. Every user shares their spreadsheet with the `client_email` address (Editor access,
   so quick add can write).

This also means the API quota is yours alone.

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
