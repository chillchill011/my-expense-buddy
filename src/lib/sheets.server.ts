/**
 * Server-only Google Sheets reader.
 *
 * All requests go through the Lovable connector gateway, so the Google
 * credential never exists in the browser bundle. Values are requested
 * UNFORMATTED with SERIAL_NUMBER dates, which makes parsing deterministic
 * regardless of the spreadsheet's locale settings.
 */

import type { Row } from "./expense-normalize";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

export class SheetsConfigError extends Error {
  readonly code: "missing_spreadsheet_id" | "missing_credentials";
  constructor(code: "missing_spreadsheet_id" | "missing_credentials", message: string) {
    super(message);
    this.name = "SheetsConfigError";
    this.code = code;
  }
}

function requireEnv() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_SHEETS_API_KEY"];
  const spreadsheetId = process.env["EXPENSE_SPREADSHEET_ID"];

  if (!lovableKey || !connectionKey) {
    throw new SheetsConfigError(
      "missing_credentials",
      "The Google Sheets connector is not linked to this project yet.",
    );
  }
  if (!spreadsheetId) {
    throw new SheetsConfigError(
      "missing_spreadsheet_id",
      "Your expense sheet hasn't been linked yet, so there is nothing to show.",
    );
  }
  return { lovableKey, connectionKey, spreadsheetId };
}

async function gatewayGet(path: string, search: URLSearchParams): Promise<unknown> {
  const { lovableKey, connectionKey } = requireEnv();
  const url = `${GATEWAY_URL}${path}?${search.toString()}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Google Sheets gateway request failed [${response.status}]: ${body}`);
    throw new Error(`Google Sheets request failed [${response.status}]: ${body.slice(0, 500)}`);
  }

  return response.json();
}

/** Every tab title in the spreadsheet, in sheet order. */
export async function listTabTitles(): Promise<string[]> {
  const { spreadsheetId } = requireEnv();
  const payload = (await gatewayGet(
    `/spreadsheets/${spreadsheetId}`,
    new URLSearchParams({ fields: "sheets.properties.title" }),
  )) as { sheets?: Array<{ properties?: { title?: string } }> };

  return (payload.sheets ?? [])
    .map((s) => s.properties?.title)
    .filter((t): t is string => typeof t === "string" && t.length > 0);
}

/**
 * Batch-read A1 ranges. Returns a map from the requested range to its rows.
 * Google caps a single batchGet, so ranges are chunked.
 */
export async function batchGetRanges(ranges: string[]): Promise<Map<string, Row[]>> {
  const { spreadsheetId } = requireEnv();
  const out = new Map<string, Row[]>();
  const CHUNK = 25;

  for (let i = 0; i < ranges.length; i += CHUNK) {
    const chunk = ranges.slice(i, i + CHUNK);
    // FORMATTED_VALUE keeps dates exactly as they read in the sheet (DD/MM/YYYY).
    // Raw serial numbers are unreliable here: the bot writes day-first text and
    // the spreadsheet locale silently parses "05/09/2026" as 9 May, so anything
    // with a day of 12 or less came back with day and month swapped.
    const search = new URLSearchParams({
      valueRenderOption: "FORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
      majorDimension: "ROWS",
    });
    for (const range of chunk) search.append("ranges", range);

    const payload = (await gatewayGet(`/spreadsheets/${spreadsheetId}/values:batchGet`, search)) as {
      valueRanges?: Array<{ values?: Row[] }>;
    };

    const valueRanges = payload.valueRanges ?? [];
    chunk.forEach((range, idx) => {
      out.set(range, valueRanges[idx]?.values ?? []);
    });
  }

  return out;
}

/** Wrap a tab title for A1 notation, quoting when it contains spaces. */
export function a1(tab: string, range: string): string {
  return /[^A-Za-z0-9_]/.test(tab) ? `'${tab.replace(/'/g, "''")}'!${range}` : `${tab}!${range}`;
}
