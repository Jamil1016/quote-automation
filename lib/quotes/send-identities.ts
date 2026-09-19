// lib/quotes/send-identities.ts
// Pure helpers for "send as" identities (validation, resolution, admin check).
import { ADDRESS_RE } from "./email-mime";
import { allowedEmails, isAllowed } from "@/lib/auth/allowlist";

export interface SendIdentity {
  name: string;
  email: string;
}

export type ResolveFromResult =
  | { ok: true; from: { name?: string; email: string } }
  | { ok: false; reason: "unknown_identity" };

/**
 * Resolve the From for a send. Order: requested (per-send) -> defaultFrom (saved) -> ownEmail.
 * Guard: the chosen address must be the connection's own email OR a configured identity.
 * @param requested  per-send override email, or null
 * @param defaultFrom user's saved active_from_email, or null
 * @param ownEmail    the active connection's own address (always allowed)
 * @param identities  configured shared identities
 */
export function resolveFromIdentity(
  requested: string | null,
  defaultFrom: string | null,
  ownEmail: string,
  identities: SendIdentity[],
): ResolveFromResult {
  const own = ownEmail.toLowerCase();
  const chosen = (requested ?? defaultFrom ?? own).toLowerCase();
  if (chosen === own) return { ok: true, from: { email: own } };
  const id = identities.find((i) => i.email === chosen);
  if (id) return { ok: true, from: { name: id.name, email: id.email } };
  return { ok: false, reason: "unknown_identity" };
}

export type MaskValidation =
  | { ok: true; name: string; email: string }
  | { ok: false; reason: "name" | "email" };

/** Validate + normalize a mask add form. Trims name, lowercases + validates email. */
export function validateMaskInput(name: string, email: string): MaskValidation {
  const n = name.trim();
  if (!n) return { ok: false, reason: "name" };
  const e = email.trim().toLowerCase();
  if (!ADDRESS_RE.test(e)) return { ok: false, reason: "email" };
  return { ok: true, name: n, email: e };
}

/** True if email is in the comma-separated admin list (QUOTE_MASK_ADMINS). */
export function isMaskAdmin(email: string, adminsRaw: string | undefined): boolean {
  return isAllowed(email, allowedEmails(adminsRaw));
}
