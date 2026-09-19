import { test, expect } from "@playwright/test";
import {
  isBatchSelectable,
  returnableIds,
  reschedulableTaskDids,
  matchesOutboxSearch,
} from "./outbox";
import type { EmailQueueRow } from "./types";

const base: EmailQueueRow = {
  id: 1,
  task_did: "T1",
  sender_email: "dev@example.com",
  scheduled_at: "2026-06-18T13:00:00Z",
  status: "scheduled",
  subject_resolved: "Quote for NV0142",
  to_resolved: "northwind.quotes@example.com",
  cc_resolved: "northwind.pm@example.com",
  template_name: "Default",
  created_by: "dev@example.com",
  created_at: "2026-06-18T12:00:00Z",
  sent_at: null,
  error: null,
  from_email: null,
  returned_to: null,
  returned_by: null,
  returned_at: null,
};
const row = (over: Partial<EmailQueueRow>): EmailQueueRow => ({ ...base, ...over });

test("isBatchSelectable: waiting/failed/cancelled yes, sent and returned no", () => {
  expect(isBatchSelectable(row({ status: "scheduled" }))).toBe(true);
  expect(isBatchSelectable(row({ status: "failed" }))).toBe(true);
  expect(isBatchSelectable(row({ status: "cancelled" }))).toBe(true);
  expect(isBatchSelectable(row({ status: "sent" }))).toBe(false);
  expect(isBatchSelectable(row({ status: "failed", returned_at: "2026-06-18T14:00:00Z" }))).toBe(false);
});

test("returnableIds: only non-returned rows whose task_did is selected", () => {
  const queue = [
    row({ id: 1, task_did: "T1" }),
    row({ id: 2, task_did: "T2" }),
    row({ id: 3, task_did: "T1", returned_at: "2026-06-18T14:00:00Z" }), // already returned -> excluded
  ];
  expect(returnableIds(queue, new Set(["T1"]))).toEqual([1]);
  expect(returnableIds(queue, new Set(["T1", "T2"]))).toEqual([1, 2]);
  expect(returnableIds(queue, new Set())).toEqual([]);
});

test("reschedulableTaskDids: only failed/cancelled in the selection, deduped", () => {
  const queue = [
    row({ id: 1, task_did: "T1", status: "scheduled" }),
    row({ id: 2, task_did: "T2", status: "failed" }),
    row({ id: 3, task_did: "T3", status: "cancelled" }),
    row({ id: 4, task_did: "T2", status: "failed" }), // dup task_did
  ];
  const got = reschedulableTaskDids(queue, new Set(["T1", "T2", "T3"]));
  expect(got.sort()).toEqual(["T2", "T3"]);
});

test("matchesOutboxSearch: blank matches all; matches asset name and columns; case-insensitive", () => {
  const q = row({ subject_resolved: "Quote for NV0142", to_resolved: "northwind.quotes@example.com" });
  expect(matchesOutboxSearch(q, "Maple & Pine Rooftop", "")).toBe(true);
  expect(matchesOutboxSearch(q, "Maple & Pine Rooftop", "   ")).toBe(true);
  expect(matchesOutboxSearch(q, "Maple & Pine Rooftop", "rooftop")).toBe(true); // asset name
  expect(matchesOutboxSearch(q, "Maple & Pine Rooftop", "NV0142")).toBe(true); // subject
  expect(matchesOutboxSearch(q, "Maple & Pine Rooftop", "northwind.quotes")).toBe(true); // recipient
  expect(matchesOutboxSearch(q, "Maple & Pine Rooftop", "DEV@")).toBe(true); // sender, case-insensitive
  expect(matchesOutboxSearch(q, "Maple & Pine Rooftop", "nonexistent")).toBe(false);
});
