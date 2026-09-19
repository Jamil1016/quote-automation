import { test, expect } from "@playwright/test";
import { etToUtcIso, formatEtDate } from "./email-time";

test("EDT (June): 9:00 AM ET = 13:00 UTC", () => {
  expect(etToUtcIso("2026-06-12T09:00")).toBe("2026-06-12T13:00:00.000Z");
});

test("EST (January): 9:00 AM ET = 14:00 UTC", () => {
  expect(etToUtcIso("2026-01-15T09:00")).toBe("2026-01-15T14:00:00.000Z");
});

test("formatEtDate renders MM/DD/YYYY in ET", () => {
  expect(formatEtDate("2026-06-12T13:00:00.000Z")).toBe("06/12/2026");
  // 03:00 UTC is the previous day in ET
  expect(formatEtDate("2026-06-12T03:00:00.000Z")).toBe("06/11/2026");
});
