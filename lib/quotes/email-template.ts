import type { QuoteRow } from "./types";
import { inlineEmailStyles, BODY_WRAPPER_STYLE } from "./email-style";

/** The {{tokens}} available in subject + body; shown in the Insert-field dropdown. */
export const EMAIL_TOKENS = [
  { token: "asset_name", label: "Asset name" },
  { token: "asset_id", label: "Site ID path" },
  { token: "site_id", label: "Site ID (invoice)" },
  { token: "gc", label: "GC" },
  { token: "carrier", label: "Carrier" },
  { token: "market", label: "Market" },
  { token: "project", label: "Project" },
  { token: "subcon", label: "Subcon" },
  { token: "fuze_id", label: "Fuze ID" },
  { token: "service_rate", label: "Service rate" },
  { token: "product_service", label: "Product / Service" },
  { token: "send_date", label: "Send date (MM/DD/YYYY)" },
  { token: "drive_link", label: "Drive link" },
  { token: "task_name", label: "Task name" },
  { token: "site_name", label: "Site name (invoice)" },
  { token: "sow", label: "SOW" },
  { token: "invoice_category", label: "Invoice category" },
  { token: "service_type", label: "Service type" },
  { token: "requirement_status", label: "Requirement status" },
  { token: "ts_project", label: "PM project" },
] as const;

export type TokenValues = Record<string, string>;

/** Per-entry values; sendDateEt = the SCHEDULED date formatted MM/DD/YYYY ET. */
export function tokenValuesFor(row: QuoteRow, sendDateEt: string): TokenValues {
  return {
    asset_name: row.asset_name ?? "",
    asset_id: row.asset_id ?? "",
    site_id: row.inv_site_id ?? "",
    gc: row.gc ?? "",
    carrier: row.carrier ?? "",
    market: row.market ?? "",
    project: row.project ?? "",
    subcon: row.subcon ?? "",
    fuze_id: row.fuze_id ?? "",
    service_rate: row.inv_service_rate ?? "",
    product_service: row.inv_product_service ?? "",
    send_date: sendDateEt,
    drive_link: row.drive_link ?? "",
    task_name: row.task_name ?? "",
    site_name: row.inv_site_name ?? "",
    sow: row.inv_sow ?? "",
    invoice_category: row.inv_invoice_category ?? "",
    service_type: row.inv_service_type ?? "",
    requirement_status: row.inv_requirement_status ?? "",
    ts_project: row.inv_project ?? "",
  };
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Replace {{token}} with values; unknown tokens stay visible so typos are obvious. */
export function substituteTokens(text: string, values: TokenValues, opts?: { html?: boolean }): string {
  return text.replace(/\{\{(\w+)\}\}/g, (m, k: string) =>
    k in values ? (opts?.html ? escapeHtml(values[k]) : values[k]) : m
  );
}

/** Plain-text alternative from editor HTML (Gmail shows it in clients without HTML). */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|blockquote|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * TipTap emits an empty `<p></p>` (or `<p><br></p>`) for a blank line pressed in
 * the editor. A bare empty paragraph has zero content height in HTML and its
 * margins collapse with neighbours, so blank lines silently disappeared in both
 * the preview iframe and the actual sent email. Give every empty paragraph a
 * non-breaking space so it keeps a full line of height (works even in clients
 * that strip <style>).
 */
function preserveBlankLines(html: string): string {
  return html.replace(/<p>\s*(?:<br\s*\/?>)?\s*<\/p>/gi, "<p>&nbsp;</p>");
}

/**
 * The editor (ProseMirror) renders with `white-space: pre-wrap`, so two or more
 * consecutive spaces stay visible there. The preview iframe and the sent email
 * render with the default `white-space: normal`, which collapses runs of spaces
 * to a single one, so the extra spaces silently vanished. Mirror what Gmail does:
 * keep the first space collapsible and turn the rest into non-breaking spaces, so
 * the run survives while the line can still wrap at that point. Only text nodes
 * (between tags) are touched, never whitespace inside tags/attributes.
 */
function preserveSpaces(html: string): string {
  return html.replace(/>([^<]+)</g, (_m, text: string) =>
    ">" + text.replace(/ {2,}/g, (run) => " " + "&nbsp;".repeat(run.length - 1)) + "<"
  );
}

/** Substituted subject + Verdana-wrapped HTML (legacy email look) + text alternative. */
export function renderEmail(
  tpl: { subject: string; body_html: string },
  values: TokenValues
): { subject: string; html: string; text: string } {
  const subject = substituteTokens(tpl.subject, values);
  const body = preserveSpaces(preserveBlankLines(substituteTokens(tpl.body_html, values, { html: true })));
  // Styles must be INLINE: Gmail strips <style> blocks from message bodies, so a
  // leading <style> rule never reached the recipient. inlineEmailStyles writes the
  // block defaults onto every element (never clobbering per-element overrides).
  const html = `<div style="${BODY_WRAPPER_STYLE}">${inlineEmailStyles(body)}</div>`;
  return { subject, html, text: htmlToText(body) };
}
