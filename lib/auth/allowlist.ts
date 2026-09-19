import { DEMO_USER_EMAIL, isDemoMode } from "@/lib/demo/mode";

export function allowedEmails(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowed(email: string | undefined | null, list: string[]): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return list.map((e) => e.trim().toLowerCase()).includes(normalized);
}

/**
 * The allowlist in effect for this deployment: QUOTE_APP_ALLOWED_EMAILS, plus
 * the seeded demo user when DEMO_MODE is on (and only then).
 */
export function currentAllowlist(): string[] {
  const list = allowedEmails(process.env.QUOTE_APP_ALLOWED_EMAILS);
  return isDemoMode() ? Array.from(new Set([...list, DEMO_USER_EMAIL])) : list;
}
