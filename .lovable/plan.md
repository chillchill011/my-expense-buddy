# Expense Tracker PWA + Dashboard Plan

## Goal
Build a mobile-first Progressive Web App (PWA) and dashboard that reads from and writes to your existing Google Sheets expense database. Your Telegram bot continues to work as a separate input method.

## Why PWA instead of native iOS/Android
Lovable builds web apps, not native mobile apps. A PWA gives you:
- Instant access on iOS/Android via browser
- Add-to-home-screen behavior like a native app
- No App Store / Play Store approval delays
- One codebase for mobile and dashboard
- Reuses your existing Google Sheets backend

## Cost
Lovable connectors are free. Google Sheets API also has a free quota. You only pay if you exceed Google's API limits or choose a paid Lovable plan.

## Proposed Architecture

```text
User (iPhone/browser)  <--->  Lovable PWA  <--->  TanStack Start server functions
                                                          |
                                                          v
                                                 Google Sheets connector
                                                          |
                                                          v
                                            Your existing Google Sheet
                                                          |
                                                          v
                                              Telegram bot (kept as-is)
```

## Data model (from your repo)
Your Google Sheet has these tabs:
- `Master`: item -> category mapping
- `Investment Master`: category, risk, platform
- `Loan Master`: category, bank
- `Loan Repayment`: date, amount, user, category, description
- `Investment Summary`: year, total invested, total returns, ROI, best category
- Monthly sheets named `YYYY-MM`: date, amount, user, category, description, details

## Build phases

### Phase 1: Connect Google Sheets and read data
- Link the `google_sheets` connector to this project.
- Build server functions that fetch:
  - Monthly expense rows from the current month's sheet
  - Category totals for the current month
  - Investment and loan summaries
- Render a dashboard with:
  - Total spent this month
  - Top spending categories
  - Recent transactions list

### Phase 2: Add expense entry
- Build a mobile-optimized form:
  - Amount
  - Description
  - Details (optional)
  - Date (default today)
  - Category picker (auto-suggest from Master sheet, or manual)
- Server function appends the row to the correct `YYYY-MM` sheet.
- If the item is new, offer to save it to the `Master` sheet for future auto-categorization.

### Phase 3: Dashboard polish + PWA
- Add summary cards, category breakdown chart, and month selector.
- Add a simple "user" selector so the app can attribute entries to the same users your Telegram bot uses.
- Add PWA manifest and service worker so it can be saved to the iOS home screen.
- Responsive layout that works on phone and desktop.

## Out of scope for this plan
- Replacing the Telegram bot
- Native iOS/Android app store builds
- Real-time sync / push notifications
- Multi-user authentication (optional; can be added later with Lovable Cloud)

## What I need from you to start
1. Your Google Sheets spreadsheet URL or spreadsheet ID, and permission to connect it via the Lovable Google Sheets connector.
2. Confirm the column order in your monthly sheets (e.g., Date, Amount, User, Category, Description, Details).
3. Confirm whether you want multi-user support in the PWA, or just a single personal view.
