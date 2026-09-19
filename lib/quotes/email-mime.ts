import { randomBytes } from "node:crypto";
import type { InlineImage } from "./email-images";

export interface MimeInput {
  from: string | { name?: string; email: string };
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  text: string;
  attachment?: { filename: string; mimeType: string; bytesBase64: string };
  /** Inline images referenced by cid: in the html; embedded via multipart/related. */
  inlineImages?: InlineImage[];
  /** Fixed boundaries for tests; random when omitted. */
  boundaries?: { mixed: string; alt: string; related?: string };
}

export const ADDRESS_RE = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const MIME_TYPE_RE = /^[\w.+-]+\/[\w.+-]+$/;
const CID_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$/;
const BASE64_RE = /^[A-Za-z0-9+/]+=*$/;

function validateAddress(value: string, header: string): void {
  if (!ADDRESS_RE.test(value)) throw new Error(`invalid email address in ${header}: ${value}`);
}
function sanitizeFilename(name: string): string {
  return name.replace(/[\r\n\x00-\x1f"]/g, " ").replace(/ {2,}/g, " ").trim();
}
const rand = () => randomBytes(9).toString("base64url");
const chunk76 = (b64: string) => b64.replace(/(.{76})/g, "$1\r\n");
const encodeSubject = (s: string) =>
  /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`;

/** Quote + sanitize a From display name; RFC2047-encode if it has non-ASCII. */
function encodeDisplayName(name: string): string {
  const clean = name.replace(/[\r\n"\\]/g, " ").replace(/ {2,}/g, " ").trim();
  return /^[\x20-\x7e]*$/.test(clean)
    ? `"${clean}"`
    : `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}

/** RFC822 message. With inline images: mixed( related( alternative(text,html), img… ), pdf ). */
export function buildMime(m: MimeInput): string {
  const fromEmail = typeof m.from === "string" ? m.from : m.from.email;
  const fromName = typeof m.from === "string" ? undefined : m.from.name;
  validateAddress(fromEmail, "From");
  const fromHeader = fromName ? `${encodeDisplayName(fromName)} <${fromEmail}>` : fromEmail;
  for (const addr of m.to) validateAddress(addr, "To");
  for (const addr of m.cc ?? []) validateAddress(addr, "Cc");

  let filename: string | undefined;
  if (m.attachment) {
    if (!MIME_TYPE_RE.test(m.attachment.mimeType)) throw new Error(`invalid mimeType: ${m.attachment.mimeType}`);
    filename = sanitizeFilename(m.attachment.filename);
  }
  const images = m.inlineImages ?? [];
  for (const img of images) {
    if (!MIME_TYPE_RE.test(img.mimeType)) throw new Error(`invalid mimeType: ${img.mimeType}`);
    if (!CID_RE.test(img.cid)) throw new Error(`invalid Content-ID: ${img.cid}`);
    if (!BASE64_RE.test(img.bytesBase64)) throw new Error("invalid base64 in inline image");
  }

  const mixed = m.boundaries?.mixed ?? `mix_${rand()}`;
  const alt = m.boundaries?.alt ?? `alt_${rand()}`;
  const related = m.boundaries?.related ?? `rel_${rand()}`;
  const usedBoundaries = images.length ? [mixed, alt, related] : [mixed, alt];
  for (const boundary of usedBoundaries) {
    const marker = `--${boundary}`;
    if (m.text.includes(marker) || m.html.includes(marker)) {
      throw new Error(`body contains MIME boundary marker: ${marker}`);
    }
  }

  // The alternative block (text + html) is the same in both shapes.
  const alternative = [
    `--${alt}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    m.text,
    "",
    `--${alt}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    m.html,
    "",
    `--${alt}--`,
  ];

  const lines: string[] = [
    `From: ${fromHeader}`,
    `To: ${m.to.join(", ")}`,
    ...(m.cc && m.cc.length ? [`Cc: ${m.cc.join(", ")}`] : []),
    `Subject: ${encodeSubject(m.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixed}"`,
    "",
  ];

  if (images.length) {
    lines.push(
      `--${mixed}`,
      `Content-Type: multipart/related; boundary="${related}"`,
      "",
      `--${related}`,
      `Content-Type: multipart/alternative; boundary="${alt}"`,
      "",
      ...alternative,
    );
    for (const img of images) {
      const imgName = sanitizeFilename(img.filename);
      lines.push(
        "",
        `--${related}`,
        `Content-Type: ${img.mimeType}; name="${imgName}"`,
        "Content-Transfer-Encoding: base64",
        `Content-ID: <${img.cid}>`,
        `Content-Disposition: inline; filename="${imgName}"`,
        "",
        chunk76(img.bytesBase64),
      );
    }
    lines.push("", `--${related}--`);
  } else {
    lines.push(
      `--${mixed}`,
      `Content-Type: multipart/alternative; boundary="${alt}"`,
      "",
      ...alternative,
    );
  }

  if (m.attachment && filename !== undefined) {
    lines.push(
      "",
      `--${mixed}`,
      `Content-Type: ${m.attachment.mimeType}; name="${filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${filename}"`,
      "",
      chunk76(m.attachment.bytesBase64),
    );
  }
  lines.push("", `--${mixed}--`);
  return lines.join("\r\n");
}

export function toBase64Url(raw: string): string {
  return Buffer.from(raw, "utf8").toString("base64url");
}
