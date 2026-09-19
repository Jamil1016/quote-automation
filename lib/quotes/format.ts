import { formatInTimeZone } from "date-fns-tz";
import type { QuoteStatus } from "./types";

export function formatRate(raw: string | null | undefined): string {
  if (!raw) return "—";
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  if (!isFinite(n) || n === 0) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Display label for a product/service value. Strips an embedded price tag like
 * " [$250]" that some invoice rows carry in the text (e.g. "FTTH - COP Phase 2
 * [$250]") — the price already lives in the Service Rate, so it's redundant and
 * noisy in both the UI and the generated quote PDF.
 */
export function cleanServiceLabel(raw: string | null | undefined): string {
  if (!raw) return "—";
  const cleaned = raw
    .replace(/\s*\[\s*\$[^\]]*\]\s*/g, " ")  // drop [$250] / [$ 250.00] price tags
    .replace(/\s{2,}/g, " ")                  // collapse double spaces left behind
    .replace(/[\s\-–·|,]+$/, "")              // trim a dangling separator
    .trim();
  return cleaned || "—";
}

export function statusLabel(s: QuoteStatus | "no_service"): string {
  return s === "ready" ? "ready"
    : s === "no_price" ? "no price"
    : s === "no_service" ? "no service"
    : "no match";
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * The schedule date embedded as the trailing "Mmm yyyy" segment of a Site-ID
 * path (e.g. "…/FTTH/Phase 2/Jun 2026" → "Jun 2026"). Returns null if absent.
 */
export function siteDate(assetId: string | null | undefined): string | null {
  if (!assetId) return null;
  const segs = assetId.split("/").map((s) => s.trim()).filter(Boolean);
  for (let i = segs.length - 1; i >= 0; i--) {
    const m = segs[i].match(/^([A-Za-z]{3,9})\s+(\d{4})$/);
    if (m && MONTHS.includes(m[1].slice(0, 3).toLowerCase())) {
      const mon = m[1].slice(0, 3).toLowerCase();
      return `${mon[0].toUpperCase()}${mon.slice(1)} ${m[2]}`;
    }
  }
  return null;
}

/** Sortable key for a "Mmm yyyy" label (year*12 + month). -1 if unparseable. */
export function siteDateSortKey(label: string | null): number {
  if (!label) return -1;
  const m = label.match(/^([A-Za-z]{3})\w*\s+(\d{4})$/);
  if (!m) return -1;
  const mi = MONTHS.indexOf(m[1].toLowerCase());
  return mi < 0 ? -1 : Number(m[2]) * 12 + mi;
}

export function formatRefreshedET(iso: string | null): string {
  if (!iso) return "—";
  return formatInTimeZone(new Date(iso), "America/New_York", "MMM d, yyyy h:mma 'ET'");
}
