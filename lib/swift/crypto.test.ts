import { test, expect } from "@playwright/test";
import { encryptSwiftSecret, decryptSwiftSecret } from "./crypto";

const KEY = "b".repeat(64); // 32 bytes hex for tests

test("swift secret encrypt/decrypt round-trips", () => {
  process.env.SWIFT_CREDENTIAL_KEY = KEY;
  const box = encryptSwiftSecret("sw1ft-p@ss");
  expect(box).not.toContain("sw1ft-p@ss");
  expect(decryptSwiftSecret(box)).toBe("sw1ft-p@ss");
});

test("two encryptions of the same password differ (random IV)", () => {
  process.env.SWIFT_CREDENTIAL_KEY = KEY;
  expect(encryptSwiftSecret("x")).not.toBe(encryptSwiftSecret("x"));
});

test("missing/short SWIFT_CREDENTIAL_KEY throws a setup hint", () => {
  process.env.SWIFT_CREDENTIAL_KEY = "short";
  expect(() => encryptSwiftSecret("x")).toThrow(/SWIFT_CREDENTIAL_KEY/);
  process.env.SWIFT_CREDENTIAL_KEY = KEY; // restore so a later-added test inherits a valid key
});
