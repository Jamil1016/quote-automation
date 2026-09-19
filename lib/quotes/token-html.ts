// lib/quotes/token-html.ts
// Bridges the canonical `{{token}}` storage format and the editor's token-pill nodes.
// Templates are stored with literal {{token}} text (so substituteTokens/the send path
// are untouched); the editors render those as pills via a token node. These helpers
// convert between the two at the editor boundary only.
import { EMAIL_TOKENS } from "./email-template";

export const TOKEN_LABELS = new Map<string, string>(EMAIL_TOKENS.map((t) => [t.token, t.label]));

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const tokenSpan = (k: string) => `<span data-token="${k}"></span>`;

/**
 * HTML body template -> editor HTML: known `{{token}}` become empty `<span data-token>`
 * placeholders the token node parses into pills. The input is already HTML (paragraphs,
 * images, …) so it is NOT escaped — only the token braces are rewritten. Unknown tokens
 * are left as literal text.
 */
export function tokenizeHtml(html: string): string {
  return html.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (TOKEN_LABELS.has(k) ? tokenSpan(k) : m));
}

/**
 * Plain-text field (the subject) -> editor HTML: escape the surrounding text so stray
 * `<`/`&` aren't treated as markup, then rewrite known `{{token}}` into pill spans.
 */
export function tokenizeText(s: string): string {
  let out = "";
  let last = 0;
  const re = /\{\{(\w+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    out += escapeHtml(s.slice(last, m.index));
    out += TOKEN_LABELS.has(m[1]) ? tokenSpan(m[1]) : escapeHtml(m[0]);
    last = m.index + m[0].length;
  }
  return out + escapeHtml(s.slice(last));
}

/** Editor HTML -> storage HTML: token pill spans collapse back to literal `{{token}}`. */
export function serializeHtml(html: string): string {
  return html.replace(/<span\b[^>]*\bdata-token="(\w+)"[^>]*>[\s\S]*?<\/span>/g, (_m, k: string) => `{{${k}}}`);
}

/** Editor HTML -> single-line plain text (for the subject): collapse pills, strip tags. */
export function serializeToText(html: string): string {
  return serializeHtml(html)
    .replace(/<\/(p|div)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
