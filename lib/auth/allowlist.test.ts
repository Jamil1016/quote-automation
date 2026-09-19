import { test, expect } from "@playwright/test";
import { isAllowed, allowedEmails } from "./allowlist";

test("allowed email passes (case-insensitive, trimmed)", () => {
  const list = ["a@example.com", "B@example.com"];
  expect(isAllowed(" A@example.com ", list)).toBe(true);
  expect(isAllowed("b@example.com", list)).toBe(true);
});

test("unknown email is rejected", () => {
  expect(isAllowed("x@evil.com", ["a@example.com"])).toBe(false);
});

test("empty/undefined email is rejected", () => {
  expect(isAllowed(undefined, ["a@example.com"])).toBe(false);
  expect(isAllowed("", ["a@example.com"])).toBe(false);
});

test("allowedEmails parses comma list from env string", () => {
  expect(allowedEmails("a@example.com, b@example.com ,")).toEqual(["a@example.com", "b@example.com"]);
});
