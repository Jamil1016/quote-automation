import { test, expect } from "@playwright/test";
import { encryptSecret, decryptSecret } from "./token-crypto";

const KEY = "a".repeat(64); // 32 bytes hex for tests

test("encrypt/decrypt round-trips", () => {
  process.env.GMAIL_TOKEN_KEY = KEY;
  const box = encryptSecret("1//refresh-token-value");
  expect(box).not.toContain("refresh-token-value");
  expect(decryptSecret(box)).toBe("1//refresh-token-value");
});

test("two encryptions of the same value differ (random IV)", () => {
  process.env.GMAIL_TOKEN_KEY = KEY;
  expect(encryptSecret("x")).not.toBe(encryptSecret("x"));
});

test("missing/short key throws a setup hint", () => {
  process.env.GMAIL_TOKEN_KEY = "short";
  expect(() => encryptSecret("x")).toThrow(/GMAIL_TOKEN_KEY/);
});
