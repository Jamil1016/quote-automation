import { test, expect } from "@playwright/test";
import { validateSwiftInput } from "./validate";

test("accepts a valid email + password and lowercases the username", () => {
  expect(validateSwiftInput("  User@example.com ", "pw")).toEqual({
    ok: true, username: "user@example.com", password: "pw",
  });
});

test("rejects a non-email username", () => {
  expect(validateSwiftInput("notanemail", "pw")).toEqual({ ok: false, reason: "username" });
});

test("rejects an empty password", () => {
  expect(validateSwiftInput("user@example.com", "")).toEqual({ ok: false, reason: "password" });
});

test("rejects a whitespace-only password", () => {
  expect(validateSwiftInput("user@example.com", "   ")).toEqual({ ok: false, reason: "password" });
});
