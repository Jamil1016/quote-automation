import { test, expect } from "@playwright/test";
import { formatRate, formatRefreshedET, statusLabel } from "./format";

test("formatRate adds $ and 2 decimals; blank when empty", () => {
  expect(formatRate("585")).toBe("$585.00");
  expect(formatRate("$540.5")).toBe("$540.50");
  expect(formatRate(null)).toBe("—");
});

test("statusLabel maps codes", () => {
  expect(statusLabel("ready")).toBe("ready");
  expect(statusLabel("no_price")).toBe("no price");
  expect(statusLabel("no_match")).toBe("no match");
});

test("formatRefreshedET renders a date string or em dash", () => {
  expect(formatRefreshedET(null)).toBe("—");
  expect(formatRefreshedET("2026-06-08T05:24:00Z")).toContain("2026");
});
