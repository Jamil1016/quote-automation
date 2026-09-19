/**
 * Gmail REST for the quote email feature. Server-only.
 * Scope gmail.compose = manage drafts + send (the minimum covering both).
 * Env: GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET (Web OAuth client in the existing
 * GCP project), distinct from the GDRIVE_* desktop client.
 *
 * DEMO_MODE: accessTokenForConnection / createDraft / sendDraft / deleteDraft
 * hand off to lib/demo/gmail.ts and never call Google.
 */
import { isDemoMode } from "@/lib/demo/mode";
import { DEMO_ACCESS_TOKEN, demoCreateDraft, demoDeleteDraft, demoSendDraft } from "@/lib/demo/gmail";
import { decryptSecret } from "./token-crypto";

const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.compose openid email";

function clientId(): string {
  const v = process.env.GMAIL_CLIENT_ID;
  if (!v) throw new Error("GMAIL_CLIENT_ID is not set");
  return v;
}
function clientSecret(): string {
  const v = process.env.GMAIL_CLIENT_SECRET;
  if (!v) throw new Error("GMAIL_CLIENT_SECRET is not set");
  return v;
}

export function gmailAuthUrl(redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    prompt: "consent", // always issue a refresh token
    state,
  });
  return `${AUTH}?${p}`;
}

/** Exchange the callback code; returns the Google account email + refresh token. */
export async function exchangeCode(code: string, redirectUri: string): Promise<{ email: string; refreshToken: string }> {
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: clientId(), client_secret: clientSecret(),
      redirect_uri: redirectUri, grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Gmail code exchange failed (${res.status}): ${await res.text()}`);
  const j = (await res.json()) as { refresh_token?: string; id_token?: string };
  if (!j.refresh_token) throw new Error("Google returned no refresh token (revoke the app's access and reconnect)");
  if (!j.id_token) throw new Error("Google returned no id_token (email scope missing)");
  const payload = JSON.parse(Buffer.from(j.id_token.split(".")[1], "base64url").toString("utf8")) as { email?: string };
  if (!payload.email) throw new Error("id_token has no email claim");
  return { email: payload.email.toLowerCase(), refreshToken: j.refresh_token };
}

export async function gmailAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken, client_id: clientId(), client_secret: clientSecret(),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Gmail token refresh failed (${res.status}): ${await res.text()}`);
  const j = (await res.json()) as { access_token?: string };
  if (!j.access_token) throw new Error("Gmail token refresh returned no access_token");
  return j.access_token;
}

/**
 * Access token for a stored connection (gmail_connections.refresh_token_enc):
 * decrypt the refresh token, then exchange it. Callers use this rather than
 * decrypting themselves so demo mode has a single place to short-circuit.
 */
export async function accessTokenForConnection(refreshTokenEnc: string): Promise<string> {
  if (isDemoMode()) return DEMO_ACCESS_TOKEN;
  return gmailAccessToken(decryptSecret(refreshTokenEnc));
}

/** Create a draft from a base64url RFC822 message; returns the draft id. */
export async function createDraft(accessToken: string, rawBase64Url: string): Promise<string> {
  if (isDemoMode()) return demoCreateDraft();
  const res = await fetch(`${GMAIL}/drafts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { raw: rawBase64Url } }),
  });
  if (!res.ok) throw new Error(`Gmail draft create failed (${res.status}): ${await res.text()}`);
  const j = (await res.json()) as { id: string };
  return j.id;
}

/** Send an existing draft (sends its CURRENT state). Throws DraftGoneError on 404. */
export class DraftGoneError extends Error {}

/** A non-404 Gmail send failure, carrying the HTTP status + parsed error reason
 *  so callers can tell a transient (retryable) failure from a terminal one. */
export class GmailSendError extends Error {
  constructor(message: string, readonly status: number, readonly reason?: string) {
    super(message);
    this.name = "GmailSendError";
  }
}

/** Transient send failures worth retrying with backoff. Gmail intermittently
 *  rejects drafts.send during a burst with `400 failedPrecondition` even though
 *  the same draft sends fine moments later; 429 / 5xx and rate-limit 403s are the
 *  other transient classes. A 400 with any OTHER reason is terminal. A thrown
 *  fetch (network blip / DNS) carries no status and is treated as transient. */
export function isRetryableSendError(e: unknown): boolean {
  if (e instanceof DraftGoneError) return false;
  if (e instanceof GmailSendError) {
    if (e.status === 429 || e.status >= 500) return true;
    if (e.status === 403 && /rateLimit|userRateLimit|quota/i.test(`${e.reason ?? ""} ${e.message}`)) return true;
    if (e.status === 400 && /failedPrecondition/i.test(`${e.reason ?? ""} ${e.message}`)) return true;
    return false;
  }
  return e instanceof Error;
}

export async function sendDraft(accessToken: string, draftId: string): Promise<{ messageId: string }> {
  if (isDemoMode()) return demoSendDraft();
  const res = await fetch(`${GMAIL}/drafts/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: draftId }),
  });
  if (res.status === 404) throw new DraftGoneError("draft deleted in Gmail");
  if (!res.ok) {
    const body = await res.text();
    let reason: string | undefined;
    try {
      const j = JSON.parse(body) as { error?: { status?: string; errors?: { reason?: string }[] } };
      reason = j.error?.errors?.[0]?.reason ?? j.error?.status;
    } catch { /* body not JSON */ }
    throw new GmailSendError(`Gmail draft send failed (${res.status}): ${body}`, res.status, reason);
  }
  const j = (await res.json()) as { id: string };
  return { messageId: j.id };
}

/** Backoff (ms) before retry `attempt` (1-indexed gap), with jitter to de-sync bursts. */
const SEND_RETRY_BACKOFF_MS = [1000, 3000, 6000];
function defaultSendBackoff(attempt: number): number {
  const base = SEND_RETRY_BACKOFF_MS[attempt - 1] ?? SEND_RETRY_BACKOFF_MS[SEND_RETRY_BACKOFF_MS.length - 1];
  return base + Math.floor(Math.random() * 500);
}

export interface SendRetryOpts {
  maxAttempts?: number;
  backoffMs?: (attempt: number) => number;
  sleep?: (ms: number) => Promise<void>;
  /** Injectable for tests; defaults to the real sendDraft. */
  send?: (accessToken: string, draftId: string) => Promise<{ messageId: string }>;
}

/** sendDraft with bounded retry on transient errors. A `400 failedPrecondition`
 *  (and 429 / 5xx / network blips) is retried up to `maxAttempts` with jittered
 *  backoff; DraftGoneError and terminal errors throw immediately. Safe against
 *  double-delivery: a failed drafts.send never creates a message, so the draft is
 *  untouched and re-sending the same id can't deliver twice. */
export async function sendDraftWithRetry(
  accessToken: string,
  draftId: string,
  opts: SendRetryOpts = {},
): Promise<{ messageId: string }> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const backoff = opts.backoffMs ?? defaultSendBackoff;
  const sleep = opts.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const send = opts.send ?? sendDraft;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await send(accessToken, draftId);
    } catch (e) {
      lastErr = e;
      if (e instanceof DraftGoneError) throw e;
      if (attempt >= maxAttempts || !isRetryableSendError(e)) throw e;
      await sleep(backoff(attempt));
    }
  }
  throw lastErr;
}

/** Delete a draft (Cancel). 404 = already gone = success. */
export async function deleteDraft(accessToken: string, draftId: string): Promise<void> {
  if (isDemoMode()) return demoDeleteDraft();
  const res = await fetch(`${GMAIL}/drafts/${draftId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Gmail draft delete failed (${res.status}): ${await res.text()}`);
  }
}
