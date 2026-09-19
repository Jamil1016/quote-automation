import type { QuoteRow, QuoteStatus } from "./types";

/**
 * What makes a row ineligible for bulk quote generation. A quote with no rate
 * (no_price / no_match) can't be a real quote; a row still flagged for review
 * hasn't been signed off. The bulk run is BLOCKED until every selected row is
 * problem-free — enforced both in the UI (before the call) and in the route.
 */
export type ProblemReason = "no_price" | "no_service" | "no_match" | "needs_review" | "no_recipient" | "not_found";

export const PROBLEM_LABELS: Record<ProblemReason, string> = {
  no_match: "No invoice match",
  no_price: "No price",
  no_service: "No service name",
  needs_review: "Needs review",
  no_recipient: "No recipient",
  not_found: "Not found",
};

export function quoteProblem(row: QuoteRow): ProblemReason | null {
  if (row.status === "no_match") return "no_match";
  const items = row.line_items;
  if (items && items.length > 0) {
    // multi-line: every line carries its own product, so blanks are caught here
    if (!items.every((li) => !!li.product?.trim() && Number(li.rate) > 0)) return "no_price";
  } else {
    if (row.status === "no_price") return "no_price";
    // single-line with no Product/Service text can't be a real quote line
    if (!row.inv_product_service?.trim()) return "no_service";
  }
  if (row.needs_review) return "needs_review";
  if (!row.quote_recipient) return "no_recipient";
  return null;
}

/**
 * A single-line quote with no Product/Service text (not a no_match row). These
 * are folded into the "Need review" bucket and hard-blocked by quoteProblem.
 */
export function isBlankService(row: QuoteRow): boolean {
  const hasItems = !!row.line_items && row.line_items.length > 0;
  return !hasItems && row.status !== "no_match" && !row.inv_product_service?.trim();
}

/**
 * The status to SHOW on the badge. A priced+matched row that has no Product/Service
 * yet reads "no_service" (instead of a misleading "ready") until a name is added.
 */
export function quoteDisplayStatus(row: QuoteRow): QuoteStatus | "no_service" {
  if (row.status === "ready" && isBlankService(row)) return "no_service";
  return row.status;
}

/** Has this quote been generated + uploaded to Drive? */
export function isGenerated(row: QuoteRow): boolean {
  return !!row.generated_at;
}

/**
 * Can this row be generated + uploaded to Drive straight from the detail panel?
 * True only when the row is "good to go": no outstanding problem (matched,
 * priced, signed off, has a recipient) AND it hasn't already been generated.
 * Queue rows are never generated, so in practice this is just "problem-free",
 * but the `isGenerated` guard keeps the button correct in any context.
 */
export function canGenerateToDrive(row: QuoteRow): boolean {
  return quoteProblem(row) === null && !isGenerated(row);
}

/**
 * Generated, but edited since (override updated after it was generated) — the
 * Drive PDF is stale and should be regenerated.
 */
export function isStaleGenerated(row: QuoteRow): boolean {
  return (
    !!row.generated_at &&
    !!row.override_at &&
    new Date(row.override_at).getTime() > new Date(row.generated_at).getTime()
  );
}

export interface ProblemEntry {
  task_did: string;
  asset: string;
  reason: ProblemReason;
}

// ---- NDJSON event protocol streamed by /api/quote-pdf/bulk ----
export type BulkEvent =
  | { type: "start"; total: number }
  | { type: "progress"; asset: string; ok: boolean; link?: string; updated?: boolean; error?: string }
  | { type: "done"; uploaded: number; failed: number };
