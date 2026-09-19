import { test, expect } from "@playwright/test";
import { quoteProblem, isBlankService, quoteDisplayStatus } from "./bulk";
import type { QuoteRow } from "./types";

function row(p: Partial<QuoteRow> = {}): QuoteRow {
  return {
    task_did: "t1", asset_id: "", asset_name: "A", task_name: "", task_status: "",
    subcon: null, gc: null, carrier: null, market: null, project: null, fuze_id: null,
    needs_review: false, needs_review_base: false, verified: false, verified_by: null,
    verified_at: null, subcon_overridden: false, gc_overridden: false, carrier_overridden: false,
    market_overridden: false, project_overridden: false, fuze_id_overridden: false,
    service_rate_overridden: false, product_service_overridden: false, override_by: null,
    override_at: null, inv_project: null, inv_site_name: null, inv_site_id: null,
    inv_product_service: null, inv_product_service_type: null, inv_invoice_category: null,
    inv_service_type: null, inv_sow: null, inv_service_rate: "275", inv_requirement_status: null,
    inv_form_did: null, chosen_line_key: null, invoice_chosen: false, quote_recipient: "a@b.com",
    quote_cc: null, directory_matched: true, directory_conflict: false, priced_line_count: 1,
    status: "ready", generated_at: null, generated_by: null, drive_link: null, drive_file_id: null,
    emailed: false, line_items: null, ...p,
  };
}

test("single-line: no_price status still blocks", () => {
  expect(quoteProblem(row({ status: "no_price" }))).toBe("no_price");
});

test("multi-line: all lines priced -> no problem even if status was no_price", () => {
  expect(quoteProblem(row({ status: "no_price", line_items: [{ product: "X", qty: 1, rate: 75 }] }))).toBeNull();
});

test("multi-line: a zero-rate line -> no_price", () => {
  expect(quoteProblem(row({ line_items: [{ product: "X", qty: 1, rate: 0 }] }))).toBe("no_price");
});

test("multi-line: a blank-product line -> no_price even with a valid rate", () => {
  expect(quoteProblem(row({ line_items: [{ product: "  ", qty: 1, rate: 75 }] }))).toBe("no_price");
});

test("multi-line: one bad line among several -> no_price", () => {
  expect(
    quoteProblem(row({ line_items: [{ product: "X", qty: 1, rate: 75 }, { product: "Y", qty: 1, rate: 0 }] }))
  ).toBe("no_price");
});

test("multi-line: still blocked by no_match / needs_review / no_recipient", () => {
  expect(quoteProblem(row({ status: "no_match", line_items: [{ product: "X", qty: 1, rate: 5 }] }))).toBe("no_match");
  expect(quoteProblem(row({ needs_review: true, line_items: [{ product: "X", qty: 1, rate: 5 }] }))).toBe("needs_review");
  expect(quoteProblem(row({ quote_recipient: null, line_items: [{ product: "X", qty: 1, rate: 5 }] }))).toBe("no_recipient");
});

test("single-line: blank service name -> no_service (hard block)", () => {
  expect(quoteProblem(row({ inv_product_service: null }))).toBe("no_service");
  expect(quoteProblem(row({ inv_product_service: "   " }))).toBe("no_service");
});

test("single-line: a service name present + priced -> no problem", () => {
  expect(quoteProblem(row({ inv_product_service: "Carrier COP - New Build" }))).toBeNull();
});

test("blank service but no_match -> no_match wins", () => {
  expect(quoteProblem(row({ status: "no_match", inv_product_service: null }))).toBe("no_match");
});

test("blank service but no_price -> no_price reported first", () => {
  expect(quoteProblem(row({ status: "no_price", inv_product_service: null }))).toBe("no_price");
});

test("multi-line with products is not flagged no_service even if inv_product_service blank", () => {
  expect(quoteProblem(row({ inv_product_service: null, line_items: [{ product: "X", qty: 1, rate: 75 }] }))).toBeNull();
});

test("isBlankService: true only for single-line blank, not multi-line or no_match", () => {
  expect(isBlankService(row({ inv_product_service: null }))).toBe(true);
  expect(isBlankService(row({ inv_product_service: "X" }))).toBe(false);
  expect(isBlankService(row({ inv_product_service: null, status: "no_match" }))).toBe(false);
  expect(isBlankService(row({ inv_product_service: null, line_items: [{ product: "X", qty: 1, rate: 5 }] }))).toBe(false);
});

test("quoteDisplayStatus: ready+blank-service shows no_service; with a service shows ready", () => {
  expect(quoteDisplayStatus(row({ status: "ready", inv_product_service: null }))).toBe("no_service");
  expect(quoteDisplayStatus(row({ status: "ready", inv_product_service: "Carrier COP" }))).toBe("ready");
  expect(quoteDisplayStatus(row({ status: "no_price", inv_product_service: null }))).toBe("no_price");
  expect(quoteDisplayStatus(row({ status: "no_match", inv_product_service: null }))).toBe("no_match");
  expect(quoteDisplayStatus(row({ status: "ready", inv_product_service: null, line_items: [{ product: "X", qty: 1, rate: 5 }] }))).toBe("ready");
});
