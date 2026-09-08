# Quick add: type an expense like you do in Telegram

## Goal

A single text box at the top of the dashboard (and later the Expenses page) where you type an entry exactly the way you type it to your Telegram bot. It saves straight into the correct monthly tab of your sheet, shows a short confirmation, clears itself, and stays focused so you can type the next one.

## The rules, copied from your bot

Read from `src/bot.py` (`handle_expense`, `_get_category`, `_add_expense`):

```text
<amount> <description>[, details]

250 lunch
250 lunch with team, office card
1499.50 amazon order, headphones
```

- First word is the amount. Anything else is rejected as "invalid amount".
- Everything after the first space is the description; the first comma splits off optional details.
- Category is looked up from the `Master` tab (Expense Item -> Category), lowercased: exact match first, then any master item contained in the description. Same behaviour as the bot.
- If no category matches, the bot shows a category keyboard. The app shows the same thing: a row of category buttons under the box; tap one and the entry saves.
- The row written is `Date | Amount | Description | Category | User | Details` appended to the `YYYY-MM` tab, with the date as `DD/MM/YYYY` — identical to the bot.

## Who it saves as

A small person picker sits beside the box (aniketthanage / gauri_2009, plus anyone already in the sheet). Your last choice is remembered on that phone or browser, so you normally never touch it. Real login comes later.

## What happens after you hit send

1. The entry is written to the sheet.
2. A green line appears under the box: amount, description, category, person — plus an Undo that removes that row for a few seconds.
3. The box clears and keeps focus, ready for the next entry.
4. The dashboard numbers refresh to include the new entry.

## Monthly tabs

Your bot never creates monthly tabs — a scheduled GitHub Action (`scripts/create_sheets.py`) does that. So the app leaves tab creation alone. If the tab for today's month somehow doesn't exist, the app says so plainly ("the tab for this month hasn't been created yet") instead of guessing.

## Technical notes

- New server function `addExpense` in `src/lib/expense.functions.ts`, backed by a `values.append` call in `src/lib/sheets.server.ts` (`USER_ENTERED`, `INSERT_ROWS`, range `'YYYY-MM'!A:F`).
- Parsing lives in a pure, testable module `src/lib/expense-parse.ts` mirroring the bot's logic; category lookup reuses the `Master` rows already loaded into the dataset.
- Undo deletes the appended row by its returned row index (`batchUpdate` deleteDimension), guarded so it only ever removes the exact row just written.
- After a successful save the cached snapshot is invalidated so the 5-minute cache doesn't hide the new row.
- New `QuickAdd` component rendered at the top of `src/routes/index.tsx`, and reused on `src/routes/expenses.tsx`.

## One thing that may need your click

The Google Sheets connection is currently linked for reading. Writing may need a quick reconnect to grant write access — if so, a connect card appears in chat and it takes one tap.

## Out of scope here

Editing or deleting older entries, investments and loan entry, and per-user login — those come after this.
