import { test, expect } from "@playwright/test";
import { buildQuote, normalizeLineItems } from "./quote-model";
import type { QuoteRow } from "./types";

function row(p: Partial<QuoteRow> = {}): QuoteRow {
  return {
    task_did: "t1", asset_id: "", asset_name: "Towson - TOW-044 - A - RADIO SWAP",
    task_name: "", task_status: "", subcon: null, gc: null, carrier: null, market: null,
    project: null, fuze_id: null, needs_review: false, needs_review_base: false, verified: false,
    verified_by: null, verified_at: null, subcon_overridden: false, gc_overridden: false,
    carrier_overridden: false, market_overridden: false, project_overridden: false,
    fuze_id_overridden: false, service_rate_overridden: false, product_service_overridden: false,
    override_by: null, override_at: null, inv_project: null, inv_site_name: null, inv_site_id: null,
    inv_product_service: "Carrier COP - New Build", inv_product_service_type: null,
    inv_invoice_category: null, inv_service_type: null, inv_sow: null, inv_service_rate: "275",
    inv_requirement_status: null, inv_form_did: null, chosen_line_key: null, invoice_chosen: false,
    quote_recipient: "a@b.com", quote_cc: null, directory_matched: true, directory_conflict: false,
    priced_line_count: 1, status: "ready", generated_at: null, generated_by: null,
    drive_link: null, drive_file_id: null, emailed: false, line_items: null, ...p,
  };
}

test("buildQuote falls back to single line when line_items is null", () => {
  const q = buildQuote(row(), "6/10/2026");
  expect(q.lines.length).toBe(1);
  expect(q.lines[0].rate).toBe(275);
  expect(q.total).toBe(275);
});

test("buildQuote renders multiple line items with qty*rate amounts and summed total", () => {
  const q = buildQuote(row({ line_items: [
    { product: "Carrier COP - New Build - Small Cell", qty: 1, rate: 275 },
    { product: "LL COP - Crown Castle", qty: 1, rate: 75 },
  ] }), "6/10/2026");
  expect(q.lines.map((l) => l.item)).toEqual([1, 2]);
  expect(q.lines[1].amount).toBe(75);
  expect(q.total).toBe(350);
});

test("buildQuote multiplies qty by rate", () => {
  const q = buildQuote(row({ line_items: [{ product: "X", qty: 3, rate: 100 }] }));
  expect(q.lines[0].amount).toBe(300);
  expect(q.total).toBe(300);
});

test("normalizeLineItems coerces qty/rate, keeps priced lines, drops fully-empty, empty -> null", () => {
  expect(normalizeLineItems([{ product: " A ", qty: 0, rate: "$1,200.50" }]))
    .toEqual([{ product: "A", qty: 1, rate: 1200.5 }]);
  // blank product but a rate is KEPT (in-progress line, e.g. seeded from a no-service entry)
  expect(normalizeLineItems([{ product: "", qty: 2, rate: 5 }])).toEqual([{ product: "", qty: 2, rate: 5 }]);
  // fully-empty row (no product AND no rate) is dropped
  expect(normalizeLineItems([{ product: "", qty: 1, rate: 0 }])).toBeNull();
  expect(normalizeLineItems([])).toBeNull();
  expect(normalizeLineItems(null)).toBeNull();
});
