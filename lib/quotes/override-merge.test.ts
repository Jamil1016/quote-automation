import { test, expect } from "@playwright/test";
import { mergeOverride } from "./override-merge";

const NOW = "2026-06-17T05:00:00.000Z";

test("no existing row: defaults for every column, patch applied, stamped", () => {
  expect(mergeOverride("T-1", {}, { gc: "Northwind Builders" }, "dev@example.com", NOW)).toEqual({
    task_did: "T-1", subcon: null, gc: "Northwind Builders", carrier: null, market: null, project: null,
    fuze_id: null, verified: false, verified_by: null, verified_at: null, chosen_line_key: null,
    service_rate_override: null, product_service_override: null, line_items: null,
    updated_by: "dev@example.com", updated_at: NOW,
  });
});

test("sibling fields on the stored row are preserved", () => {
  const existing = {
    gc: "Summit Tower Services", verified: true, verified_by: "a@example.com", verified_at: "2026-06-01T00:00:00Z",
    service_rate_override: "1850", line_items: [{ product: "X", qty: 1, rate: 10 }],
  };
  const m = mergeOverride("T-1", existing, { chosen_line_key: "L-1-2" }, "dev@example.com", NOW);
  expect(m).toMatchObject({ ...existing, chosen_line_key: "L-1-2", updated_by: "dev@example.com", updated_at: NOW });
});

test("a null patch value clears the override; an empty string is kept as an explicit blank", () => {
  const m = mergeOverride("T-1", { gc: "Old", market: "Lakeshore" }, { gc: null, market: "" }, "dev@example.com", NOW);
  expect(m.gc).toBeNull();
  expect(m.market).toBe("");
});

test("unknown columns are rejected", () => {
  expect(() => mergeOverride("T-1", {}, { nope: 1 }, "dev@example.com", NOW)).toThrow(/Unknown override column/);
});
