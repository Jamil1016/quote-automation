import { test, expect } from "@playwright/test";
import { canGenerateToDrive } from "./bulk";
import type { QuoteRow } from "./types";

// A problem-free, not-yet-generated "ready" row is the only case that shows the
// in-panel Generate button. Only the fields the predicate reads matter here.
function row(overrides: Partial<QuoteRow>): QuoteRow {
  return {
    status: "ready",
    needs_review: false,
    quote_recipient: "ops@example.com",
    inv_product_service: "Carrier COP - New Build",
    line_items: null,
    generated_at: null,
    ...overrides,
  } as QuoteRow;
}

test("canGenerateToDrive: good-to-go, not-yet-generated row shows the button", () => {
  expect(canGenerateToDrive(row({}))).toBe(true);
});

test("canGenerateToDrive: hidden when the row has a problem", () => {
  expect(canGenerateToDrive(row({ status: "no_price" }))).toBe(false);
  expect(canGenerateToDrive(row({ status: "no_match" }))).toBe(false);
  expect(canGenerateToDrive(row({ needs_review: true }))).toBe(false);
  expect(canGenerateToDrive(row({ quote_recipient: null }))).toBe(false);
});

test("canGenerateToDrive: hidden once already generated", () => {
  expect(canGenerateToDrive(row({ generated_at: "2026-06-17T05:00:00Z" }))).toBe(false);
});
