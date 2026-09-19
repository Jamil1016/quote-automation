/**
 * DEMO MODE: one server-side switch (`DEMO_MODE=true`) that lets the app run as
 * a public demo with invented data and NO external side effects.
 *
 * Everything demo-specific lives in lib/demo/. The real integrations
 * (lib/google/drive.ts, lib/google/gmail.ts, lib/swift/*) each check
 * `isDemoMode()` once at their boundary and hand off to a stub from here, so
 * with the flag off the original code paths run untouched.
 *
 * What changes when it is on:
 *   - Drive:  nothing is uploaded. A generated quote gets a fake file id and a
 *             link to /api/quote-pdf, which re-renders the PDF on request.
 *   - Gmail:  create/send/delete draft are no-ops that return fake ids, so queue
 *             rows still move scheduled -> sent / cancelled. No mail leaves.
 *   - Email gate: forced to "test" (never "live"), see lib/quotes/email-safety.ts.
 *   - PM API: the credential check always succeeds; the password is not stored.
 *   - Auth:   the sign-in page offers "Enter demo", which signs in the seeded
 *             demo user with email + password instead of Google OAuth.
 */
export const DEMO_USER_EMAIL = "demo@example.com";

export function isDemoMode(): boolean {
  return (process.env.DEMO_MODE ?? "").trim().toLowerCase() === "true";
}
