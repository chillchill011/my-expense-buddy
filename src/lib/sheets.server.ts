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

/** Thrown when Google's per-minute read quota is exhausted even after one retry. */
export class SheetsRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SheetsRateLimitError";
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
  const headers = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connectionKey,
    Accept: "application/json",
  };

  let response = await fetch(url, { headers });
  // The connector's Google project is shared, so its per-minute read quota can
  // be exhausted by other apps. Wait for the minute window to roll over and
  // retry once before giving up.
  if (response.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, 20_000));
    response = await fetch(url, { headers });
  }

  if (!response.ok) {
    const body = await response.text();
    console.error(`Google Sheets gateway request failed [${response.status}]: ${body}`);
    if (response.status === 429) {
      throw new SheetsRateLimitError(
        "Your sheet is busy right now — this usually clears within a minute.",
      );
    }
    throw new Error(`Google Sheets request failed [${response.status}]: ${body.slice(0, 500)}`);
  }

  return response.json();
}

async function gatewayPost(path: string, search: URLSearchParams, body: unknown): Promise<unknown> {
  const { lovableKey, connectionKey } = requireEnv();
  const query = search.toString();
  const url = `${GATEWAY_URL}${path}${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Google Sheets gateway write failed [${response.status}]: ${text}`);
    if (response.status === 429) {
      throw new SheetsRateLimitError(
        "Your sheet is busy right now — this usually clears within a minute.",
      );
    }
    throw new Error(`Google Sheets write failed [${response.status}]: ${text.slice(0, 500)}`);
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

/** Numeric sheet id for a tab title, or null when the tab does not exist. */
export async function getTabId(title: string): Promise<number | null> {
  const { spreadsheetId } = requireEnv();
  const payload = (await gatewayGet(
    `/spreadsheets/${spreadsheetId}`,
    new URLSearchParams({ fields: "sheets.properties(title,sheetId)" }),
  )) as { sheets?: Array<{ properties?: { title?: string; sheetId?: number } }> };

  const found = (payload.sheets ?? []).find((s) => s.properties?.title === title);
  return typeof found?.properties?.sheetId === "number" ? found.properties.sheetId : null;
}

/**
 * Append one row to a tab. Returns the 1-based row number it landed on, so an
 * undo can remove exactly that row.
 */
export async function appendRow(tab: string, values: Array<string | number>): Promise<number | null> {
  const { spreadsheetId } = requireEnv();
  const range = a1(tab, "A:F");
  const payload = (await gatewayPost(
    `/spreadsheets/${spreadsheetId}/values/${range}:append`,
    new URLSearchParams({
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
    }),
    { values: [values] },
  )) as { updates?: { updatedRange?: string } };

  const updated = payload.updates?.updatedRange ?? "";
  const match = /![A-Z]+(\d+)/.exec(updated);
  return match ? Number(match[1]) : null;
}

/** Delete a single 1-based row from a tab. */
export async function deleteRow(tab: string, rowNumber: number): Promise<void> {
  const { spreadsheetId } = requireEnv();
  const sheetId = await getTabId(tab);
  if (sheetId === null) throw new Error(`Tab "${tab}" not found`);

  await gatewayPost(`/spreadsheets/${spreadsheetId}:batchUpdate`, new URLSearchParams(), {
    requests: [
      {
        deleteDimension: {
          range: {
            sheetId,
            dimension: "ROWS",
            startIndex: rowNumber - 1,
            endIndex: rowNumber,
          },
        },
      },
    ],
  });
}

/** Read a single A1 range (used to confirm a row before deleting it). */
export async function getRange(range: string): Promise<Row[]> {
  const rows = await batchGetRanges([range]);
  return rows.get(range) ?? [];
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
