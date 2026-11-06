# Earnings on Overview

## Goal
Add household earnings while keeping Google Sheets as the master record and the existing database snapshot as the fast local copy. Keep entry on the Overview screen, near its month controls; do not add another navigation page.

## User experience
- Add a compact “Add earning” action beside the Overview month selector. It opens a structured entry form with amount, date (today by default; past dates allowed, future dates blocked), category, person, and optional description.
- Use these initial categories: Salary, Freelance, Business, Interest & Dividends, Rental, Bonus, Gifts, Other. Categories remain editable by adding rows to the new sheet master tab.
- Default the person to the signed-in user’s saved entry name, while allowing another household member to be selected. Show success/error and an Undo action after saving.
- Keep the entry action available for a newly connected, empty household sheet. Show monthly income alongside the existing Overview totals and include earnings in the selected month’s data even when there are no expenses.

## Google Sheets and cached data
- Add `Earning Master` with a `Category` column and the eight starter category rows when the tab is first created.
- Add `Earnings` with columns `Date`, `Amount`, `Category`, `User`, `Description`; create it on the first earning entry.
- Write each entry to Google Sheets first, then update the existing local snapshot so the UI refreshes immediately. The existing “Sync from Sheets” remains one-way from the Sheet to the cache.
- Extend the cached dataset with earning records and categories, and treat older snapshots without those fields as empty earnings. No database migration is needed because the current snapshot stores the dataset as JSON.
- Include earnings in shared person/year discovery, the Overview month selector, Reports filters/totals/trends/category and person comparisons, and Yearly comparisons. Keep spending and investment totals distinct; do not count earnings as spending or outflow.

## Technical details
- Follow existing authenticated server-function, Google Sheets, and snapshot patterns; validate positive amounts, date, category, and person before writing.
- Create the earning entry form as a focused component and mount it in both the normal Overview and empty-data states.
- Add focused tests for the eight starter categories, earnings parsing/cache compatibility, and monthly/yearly aggregations. Verify the entry and Undo paths without writing test data to the live Sheet.
