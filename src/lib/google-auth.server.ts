/**
 * Server-only Google service-account authentication.
 *
 * Mints a short-lived OAuth access token from a service-account key using the
 * JWT bearer grant, signed with Web Crypto so it works in the edge runtime.
 * The token is cached in memory until shortly before it expires.
 */

let cached: { token: string; expiresAt: number } | null = null;

export function hasServiceAccount(): boolean {
  return Boolean(
    process.env["GOOGLE_SERVICE_ACCOUNT_EMAIL"] &&
      process.env["GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"],
  );
}

/** The address users must share their spreadsheet with. */
export function serviceAccountEmail(): string | null {
  return process.env["GOOGLE_SERVICE_ACCOUNT_EMAIL"] ?? null;
}

function base64url(bytes: Uint8Array | string): string {
  const raw =
    typeof bytes === "string"
      ? bytes
      : Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** A Google access token scoped to the Sheets API. */
export async function getGoogleAccessToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const email = process.env["GOOGLE_SERVICE_ACCOUNT_EMAIL"];
  const privateKey = process.env["GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"];
  if (!email || !privateKey) throw new Error("Google service account is not configured");

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  const assertion = `${header}.${claims}.${base64url(new Uint8Array(signature))}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Google token request failed [${response.status}]: ${text.slice(0, 300)}`);
  }
  const payload = JSON.parse(text) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) throw new Error("Google token response had no access token");

  cached = {
    token: payload.access_token,
    // Refresh a minute early so an in-flight request never uses a dead token.
    expiresAt: Date.now() + ((payload.expires_in ?? 3600) - 60) * 1000,
  };
  return cached.token;
}
