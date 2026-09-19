import type { QuoteModel } from "@/lib/quotes/quote-model";
import { money } from "@/lib/quotes/quote-model";
import { BRAND_LOGO_DATA_URI } from "@/lib/quotes/brand-logo";

const NAVY = "#243746";

/** Font sizes (px) matched 1:1 to the legacy Example Co quote PDF, which uses Calibri
 *  on A4. Measured from the sample (pt → px at 96dpi, ×1.333):
 *   Example Co LLC 16.5pt, address/cells 10pt, Site/Date + headers 12.4pt,
 *   QUOTATION 25.9pt, Total 17.1pt. */
const FS = {
  company: 22,   // 16.5pt
  body: 13.3,    // 10pt  (address + table cells)
  label: 16.5,   // 12.4pt (Site Name/Date + table headers)
  title: 34.5,   // 25.9pt (QUOTATION)
  total: 22.8,   // 17.1pt
};
// Calibri first (renders in-browser on Windows); Carlito is the metric-compatible
// fallback for Linux/Playwright PDF so glyph widths stay identical.
const FONT = "Calibri, Carlito, 'Segoe UI', Arial, sans-serif";

/** On-screen quotation preview (the QuotePreview modal) — mirrors the legacy
 *  Example Co quote PDF (A4, Calibri, matched font sizes). Inline styles only (no
 *  Tailwind). The downloadable/bulk PDF is rendered separately by
 *  <QuotePdfDocument> via @react-pdf (no headless browser, serverless-safe);
 *  the two are kept visually in sync. The logo defaults to the inline base64
 *  data URI (recolored navy) so it embeds without a served /public asset. */
export function QuoteDocument({ quote, logoSrc = BRAND_LOGO_DATA_URI }: { quote: QuoteModel; logoSrc?: string }) {
  return (
    <div
      style={{
        width: "8.27in", minHeight: "11.69in", padding: "0.72in", boxSizing: "border-box",
        background: "#fff", color: "#1a1a1a", fontFamily: FONT, fontSize: FS.body,
      }}
    >
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: "bold", fontSize: FS.company, color: NAVY }}>Example Co LLC</div>
          <div style={{ color: "#666", lineHeight: 1.5, marginTop: 4 }}>
            (555) 010-0100<br />100 Example Street<br />Suite 200<br />Sampletown, ST 00000
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt="Example Co" style={{ height: "1.23in" }} />
        </div>
      </div>

      {/* site / date */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 34, fontWeight: "bold", fontSize: FS.label, color: NAVY }}>
        <div><span style={{ marginRight: 24 }}>Site Name:</span>{quote.siteName}</div>
        <div><span style={{ marginRight: 24 }}>Date:</span>{quote.date}</div>
      </div>

      {/* title */}
      <div style={{ textAlign: "center", fontSize: FS.title, fontWeight: "bold", color: NAVY, margin: "52px 0 36px" }}>
        QUOTATION
      </div>

      {/* total box */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <div style={{ display: "flex", border: `1px solid ${NAVY}`, minWidth: 280, fontSize: FS.total }}>
          <div style={{ flex: 1, padding: "8px 14px", fontStyle: "italic", fontWeight: "bold", color: NAVY, background: "#eef1f4" }}>Total</div>
          <div style={{ flex: 1, padding: "8px 14px", fontStyle: "italic", fontWeight: "bold", color: NAVY, textAlign: "right" }}>{money(quote.total)}</div>
        </div>
      </div>

      {/* line table */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: NAVY, color: "#fff", fontSize: FS.label }}>
            <th style={{ padding: "8px 10px", textAlign: "center", width: "8%" }}>Item</th>
            <th style={{ padding: "8px 10px", textAlign: "left" }}>Product/Service</th>
            <th style={{ padding: "8px 10px", textAlign: "center", width: "10%" }}>Qty</th>
            <th style={{ padding: "8px 10px", textAlign: "right", width: "16%" }}>Rate</th>
            <th style={{ padding: "8px 10px", textAlign: "right", width: "16%" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {quote.lines.map((l) => (
            <tr key={l.item} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "10px", textAlign: "center" }}>{l.item}</td>
              <td style={{ padding: "10px", fontSize: 12 }}>{l.product}</td>
              <td style={{ padding: "10px", textAlign: "center" }}>{l.qty}</td>
              <td style={{ padding: "10px", textAlign: "right" }}>{money(l.rate)}</td>
              <td style={{ padding: "10px", textAlign: "right" }}>{money(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
