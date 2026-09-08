/**
 * Server-only Google Sheets reader/writer.
 *
 * Two credential modes, picked automatically:
 *   1. A Google service account (self-hosting and multi-user). Each user shares
 *      their own sheet with the service account address.
 *   2. Lovable's Google Sheets connector, kept as a fallback so an existing
 *      single-sheet deployment keeps working.
 *
 * Either way the credential lives only on the server; the browser never sees it.
 */

import type { Row } from "./expense-normalize";
import { getGoogleAccessToken, hasServiceAccount } from "./google-auth.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";
const GOOGLE_API_URL = "https://sheets.googleapis.com/v4";

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

/** Thrown when the sheet exists but this app has not been given access to it. */
export class SheetsAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SheetsAccessError";
  }
}

async function requestConfig(): Promise<{ base: string; headers: Record<string, string> }> {
  if (hasServiceAccount()) {
    const token = await getGoogleAccessToken();
    return {
      base: GOOGLE_API_URL,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    };
  }

  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_SHEETS_API_KEY"];
  if (!lovableKey || !connectionKey) {
    throw new SheetsConfigError(
      "missing_credentials",
      "This app hasn't been given access to Google Sheets yet.",
    );
  }
  return {
    base: GATEWAY_URL,
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
      Accept: "application/json",
    },
  };
}

function requireId(spreadsheetId: string | null | undefined): string {
  const id = (spreadsheetId ?? "").trim();
  if (!id) {
    throw new SheetsConfigError(
      "missing_spreadsheet_id",
      "No spreadsheet is linked to this account yet.",
    );
  }
  return id;
}

function handleFailure(status: number, body: string): never {
  console.error(`Google Sheets request failed [${status}]: ${body}`);
  if (status === 429) {
    throw new SheetsRateLimitError(
      "Your sheet is busy right now — this usually clears within a minute.",
    );
  }
  if (status === 403 || status === 404) {
    throw new SheetsAccessError(
      "This app can't open that spreadsheet. Check the link and make sure it's shared with the app.",
    );
  }
  throw new Error(`Google Sheets request failed [${status}]: ${body.slice(0, 500)}`);
}

async function sheetsGet(path: string, search: URLSearchParams): Promise<unknown> {
  const { base, headers } = await requestConfig();
  const url = `${base}${path}?${search.toString()}`;

  let response = await fetch(url, { headers });
  // Google's per-minute read quota can be exhausted transiently. Wait for the
  // minute window to roll over and retry once before giving up.
  if (response.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, 20_000));
    response = await fetch(url, { headers });
  }

  if (!response.ok) handleFailure(response.status, await response.text());
  return response.json();
}

async function sheetsPost(path: string, search: URLSearchParams, body: unknown): Promise<unknown> {
  const { base, headers } = await requestConfig();
  const query = search.toString();
  const url = `${base}${path}${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) handleFailure(response.status, await response.text());
  return response.json();
}

/** Every tab title in the spreadsheet, in sheet order. */
export async function listTabTitles(spreadsheetId: string): Promise<string[]> {
  const id = requireId(spreadsheetId);
  const payload = (await sheetsGet(
    `/spreadsheets/${id}`,
    new URLSearchParams({ fields: "sheets.properties.title" }),
  )) as { sheets?: Array<{ properties?: { title?: string } }> };

  return (payload.sheets ?? [])
    .map((s) => s.properties?.title)
    .filter((t): t is string => typeof t === "string" && t.length > 0);
}

/** Numeric sheet id for a tab title, or null when the tab does not exist. */
export async function getTabId(spreadsheetId: string, title: string): Promise<number | null> {
  const id = requireId(spreadsheetId);
  const payload = (await sheetsGet(
    `/spreadsheets/${id}`,
    new URLSearchParams({ fields: "sheets.properties(title,sheetId)" }),
  )) as { sheets?: Array<{ properties?: { title?: string; sheetId?: number } }> };

  const found = (payload.sheets ?? []).find((s) => s.properties?.title === title);
  return typeof found?.properties?.sheetId === "number" ? found.properties.sheetId : null;
}

/**
 * Append one row to a tab. Returns the 1-based row number it landed on, so an
 * undo can remove exactly that row.
 */
export async function appendRow(
  spreadsheetId: string,
  tab: string,
  values: Array<string | number>,
): Promise<number | null> {
  const id = requireId(spreadsheetId);
  const range = a1(tab, "A:F");
  const payload = (await sheetsPost(
    `/spreadsheets/${id}/values/${range}:append`,
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
export async function deleteRow(
  spreadsheetId: string,
  tab: string,
  rowNumber: number,
): Promise<void> {
  const id = requireId(spreadsheetId);
  const sheetId = await getTabId(id, tab);
  if (sheetId === null) throw new Error(`Tab "${tab}" not found`);

  await sheetsPost(`/spreadsheets/${id}:batchUpdate`, new URLSearchParams(), {
    requests: [
      {
        deleteDimension: {
          range: { sheetId, dimension: "ROWS", startIndex: rowNumber - 1, endIndex: rowNumber },
        },
      },
    ],
  });
}

/** Read a single A1 range (used to confirm a row before deleting it). */
export async function getRange(spreadsheetId: string, range: string): Promise<Row[]> {
  const rows = await batchGetRanges(spreadsheetId, [range]);
  return rows.get(range) ?? [];
}

/**
 * Batch-read A1 ranges. Returns a map from the requested range to its rows.
 * Google caps a single batchGet, so ranges are chunked.
 */
export async function batchGetRanges(
  spreadsheetId: string,
  ranges: string[],
): Promise<Map<string, Row[]>> {
  const id = requireId(spreadsheetId);
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

    const payload = (await sheetsGet(`/spreadsheets/${id}/values:batchGet`, search)) as {
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
