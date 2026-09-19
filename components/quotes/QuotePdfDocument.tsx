import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { QuoteModel } from "@/lib/quotes/quote-model";
import { money } from "@/lib/quotes/quote-model";
import { BRAND_LOGO_DATA_URI } from "@/lib/quotes/brand-logo";

/**
 * Pure-JS (@react-pdf/renderer) twin of <QuoteDocument>. Renders the same Example Co
 * quotation to a single-page A4 PDF with no headless browser, so it runs on any
 * serverless platform. Layout, navy, sizes, and the navy logo mirror the
 * on-screen preview; font is the built-in Helvetica (Calibri/Carlito metrics
 * could be bundled later via Font.register for an exact match).
 */

const NAVY = "#243746";

// Font sizes in pt (1:1 with the legacy Example Co quote PDF the HTML doc matched).
const FS = { company: 16.5, body: 10, label: 12.4, title: 25.9, total: 17.1 };

const s = StyleSheet.create({
  page: { paddingVertical: 51.84, paddingHorizontal: 51.84, fontFamily: "Helvetica", fontSize: FS.body, color: "#1a1a1a" },

  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  company: { fontFamily: "Helvetica-Bold", fontSize: FS.company, color: NAVY },
  address: { color: "#666666", fontSize: FS.body, lineHeight: 1.5, marginTop: 4 },
  logo: { height: 88.56, width: 88.56 * (873 / 332) },

  siteRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 30, fontSize: FS.label, color: NAVY },
  siteCell: { flexDirection: "row" },
  siteLabel: { fontFamily: "Helvetica-Bold", marginRight: 16 },
  siteValue: { fontFamily: "Helvetica-Bold" },

  title: { textAlign: "center", fontFamily: "Helvetica-Bold", fontSize: FS.title, color: NAVY, marginTop: 40, marginBottom: 28 },

  totalWrap: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 10 },
  totalBox: { flexDirection: "row", borderWidth: 1, borderColor: NAVY, width: 230, fontSize: FS.total },
  totalLabel: { flex: 1, paddingVertical: 6, paddingHorizontal: 12, fontFamily: "Helvetica-BoldOblique", color: NAVY, backgroundColor: "#eef1f4" },
  totalValue: { flex: 1, paddingVertical: 6, paddingHorizontal: 12, fontFamily: "Helvetica-BoldOblique", color: NAVY, textAlign: "right" },

  theadRow: { flexDirection: "row", backgroundColor: NAVY, fontSize: FS.label },
  th: { color: "#ffffff", fontFamily: "Helvetica-Bold", paddingVertical: 6, paddingHorizontal: 8 },
  bodyRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#eeeeee" },
  td: { paddingVertical: 8, paddingHorizontal: 8 },
  // slightly smaller so a long product label (e.g. "Closeout Package - 5G Upgrade - Carrier
  // COP - Macro - Any SOW") fits on one line in the Product/Service column
  productCell: { fontSize: 9 },

  // column widths (sum 100%)
  colItem: { width: "8%", textAlign: "center" },
  colProduct: { width: "50%", textAlign: "left" },
  colQty: { width: "10%", textAlign: "center" },
  colRate: { width: "16%", textAlign: "right" },
  colAmount: { width: "16%", textAlign: "right" },
});

export function QuotePdfDocument({ quote, logoSrc = BRAND_LOGO_DATA_URI }: { quote: QuoteModel; logoSrc?: string }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* header */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.company}>Example Co LLC</Text>
            <Text style={s.address}>(555) 010-0100{"\n"}100 Example Street{"\n"}Suite 200{"\n"}Sampletown, ST 00000</Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image style={s.logo} src={logoSrc} />
        </View>

        {/* site / date */}
        <View style={s.siteRow}>
          <View style={s.siteCell}>
            <Text style={s.siteLabel}>Site Name:</Text>
            <Text style={s.siteValue}>{quote.siteName}</Text>
          </View>
          <View style={s.siteCell}>
            <Text style={s.siteLabel}>Date:</Text>
            <Text style={s.siteValue}>{quote.date}</Text>
          </View>
        </View>

        {/* title */}
        <Text style={s.title}>QUOTATION</Text>

        {/* total box */}
        <View style={s.totalWrap}>
          <View style={s.totalBox}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalValue}>{money(quote.total)}</Text>
          </View>
        </View>

        {/* line table */}
        <View>
          <View style={s.theadRow}>
            <Text style={[s.th, s.colItem]}>Item</Text>
            <Text style={[s.th, s.colProduct]}>Product/Service</Text>
            <Text style={[s.th, s.colQty]}>Qty</Text>
            <Text style={[s.th, s.colRate]}>Rate</Text>
            <Text style={[s.th, s.colAmount]}>Amount</Text>
          </View>
          {quote.lines.map((l) => (
            <View key={l.item} style={s.bodyRow} wrap={false}>
              <Text style={[s.td, s.colItem]}>{l.item}</Text>
              <Text style={[s.td, s.colProduct, s.productCell]}>{l.product}</Text>
              <Text style={[s.td, s.colQty]}>{l.qty}</Text>
              <Text style={[s.td, s.colRate]}>{money(l.rate)}</Text>
              <Text style={[s.td, s.colAmount]}>{money(l.amount)}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
