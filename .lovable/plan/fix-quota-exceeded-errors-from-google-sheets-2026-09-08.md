# Fix "Quota exceeded" errors from Google Sheets

## What happened

The 429 error does not come from your usage. All reads go through the shared
Lovable Google Sheets connector, and Google's per-minute limit applies to that
shared project (project_number:990896517898), not to your app alone. When many
apps read sheets at the same moment, the limit fills up and your dashboard gets
a 429 even if you haven't opened it for hours.

Your app itself is light (~3 read requests per page view), but we can make it
more resilient so this shared-limit spike doesn't break your screen.

## Changes

1. **Remember sheet data longer (server)** — `src/lib/expense-data.server.ts`
   - Raise the in-memory cache from 60 seconds to 5 minutes. The sheet only
     changes when the Telegram bot writes, so a 5-minute delay before new
     entries appear is acceptable.

2. **Re-read less often (browser)** — `src/lib/dashboard-query.ts`
   - Raise `staleTime` from 1 minute to 5 minutes.
   - Turn off automatic refetch when the window regains focus.

3. **Retry once, then show a friendly message** — `src/lib/sheets.server.ts`
   and the shared error/notice component used by all four pages
   - On a 429, wait ~20 seconds and retry the read once automatically.
   - If it still fails, show "Your sheet is busy right now — this usually
     clears within a minute" with a **Try again** button, instead of the raw
     Google error text.

4. **Verify**
   - Load all four pages and confirm data renders normally.
   - Confirm the retry/friendly error path via a temporary simulated 429,
     then remove the simulation.

## Notes

- If 429s keep happening frequently even after this, the remaining option is a
  dedicated Google Cloud project (your own Google Sheets credentials instead of
  the shared connector) — a bigger change we can discuss later if needed.
