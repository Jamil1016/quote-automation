import type { QuoteRow, QuoteLineItem } from "./types";
import { cleanServiceLabel } from "./format";

export interface QuoteLine { item: number; product: string; qty: number; rate: number; amount: number; }
export interface QuoteModel { siteName: string; date: string; lines: QuoteLine[]; total: number; }

export function money(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function productLabel(row: QuoteRow): string {
  return cleanServiceLabel(row.inv_product_service);
}

const toNum = (v: unknown): number =>
  Number(String(v ?? "").replace(/[^0-9.]/g, "")) || 0;

/** Trim products, coerce qty to a positive int (default 1) and rate to a number,
 *  drop only fully-empty rows (no product AND no rate), and return null when
 *  nothing remains. A blank-product line that carries a rate is KEPT, so seeding
 *  a multi-line quote from a no-service entry (rate present, product blank) opens
 *  the editor with that line to fill in rather than collapsing to nothing. */
export function normalizeLineItems(items: unknown): QuoteLineItem[] | null {
  if (!Array.isArray(items)) return null;
  const clean = items
    .map((li) => {
      const o = (li ?? {}) as Record<string, unknown>;
      const qtyRaw = Math.floor(Number(o.qty));
      return {
        product: String(o.product ?? "").trim(),
        qty: Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1,
        rate: toNum(o.rate),
      };
    })
    .filter((li) => li.product !== "" || li.rate > 0);
  return clean.length ? clean : null;
}

export function buildQuote(row: QuoteRow, dateStr?: string): QuoteModel {
  const date = dateStr ?? new Date().toLocaleDateString("en-US");
  const items = row.line_items;
  let lines: QuoteLine[];
  if (items && items.length > 0) {
    lines = items.map((li, i) => {
      const qty = li.qty > 0 ? li.qty : 1;
      const rate = Number(li.rate) || 0;
      return { item: i + 1, product: cleanServiceLabel(li.product), qty, rate, amount: qty * rate };
    });
  } else {
    const rate = toNum(row.inv_service_rate);
    lines = [{ item: 1, product: productLabel(row), qty: 1, rate, amount: rate }];
  }
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return { siteName: row.asset_name, date, lines, total };
}
