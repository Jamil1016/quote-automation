import { test, expect } from "@playwright/test";
import { EMAIL_TOKENS, substituteTokens, htmlToText, renderEmail, tokenValuesFor } from "./email-template";
import type { QuoteRow } from "./types";

const row = {
  task_did: "T1",
  asset_id: "x/Northwind Builders/Carrier A/North Valley/5G Upgrade/NV0142/Jun 2026",
  asset_name: "Maple & Pine Rooftop - New Build",
  task_name: "install",
  task_status: "complete",
  gc: "Northwind Builders",
  carrier: "Carrier A",
  market: "North Valley",
  project: "5G Upgrade",
  subcon: null,
  fuze_id: null,
  needs_review: false,
  needs_review_base: false,
  verified: true,
  verified_by: null,
  verified_at: null,
  subcon_overridden: false,
  gc_overridden: false,
  carrier_overridden: false,
  market_overridden: false,
  project_overridden: false,
  fuze_id_overridden: false,
  service_rate_overridden: false,
  override_by: null,
  override_at: null,
  inv_project: null,
  inv_site_name: null,
  inv_site_id: "NV0142",
  inv_product_service: "Closeout Package - 5G Upgrade",
  inv_product_service_type: null,
  inv_invoice_category: null,
  inv_service_type: null,
  inv_sow: null,
  inv_service_rate: "585",
  inv_requirement_status: null,
  inv_form_did: null,
  chosen_line_key: null,
  invoice_chosen: false,
  quote_recipient: null,
  quote_cc: null,
  directory_matched: false,
  directory_conflict: false,
  priced_line_count: 0,
  status: "ready",
  generated_at: null,
  generated_by: null,
  drive_link: "https://drive.google.com/file/d/abc/view",
  drive_file_id: null,
} as QuoteRow;

test("token list contains the documented vocabulary", () => {
  const names = EMAIL_TOKENS.map((t) => t.token);
  for (const t of ["asset_name", "site_id", "gc", "carrier", "market", "project", "service_rate", "send_date", "drive_link"]) {
    expect(names).toContain(t);
  }
});

test("substituteTokens replaces known tokens, leaves unknown visible, escapes html", () => {
  const v = tokenValuesFor(row, "06/12/2026");
  expect(substituteTokens("{{gc}} - {{asset_name}} ({{send_date}})", v)).toBe(
    "Northwind Builders - Maple & Pine Rooftop - New Build (06/12/2026)"
  );
  expect(substituteTokens("{{nope}}", v)).toBe("{{nope}}");
  expect(substituteTokens("<b>{{asset_name}}</b>", v, { html: true })).toBe(
    "<b>Maple &amp; Pine Rooftop - New Build</b>"
  );
});

test("htmlToText flattens paragraphs and strips tags", () => {
  expect(htmlToText("<p>Good day <b>Northwind Builders</b> Team,</p><p>Attached is the quote.</p>")).toBe(
    "Good day Northwind Builders Team,\nAttached is the quote."
  );
});

test("renderEmail produces subject, wrapped html, and text alternative", () => {
  const out = renderEmail(
    { subject: "[{{carrier}}] {{asset_name}}", body_html: "<p>Hi {{gc}},</p>" },
    tokenValuesFor(row, "06/12/2026")
  );
  expect(out.subject).toBe("[Carrier A] Maple & Pine Rooftop - New Build");
  expect(out.html).toContain("font-family:Verdana");
  expect(out.html).toContain("Hi Northwind Builders,");
  expect(out.text).toBe("Hi Northwind Builders,");
});

test("renderEmail preserves blank lines — empty paragraphs don't collapse", () => {
  // TipTap emits an empty <p></p> for a blank line pressed in the editor; a bare
  // empty paragraph has zero height in HTML and collapses, so blank lines vanished
  // in both preview and the sent email. Empty paragraphs must carry a non-breaking
  // space so they keep their line height.
  const cases = ["<p>A</p><p></p><p>B</p>", "<p>A</p><p><br></p><p>B</p>", "<p>A</p><p><br/></p><p>B</p>"];
  for (const body of cases) {
    const out = renderEmail({ subject: "s", body_html: body }, {});
    // The blank paragraph keeps its non-breaking space (now carrying inline styles).
    expect(out.html).toContain("&nbsp;</p>");
    expect(out.html).not.toContain("<p></p>");
  }
  // paragraph spacing is declared inline so the rendered gap is consistent in Gmail
  const out = renderEmail({ subject: "s", body_html: "<p>A</p><p>B</p>" }, {});
  expect(out.html).toContain("margin-bottom:10px");
});

test("renderEmail preserves consecutive spaces — runs don't collapse", () => {
  // The editor (ProseMirror) shows two+ spaces via white-space:pre-wrap, but the
  // sent/preview HTML renders with white-space:normal and collapsed them to one.
  // Keep the first space collapsible and convert the rest to &nbsp; so the run
  // survives while the line can still wrap there (mirrors Gmail's behaviour).
  const out = renderEmail({ subject: "s", body_html: "<p>foo    bar</p>" }, {});
  expect(out.html).toContain("foo &nbsp;&nbsp;&nbsp;bar");
  // A single space stays a plain, collapsible space.
  const single = renderEmail({ subject: "s", body_html: "<p>foo bar</p>" }, {});
  expect(single.html).toContain("foo bar");
  expect(single.html).not.toContain("foo&nbsp;");
  // Tag/attribute whitespace must never be rewritten.
  const attr = renderEmail({ subject: "s", body_html: '<p style="line-height:2">a  b</p>' }, {});
  expect(attr.html).toContain('style="line-height:2');
  expect(attr.html).toContain("a &nbsp;b");
});

test("renderEmail emits inline paragraph styles and no <style> block", () => {
  const out = renderEmail({ subject: "S", body_html: "<p>Hi</p><p>Bye</p>" }, {} as never);
  expect(out.html).not.toContain("<style");
  expect(out.html).toContain("margin-bottom:10px");
  expect(out.html).toContain("line-height:1.45");
  expect(out.html).toContain("font-family:Verdana");
});

test("renderEmail preserves a user-set line-height on a paragraph", () => {
  const out = renderEmail({ subject: "S", body_html: '<p style="line-height:2">x</p>' }, {} as never);
  expect(out.html).toContain("line-height:2");
});
