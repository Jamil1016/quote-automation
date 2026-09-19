import type { QuoteRow } from "./types";

/**
 * Quote-PDF renderer used by BOTH the single-download route and the bulk route.
 * Renders the <QuotePdfDocument> with @react-pdf/renderer — pure JS, no headless
 * browser — so it runs on any serverless platform (Vercel included).
 *
 * @react-pdf and the document are imported LAZILY inside renderQuotePdf so the
 * library never lands in a route's static module graph (which has historically
 * caused 500s in Next 16).
 */

export function quoteFilename(assetName: string): string {
  return `${assetName} - Example Co Quote.pdf`.replace(/[\\/:*?"<>|]+/g, " ").trim();
}

/** Render a single quote to a single-page A4 PDF (Uint8Array). */
export async function renderQuotePdf(row: QuoteRow): Promise<Uint8Array> {
  const [{ renderToBuffer }, { createElement }, { QuotePdfDocument }, { buildQuote }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("react"),
    import("@/components/quotes/QuotePdfDocument"),
    import("./quote-model"),
  ]);
  const quote = buildQuote(row);
  // QuotePdfDocument returns a <Document>; cast to renderToBuffer's expected
  // element type (it types the arg as ReactElement<DocumentProps>).
  const element = createElement(QuotePdfDocument, { quote }) as unknown as Parameters<typeof renderToBuffer>[0];
  const buf = await renderToBuffer(element);
  return new Uint8Array(buf);
}

/** Run `worker` over items with at most `limit` in flight; results keep input order. */
export async function mapPool<I, O>(
  items: I[],
  limit: number,
  worker: (item: I, index: number) => Promise<O>,
): Promise<O[]> {
  const out: O[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return out;
}
