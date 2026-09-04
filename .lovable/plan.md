# Expense Tracker Dashboard PWA

## Goal
A mobile-first, read-only dashboard PWA that visualizes the expense, investment, and loan data already living in your Google Sheet. Your Telegram bot stays exactly as it is and remains the only way data gets written.

## Why PWA, not native
Lovable builds web apps. A PWA installs to your iPhone home screen, opens full-screen like an app, and needs no App Store review. It reuses your existing Google Sheet as the database, so there is no migration.

## Cost
Lovable connectors are free. The Google Sheets API free quota is far above what this dashboard will use.

## Confirmed decisions
- Read-only dashboard first. No writing to the sheet in this phase.
- Simple user filter (aniketthanage / gauri_2009). Real login added later.
- The manual summary block in monthly sheets (columns L-P) is ignored; the dashboard computes its own totals from the transaction rows.
- `YYYY Overview` tabs should contain only that year's investments. The dashboard filters rows by actual date, so the stray 2025 rows in `2026 Overview` will not double-count, and the dashboard surfaces a small data-quality notice listing them.

## Verified sheet structure

```text
Master                Expense Item | Category | Keywords          (+ category list in col F)
Loan Master           Category | Bank | Description | Amount
Investment Master     Category | Risk Level | Description
Loan repayment        Date | Amount | User | Loan | Description
Investment Summary    Year | Total Invested | Total Returns | ROI | Best Category
                      (+ category x year pivot to the right)
YYYY Overview         Date | Amount | Category | User | Description | Returns | Return Date
YYYY-MM  (monthly)    Date | Amount | Description | Category | User | Details
```

Note: monthly sheets put Description before Category, which differs from the repo README. The dashboard uses the real order above.

Known data quirks the dashboard must tolerate:
- Dates appear both as real date cells and as `DD/MM/YYYY` text. A single parser handles both.
- Some monthly sheets have trailing junk columns and a floating summary block; only columns A-F are read.
- Category and user values are trimmed and case-normalized before grouping.

## What gets built

### Data layer
- Link the `google_sheets` connector to the project.
- Server functions (never called from the browser directly) that read:
  - Every `YYYY-MM` tab for a selected year, columns A-F
  - `Loan repayment` and `Loan Master`
  - All `YYYY Overview` tabs for investments, plus `Investment Master`
  - `Master` for the category list
- A shared normalizer converts every row to a clean typed record with a parsed date.
- Results are cached so the dashboard does not re-hit the Sheets API on every render.

### Dashboard screens

**Overview (home)**
- Current month total, previous month total, and percent change
- Split by user for the month
- Category breakdown as a ranked list with bars
- Recent transactions list
- Month and year selector

**Expenses**
- Full transaction table for the selected month, sorted by date
- Filter by category and by user
- Search by description
- Monthly trend chart across the selected year

**Investments**
- Total invested per year and lifetime total
- Breakdown by investment category with risk level from `Investment Master`
- Year-on-year comparison chart
- Per-user split

**Loans**
- Outstanding principal per loan from `Loan Master`
- Total repaid per loan from `Loan repayment`
- Repayment timeline chart
- Per-user repayment split

### PWA and design
- Installable: manifest, icons, offline shell, standalone display mode
- Bottom tab navigation sized for one-handed phone use, widening to a sidebar layout on desktop
- Indian rupee formatting with lakh/crore grouping
- A design system built around a calm dark financial palette, defined once in `src/styles.css` as semantic tokens

## Technical notes
- TanStack Start with server functions for all Sheets access, so the connector credential never reaches the browser
- TanStack Query for caching and background refresh
- Recharts for the trend and comparison charts
- Route loaders prefetch data so the first paint already has numbers

## Out of scope this phase
- Writing or editing entries from the app
- Replacing or modifying the Telegram bot
- Per-user authentication
- Native App Store / Play Store builds

## What I need from you to start
Your Google Sheet URL, and approval to link the Google Sheets connector so the dashboard reads live data instead of the uploaded snapshot.

## Later phases (not now)
1. Add expense entry from the phone, with auto-categorization from `Master`
2. Investment and loan entry
3. Edit and delete recent entries
4. Real per-user login via Lovable Cloud
5. Budgets and alerts
