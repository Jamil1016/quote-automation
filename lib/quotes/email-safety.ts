/**
 * EMAIL SAFETY — fail-closed gate. READ THIS BEFORE BUILDING ANY SEND CODE.
 *
 * The quote tool is NOT cleared to email real customers. The Quote Directory's
 * recipient/cc addresses are real GCs/carriers — sending to them before the
 * tool is signed off would be a serious problem.
 *
 * THE RULE: any code that sends a quote email MUST resolve its recipients
 * through `resolveRecipients()`. Never read `quote_recipient` / `quote_cc`
 * straight into a mailer. This function decides who actually gets the mail:
 *
 *   QUOTE_EMAIL_MODE = "off"  (default, incl. unset) → throws. No send at all.
 *   QUOTE_EMAIL_MODE = "test"                        → ALL mail redirected to
 *                                                      the test recipient only;
 *                                                      the intended customer
 *                                                      addresses are discarded.
 *   QUOTE_EMAIL_MODE = "live"                         → real recipients, but ONLY
 *                                                      if QUOTE_EMAIL_ALLOW_CUSTOMER_SEND
 *                                                      === "true" is ALSO set.
 *
 * Two deliberate switches stand between this code and a customer's inbox, and
 * the default with no config is "refuse". Fail closed.
 *
 * DEMO_MODE forces "test" regardless of QUOTE_EMAIL_MODE: a public demo can
 * never reach "live", and the Gmail layer is stubbed so nothing is sent anyway.
 */
import { isDemoMode } from "@/lib/demo/mode";

export type EmailMode = "off" | "test" | "live";

/** Hard-locked test inbox — where ALL mail goes in test mode. */
export const TEST_RECIPIENT = "dev@example.com";

export function emailMode(): EmailMode {
  if (isDemoMode()) return "test";
  const m = (process.env.QUOTE_EMAIL_MODE ?? "off").trim().toLowerCase();
  return m === "test" || m === "live" ? m : "off";
}

export interface SendPlan {
  to: string[];
  cc: string[];
  mode: EmailMode;
  /** When test mode redirects, what the recipients WOULD have been (for logging/preview). */
  redirectedFrom?: { to: string[]; cc: string[] };
}

const clean = (xs: string[]) =>
  Array.from(new Set((xs ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean)));

/**
 * The ONLY sanctioned way to turn intended recipients into actual ones.
 * Throws unless a mode is explicitly enabled; never returns customer addresses
 * unless mode==="live" AND the customer-send flag is on.
 */
export function resolveRecipients(intendedTo: string[], intendedCc: string[] = []): SendPlan {
  const mode = emailMode();
  const to = clean(intendedTo);
  const cc = clean(intendedCc);

  if (mode === "off") {
    throw new Error(
      "Quote email is disabled (QUOTE_EMAIL_MODE unset/off). No send permitted. " +
        "Set QUOTE_EMAIL_MODE=test to route everything to the test inbox.",
    );
  }

  if (mode === "test") {
    return { to: [TEST_RECIPIENT], cc: [], mode, redirectedFrom: { to, cc } };
  }

  // mode === "live": real customer addresses — require the second explicit switch.
  if (process.env.QUOTE_EMAIL_ALLOW_CUSTOMER_SEND !== "true") {
    throw new Error(
      "QUOTE_EMAIL_MODE=live requires QUOTE_EMAIL_ALLOW_CUSTOMER_SEND=true. " +
        "Refusing to send to customer recipients without the explicit override.",
    );
  }
  if (to.length === 0) {
    throw new Error("Live send has no recipients — aborting rather than sending blind.");
  }
  return { to, cc, mode };
}
