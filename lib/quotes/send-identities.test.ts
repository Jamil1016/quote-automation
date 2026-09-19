// lib/quotes/send-identities.test.ts
import { test, expect } from "@playwright/test";
import { resolveFromIdentity } from "./send-identities";

const IDS = [{ name: "Accounting | Example Co", email: "accounting@example.com" }];

test("resolve: requested override wins and must match an identity", () => {
  const r = resolveFromIdentity("accounting@example.com", null, "dev@example.com", IDS);
  expect(r).toEqual({ ok: true, from: { name: "Accounting | Example Co", email: "accounting@example.com" } });
});

test("resolve: falls back to saved default then own address", () => {
  expect(resolveFromIdentity(null, "accounting@example.com", "dev@example.com", IDS))
    .toEqual({ ok: true, from: { name: "Accounting | Example Co", email: "accounting@example.com" } });
  expect(resolveFromIdentity(null, null, "Dev@example.com", IDS))
    .toEqual({ ok: true, from: { email: "dev@example.com" } });
});

test("resolve: own address is always allowed without an identity", () => {
  expect(resolveFromIdentity("dev@example.com", null, "dev@example.com", []))
    .toEqual({ ok: true, from: { email: "dev@example.com" } });
});

test("resolve: an unknown address is rejected (guard)", () => {
  expect(resolveFromIdentity("evil@elsewhere.com", null, "dev@example.com", IDS))
    .toEqual({ ok: false, reason: "unknown_identity" });
});

import { validateMaskInput, isMaskAdmin } from "./send-identities";

test("validateMaskInput trims, lowercases email, requires name + valid email", () => {
  expect(validateMaskInput("  Accounting | Example Co ", " Accounting@example.com "))
    .toEqual({ ok: true, name: "Accounting | Example Co", email: "accounting@example.com" });
  expect(validateMaskInput("   ", "a@b.co")).toEqual({ ok: false, reason: "name" });
  expect(validateMaskInput("X", "not-an-email")).toEqual({ ok: false, reason: "email" });
});

test("isMaskAdmin matches the comma list case-insensitively; empty list = nobody", () => {
  expect(isMaskAdmin("Dev@example.com", "dev@example.com, x@y.co")).toBe(true);
  expect(isMaskAdmin("nope@example.com", "dev@example.com")).toBe(false);
  expect(isMaskAdmin("a@b.co", undefined)).toBe(false);
});
