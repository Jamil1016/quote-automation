// lib/quotes/outbox.ts
// Pure helpers for the Email Outbox UI: which rows can be batch-selected, mapping a
// selection back to the row ids / task_dids an action should touch, and the free-text
// search predicate. Kept out of the component so they can be unit-tested directly.
import type { EmailQueueRow } from "./types";

/** Sent rows can't be recalled, so they're excluded from batch select (returned rows too). */
export function isBatchSelectable(q: EmailQueueRow): boolean {
  return !q.returned_at && q.status !== "sent";
}

/** Failed/Cancelled are the only statuses that can be re-scheduled. */
export function isReschedulable(status: string): boolean {
  return status === "failed" || status === "cancelled";
}

/**
 * Live (non-returned) queue row ids whose task_did is in the selection. These are the
 * ids handed to returnManyFromOutbox — never returned rows, so the count never
 * over-states what the action actually does.
 */
export function returnableIds(queue: EmailQueueRow[], selected: Set<string>): number[] {
  return queue.filter((q) => selected.has(q.task_did) && !q.returned_at).map((q) => q.id);
}

/** Task_dids in the selection that have at least one reschedulable (failed/cancelled) row. */
export function reschedulableTaskDids(queue: EmailQueueRow[], selected: Set<string>): string[] {
  const dids = new Set<string>();
  for (const q of queue) {
    if (selected.has(q.task_did) && !q.returned_at && isReschedulable(q.status)) dids.add(q.task_did);
  }
  return [...dids];
}

/** Lowercased haystack for a row: asset name + the human-facing columns. */
export function outboxSearchText(q: EmailQueueRow, assetName: string | undefined): string {
  return [
    assetName,
    q.task_did,
    q.subject_resolved,
    q.to_resolved,
    q.cc_resolved,
    q.from_email,
    q.sender_email,
    q.created_by,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Case-insensitive substring match; an empty/blank term matches everything. */
export function matchesOutboxSearch(q: EmailQueueRow, assetName: string | undefined, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return true;
  return outboxSearchText(q, assetName).includes(t);
}
