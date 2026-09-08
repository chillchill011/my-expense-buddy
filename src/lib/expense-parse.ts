/**
 * Mirrors the Telegram bot's plain-text expense parser (`handle_expense` and
 * `_get_category` in src/bot.py of the expenseBot repo).
 *
 *   <amount> <description>[, details]
 *
 * The first whitespace-separated word is the amount. Everything after it is the
 * description, and the first comma splits off optional details.
 */

import type { CategoryRule } from "./expense-types";

export type ParsedEntry = {
  amount: number;
  description: string;
  details: string;
};

export type ParseResult = { ok: true; entry: ParsedEntry } | { ok: false; message: string };

export function parseEntry(input: string): ParseResult {
  const text = input.trim();
  if (!text) return { ok: false, message: "Type an amount and what it was for, e.g. 250 lunch" };

  const match = /^(\S+)\s+([\s\S]+)$/.exec(text);
  if (!match) {
    return { ok: false, message: "Add a short description after the amount, e.g. 250 lunch" };
  }

  const amount = Number(match[1]!.replace(/[₹,]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "That doesn't look like an amount. Start with a number, e.g. 250 lunch" };
  }

  const rest = match[2]!;
  const comma = rest.indexOf(",");
  const description = (comma === -1 ? rest : rest.slice(0, comma)).trim();
  const details = comma === -1 ? "" : rest.slice(comma + 1).trim();

  if (!description) {
    return { ok: false, message: "Add a short description after the amount, e.g. 250 lunch" };
  }

  return { ok: true, entry: { amount, description, details } };
}

/**
 * Same lookup order as the bot: exact match on the master expense item, then any
 * master item contained in the description. Keywords from the third Master
 * column are checked last as a small improvement over the bot.
 */
export function matchCategory(description: string, rules: CategoryRule[]): string | null {
  const needle = description.toLowerCase();

  for (const rule of rules) {
    if (rule.item && rule.item === needle) return rule.category;
  }
  for (const rule of rules) {
    if (rule.item && needle.includes(rule.item)) return rule.category;
  }
  for (const rule of rules) {
    for (const keyword of rule.keywords) {
      if (keyword && needle.includes(keyword)) return rule.category;
    }
  }
  return null;
}

/** Today's monthly tab name, e.g. "2026-09". */
export function currentMonthTab(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
