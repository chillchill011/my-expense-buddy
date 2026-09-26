# Expense dashboard roadmap

- [x] Link Google Sheets connector
- [x] Design system (dark financial palette, Sora/Manrope/JetBrains Mono)
- [x] Data layer: read all tabs, normalise dates/amounts, cache
- [x] Overview screen (month total, change, per-person split, categories, recent)
- [x] Expenses screen (year, month, category, person filters, search, monthly trend)
- [x] Investments screen (per year, categories with risk, YoY, per-person)
- [x] Loans screen (payoff progress, repayment timeline, per-person)
- [x] PWA: manifest, icon, offline shell, standalone mode
- [x] Quick add box (Telegram-style text entry) on Overview and Expenses
- [x] Multi-user: email/password accounts, per-account sheet link, private data
- [x] Service-account Google access so the app can be self-hosted
- [x] Self-hosting guide in README + .env.example
- [x] Create monthly expense tabs and yearly Overview tabs automatically (no Telegram cron)
- [x] Database cache of the sheet + one-tap "Sync from Sheets" (auto-check after 15 min)
- [x] Beginner-friendly README: how the code works, backups, hosting, migration away from Lovable
- [x] Edit budgets for any month (history pencil) + budget card on Expenses
- [ ] Publish a public view-only template sheet and set VITE_TEMPLATE_SHEET_ID
- [ ] Later: edit/delete older entries
