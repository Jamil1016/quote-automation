// lib/quotes/theme.test.ts
import { test, expect } from "@playwright/test";
import { resolveTheme } from "./theme";

test("resolveTheme: only 'ledger' maps to ledger; everything else defaults to brand", () => {
  expect(resolveTheme("ledger")).toBe("ledger");
  expect(resolveTheme("brand")).toBe("brand");
  expect(resolveTheme(null)).toBe("brand");
  expect(resolveTheme(undefined)).toBe("brand");
  expect(resolveTheme("")).toBe("brand");
  expect(resolveTheme("garbage")).toBe("brand");
});
