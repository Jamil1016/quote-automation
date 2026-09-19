import { test, expect } from "@playwright/test";
import { resolveRecipients, emailMode, TEST_RECIPIENT } from "./email-safety";

const CUSTOMER = ["gc@bigcarrier.com", "pm@subcon.com"];

function withEnv(env: Record<string, string | undefined>, fn: () => void) {
  const saved = { ...process.env };
  try {
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fn();
  } finally {
    process.env = saved;
  }
}

test("default (unset) is OFF and refuses to send", () => {
  withEnv({ QUOTE_EMAIL_MODE: undefined, QUOTE_EMAIL_ALLOW_CUSTOMER_SEND: undefined }, () => {
    expect(emailMode()).toBe("off");
    expect(() => resolveRecipients(CUSTOMER)).toThrow(/disabled/i);
  });
});

test("test mode redirects ALL mail to the test inbox, discards customer addresses", () => {
  withEnv({ QUOTE_EMAIL_MODE: "test" }, () => {
    const plan = resolveRecipients(CUSTOMER, ["cc@carrier.com"]);
    expect(plan.to).toEqual([TEST_RECIPIENT]);
    expect(plan.cc).toEqual([]);
    expect(plan.redirectedFrom?.to).toEqual(CUSTOMER);
  });
});

test("live mode WITHOUT the customer-send flag still refuses", () => {
  withEnv({ QUOTE_EMAIL_MODE: "live", QUOTE_EMAIL_ALLOW_CUSTOMER_SEND: undefined }, () => {
    expect(() => resolveRecipients(CUSTOMER)).toThrow(/ALLOW_CUSTOMER_SEND/);
  });
});

test("live mode WITH both switches reaches real recipients", () => {
  withEnv({ QUOTE_EMAIL_MODE: "live", QUOTE_EMAIL_ALLOW_CUSTOMER_SEND: "true" }, () => {
    const plan = resolveRecipients(CUSTOMER);
    expect(plan.mode).toBe("live");
    expect(plan.to).toEqual(CUSTOMER);
  });
});

test("live mode with no recipients aborts rather than sending blind", () => {
  withEnv({ QUOTE_EMAIL_MODE: "live", QUOTE_EMAIL_ALLOW_CUSTOMER_SEND: "true" }, () => {
    expect(() => resolveRecipients([])).toThrow(/no recipients/i);
  });
});
