# My Expense Buddy

A phone-friendly dashboard for household expenses, investments, loan repayments and
monthly budgets. **Your Google Sheet is the master copy of all data.** The app keeps a
fast copy in a small database so it opens quickly, but it never changes your sheet
unless you add, delete or set something from the app.

This guide is written for non-programmers. Read it top to bottom once, then keep it as
a reference.

---

## 1. The big picture (how it works)

```text
   You (phone / laptop)
          |
          v
   +--------------+      reads & writes      +------------------+
   |   The app    | -----------------------> |  Google Sheet    |  <- master data
   | (web pages + |                          |  (your tabs)     |
   |  server code)|                          +------------------+
   +--------------+
          |  keeps a fast copy + logins
          v
   +--------------+
   |  Database    |  <- accounts, which sheet you linked, cached copy of sheet
   +--------------+
```

- **Adding an entry** (expense, investment, loan repayment, budget): written to the
  Google Sheet first, then to the fast copy.
- **Deleting an entry** (from Search): the exact matching row is removed from the sheet,
  then from the fast copy. If no exact match is found, nothing is deleted.
- **Sync from Sheets** (button in the header): copies the sheet into the fast copy.
  One direction only — Sheets to app. It never edits the sheet.
- **Auto-check**: when you open the app and the copy is older than 15 minutes, it syncs
  in the background.
- **New tabs**: if a monthly tab (`2026-10`) or yearly tab (`2027 Overview`) is missing
  when you add an entry, the app creates it. No Telegram bot or cron job is needed.

## 2. Starter spreadsheet template

If you are setting this up for the first time (or for someone else), start from the
ready-made template:

**https://docs.google.com/spreadsheets/d/1H3qoj5mNiFcI-HGEDbHkCAbiRXkBz_EenXFVI3AQLVo/edit?usp=sharing**

1. Open the link (view-only) and choose **File -> Make a copy**. The copy lands in your
   own Google Drive and belongs to you.
2. Share your copy with the app's Google service account address as an **Editor**
   (the address is shown on the app's *Sheet settings* page).
3. In the app, open the account menu (top-right) -> **Sheet settings**, paste the link
   to *your copy*, and press **Connect**.

The template already contains the tabs listed below. Monthly tabs (`2026-10`) and yearly
investment tabs (`2027 Overview`) are created automatically by the app when needed, but
`Master`, `Investment Master` and `Loan Master` must exist, so always start from a copy
of this template rather than a blank sheet.

## 3. What is in the spreadsheet

| Tab | Columns |
| --- | --- |
| `YYYY-MM` (one per month) | Date, Amount, Description, Category, User, Details |
| `YYYY Overview` (investments per year) | Date, Amount, Category, User, Description, Returns, Return Date |
| `Master` | Expense Item, Category, Keywords (used to pick expense categories) |
| `Investment Master` | Category, Risk Level, Description |
| `Loan Master` | Category, Bank, Description, Amount |
| `Loan repayment` | Date, Amount, User, Loan, Description |
| `Monthly Budgets` | Month (`YYYY-MM`), Budget Amount, Notes, Updated |

Dates are written as `DD/MM/YYYY`. You can still edit the sheet by hand — just press
**Sync** in the app afterwards.

## 4. What the code folders mean

| Folder / file | What it does |
| --- | --- |
| `src/routes/` | One file per page (Overview, Expenses, Investments, Loans, Search, Setup, Sign in) |
| `src/components/` | Reusable blocks: quick add box, budget card, charts, menus |
| `src/lib/sheets.server.ts` | Talks to Google Sheets (read, append, delete, create tabs) |
| `src/lib/expense-data.server.ts` | Reads all tabs and turns them into clean data |
| `src/lib/expense.functions.ts` | Actions the app can do: add, undo, delete, sync, set budget |
| `src/lib/snapshot.server.ts` | Keeps the fast database copy up to date |
| `src/lib/google-auth.server.ts` | Logs in to Google with the service account |
| `supabase/migrations/` | The database setup scripts (tables and security rules) |
| `public/` | App icon, install manifest, offline support |

Built with React + TanStack Start (web framework), Tailwind (styling), and a
PostgreSQL database with logins (Supabase-compatible).

## 5. Backups (do this regularly)

Your real data lives in Google Sheets, so backing up the sheet is the most important.

1. **Google Sheet** — open it, then **File → Make a copy** once a month. Or
   **File → Download → Microsoft Excel** and store the file somewhere safe. Google also
   keeps history under **File → Version history**.
2. **Code** — the code is on GitHub. That is already a backup. You can also click
   **Code → Download ZIP** on GitHub.
3. **Database** — nothing unique lives there except logins and which sheet is linked.
   The cached copy can always be rebuilt with **Sync**. So losing it is not a disaster.
4. **Secrets** — save your Google service account JSON key file in a password manager.
   Never put it on GitHub.

## 6. Hosting today (Lovable)

The app runs on Lovable hosting with Lovable Cloud as the database. Secrets
(`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`) are stored in the
project's secrets. Nothing else is needed.

## 7. Moving away from Lovable (step by step)

You need three free things: **code hosting** (GitHub), a **database** (Supabase free
tier), and **app hosting** (Vercel, Netlify or Cloudflare — all have free plans).

### Step 1 — Get the code
1. In Lovable, connect the project to GitHub (Settings → GitHub) if not already done.
2. On your computer install **Node.js 20 or newer** from https://nodejs.org (click the
   "LTS" button, then next-next-finish). Also install **Git** from https://git-scm.com.
3. Open a terminal (Mac: *Terminal*; Windows: *PowerShell*) and run:
   ```sh
   git clone https://github.com/<your-name>/<your-repo>.git
   cd <your-repo>
   npm install
   ```

### Step 2 — Create the database
1. Sign up at https://supabase.com and create a new project (free). Pick a region
   near you and save the database password.
2. Open **SQL Editor**, and paste + run each file in `supabase/migrations/` in date
   order (oldest first). This creates the tables and security rules.
3. Open **Authentication → Providers** and make sure **Email** is enabled.
4. Open **Project Settings → API** and copy the **Project URL** and the
   **publishable (anon) key**.

Accounts from Lovable do not move automatically — you and your spouse simply sign up
again and link the same sheet on the **Sheet** page. Your data is in the sheet, so
nothing is lost.

### Step 3 — Google access
Use the same service account as today (see section 8). No changes to the sheet
needed — it is already shared with that address.

### Step 4 — Fill in settings
Copy `.env.example` to a new file named `.env` and fill it in:

| Variable | Where it comes from |
| --- | --- |
| `VITE_SUPABASE_URL` / `SUPABASE_URL` | Supabase Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (secret, server only) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` from the JSON key |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | `private_key` from the JSON key |
| `VITE_TEMPLATE_SHEET_ID` | Optional starter spreadsheet id |

In `.env`, write the private key on one line in double quotes with `\n` where the line
breaks are. In a hosting dashboard, paste it exactly as it appears in the JSON file.

### Step 5 — Try it on your computer
```sh
npm run dev
```
Open http://localhost:8080, sign up, link your sheet, check the pages.

### Step 6 — Put it online (Vercel example)
1. Sign up at https://vercel.com with your GitHub account.
2. **Add New → Project**, pick your repository.
3. Build command `npm run build`. Add every variable from Step 4 under
   **Environment Variables**.
4. Click **Deploy**. You get a link like `your-app.vercel.app`.
5. In Supabase → **Authentication → URL Configuration**, set the Site URL to that link.
6. On your iPhone open the link in Safari → Share → **Add to Home Screen**.

Netlify and Cloudflare Pages work the same way: connect GitHub, set the build command
and the environment variables. The project is built for edge hosting; if a host needs
a specific adapter, check its TanStack Start guide.

### Things to know about free plans
- Supabase free projects pause after about a week of no use; open the dashboard and
  click **Restore**. Daily use by two people keeps it awake.
- Google Sheets API allows plenty of requests for two people.
- Free plans can change. Because the sheet is master, you can always move again.

## 8. Everyday tips

- Added rows by hand in the sheet? Press **Sync**.
- Numbers look wrong? Press **Sync**, then check the sheet for typos in dates or amounts.
- Budgets: set or change any month's budget on the Overview or Expenses page — tap the
  pencil next to a month in **Budget history**.
- Loan repayment amounts include interest; they count towards **Total outflow**.

## 9. Google service account (one-time setup)

1. Go to https://console.cloud.google.com and create a project.
2. **APIs & Services → Library** → search **Google Sheets API** → **Enable**.
3. **APIs & Services → Credentials → Create credentials → Service account** → name it →
   **Done**.
4. Open it → **Keys** → **Add key → Create new key → JSON**. A file downloads.
5. From that file copy `client_email` and `private_key` into the settings above.
6. Open your Google Sheet → **Share** → paste the `client_email` → **Editor** → untick
   *Notify* → **Share**.

| Problem | Meaning |
| --- | --- |
| `403 The caller does not have permission` | Sheet not shared with the service account |
| `404` when linking | Wrong sheet link |
| `429 Quota exceeded` | Service account variables missing or misspelled |
| `invalid_grant` | Private key pasted incompletely |

Never commit the JSON key or `.env` to GitHub.
