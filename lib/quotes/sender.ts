// lib/quotes/sender.ts
export interface Conn { email: string; status: string; refresh_token_enc: string }
export type ResolveResult =
  | { ok: true; connection: Conn }
  | { ok: false; reason: "no_active" | "not_connected" | "error_status" };

/** Pick the user's active sender connection, or say why it can't be resolved. */
export function resolveActiveSender(connections: Conn[], activeEmail: string | null): ResolveResult {
  if (!activeEmail) return { ok: false, reason: "no_active" };
  const c = connections.find((x) => x.email === activeEmail);
  if (!c) return { ok: false, reason: "not_connected" };
  if (c.status !== "active") return { ok: false, reason: "error_status" };
  return { ok: true, connection: c };
}

/** User-facing message for a failed resolution. */
export function senderErrorMessage(reason: "no_active" | "not_connected" | "error_status"): string {
  if (reason === "no_active") return "No active sender set. Open Settings and choose one.";
  if (reason === "not_connected") return "Your active sender is no longer connected. Re-connect it in Settings.";
  return "Your active sender needs reconnecting (Gmail error). Open Settings.";
}
