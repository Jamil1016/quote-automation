import { test, expect } from "@playwright/test";
import { buildMime, toBase64Url } from "./email-mime";

const input = {
  from: "dev@example.com",
  to: ["a@x.co", "b@x.co"],
  cc: ["c@x.co"],
  subject: "Northwind Builders - Quote Provided (06/12/2026)",
  html: "<div><b>Site</b> quote attached.</div>",
  text: "Site quote attached.",
  attachment: { filename: "SITE - Example Co Quote.pdf", mimeType: "application/pdf", bytesBase64: Buffer.from("%PDF-fake").toString("base64") },
  boundaries: { mixed: "MIX", alt: "ALT" },
};

test("builds mixed/alternative structure with attachment", () => {
  const raw = buildMime(input);
  expect(raw).toContain("From: dev@example.com");
  expect(raw).toContain("To: a@x.co, b@x.co");
  expect(raw).toContain("Cc: c@x.co");
  expect(raw).toContain("Subject: Northwind Builders - Quote Provided (06/12/2026)");
  expect(raw).toContain('Content-Type: multipart/mixed; boundary="MIX"');
  expect(raw).toContain('Content-Type: multipart/alternative; boundary="ALT"');
  expect(raw).toContain("Content-Type: text/plain; charset=UTF-8");
  expect(raw).toContain("Content-Type: text/html; charset=UTF-8");
  expect(raw).toContain('Content-Disposition: attachment; filename="SITE - Example Co Quote.pdf"');
  expect(raw.indexOf("--MIX--")).toBeGreaterThan(raw.indexOf("--ALT--"));
});

test("no cc header when cc empty; non-ascii subject is RFC2047-encoded", () => {
  const raw = buildMime({ ...input, cc: [], subject: "Qucafé" });
  expect(raw).not.toContain("Cc:");
  expect(raw).toContain("Subject: =?UTF-8?B?");
});

test("toBase64Url produces url-safe base64", () => {
  const b = toBase64Url("a+b/c?");
  expect(b).not.toMatch(/[+/=]/);
});

test("throws on CRLF/invalid recipient addresses", () => {
  expect(() => buildMime({ ...input, to: ["evil@x.co\r\nBcc: victim@y.co"] })).toThrow(/invalid email address/);
  expect(() => buildMime({ ...input, from: "bad\nfrom@x.co" })).toThrow(/invalid email address/);
});

test("sanitizes attachment filename and validates mimeType", () => {
  const raw = buildMime({ ...input, attachment: { ...input.attachment!, filename: 'EVIL"\r\nX-Inject: 1.pdf' } });
  expect(raw).toContain('filename="EVIL X-Inject: 1.pdf"');
  expect(raw).not.toContain("X-Inject: 1\r\n");
  expect(() => buildMime({ ...input, attachment: { ...input.attachment!, mimeType: "bad/type; evil=1" } })).toThrow(/mimeType/);
});

test("bodies are 8bit and random boundaries are high-entropy", () => {
  const raw = buildMime({ ...input, boundaries: undefined });
  expect(raw).toContain("Content-Transfer-Encoding: 8bit");
  expect(raw).not.toContain("Content-Transfer-Encoding: 7bit");
  const b = raw.match(/boundary="([^"]+)"/)?.[1] ?? "";
  expect(b.length).toBeGreaterThanOrEqual(12);
});

test("throws when body contains a boundary marker", () => {
  expect(() => buildMime({ ...input, html: "<div>--ALT</div>" })).toThrow(/boundary/);
});

import type { InlineImage } from "./email-images";

const inlineImg: InlineImage = {
  cid: "img0@quote", mimeType: "image/png",
  bytesBase64: Buffer.from("PNGDATA").toString("base64"), filename: "image-0.png",
};

test("wraps html in multipart/related when inlineImages present", () => {
  const raw = buildMime({
    ...input, inlineImages: [inlineImg],
    boundaries: { mixed: "MIX", alt: "ALT", related: "REL" },
  });
  expect(raw).toContain('Content-Type: multipart/related; boundary="REL"');
  expect(raw).toContain("Content-ID: <img0@quote>");
  expect(raw).toContain("Content-Disposition: inline; filename=\"image-0.png\"");
  expect(raw).toContain("Content-Type: image/png; name=\"image-0.png\"");
  // related closes before the mixed-level pdf attachment
  expect(raw.indexOf("--REL--")).toBeGreaterThan(raw.indexOf("--ALT--"));
  expect(raw.indexOf("--MIX--")).toBeGreaterThan(raw.indexOf("--REL--"));
});

test("no related wrapper when inlineImages empty/absent", () => {
  const raw = buildMime({ ...input, inlineImages: [] });
  expect(raw).not.toContain("multipart/related");
});

test("invalid inline image mimeType throws", () => {
  expect(() => buildMime({ ...input, inlineImages: [{ ...inlineImg, mimeType: "bad type" }] }))
    .toThrow(/mimeType/);
});

test("inline image with a CRLF-injected Content-ID throws", () => {
  expect(() => buildMime({ ...input, inlineImages: [{ ...inlineImg, cid: "x@y\r\nEvil: 1" }] }))
    .toThrow(/Content-ID/);
});

test("inline image with non-base64 bytes throws", () => {
  expect(() => buildMime({ ...input, inlineImages: [{ ...inlineImg, bytesBase64: "not base64!!" }] }))
    .toThrow(/base64/);
});

test("From with a display name is quoted; pipe is preserved", () => {
  const raw = buildMime({ ...input, from: { name: "Accounting | Example Co", email: "accounting@example.com" } });
  expect(raw).toContain('From: "Accounting | Example Co" <accounting@example.com>');
});

test("From display name strips CRLF/quotes (header-injection guard)", () => {
  const raw = buildMime({ ...input, from: { name: 'Acct"\r\nBcc: evil@x.co', email: "accounting@example.com" } });
  expect(raw).not.toContain("Bcc: evil@x.co\r\n");      // no injected header line
  expect(raw).toContain("<accounting@example.com>");
  expect(raw.split("\r\n").filter((l) => l.startsWith("From:")).length).toBe(1);
});

test("From display name strips backslash (no unterminated quoted-string)", () => {
  const raw = buildMime({ ...input, from: { name: "Example Co \\", email: "accounting@example.com" } });
  expect(raw).not.toContain("\\");                       // escape char never reaches the header
  expect(raw).toContain('From: "Example Co" <accounting@example.com>');
});

test("non-ASCII From name is RFC2047-encoded", () => {
  const raw = buildMime({ ...input, from: { name: "Café Example Co", email: "accounting@example.com" } });
  expect(raw).toContain("=?UTF-8?B?");
  expect(raw).toContain("<accounting@example.com>");
});

test("bare-email From still works (backward compatible)", () => {
  const raw = buildMime({ ...input, from: { email: "dev@example.com" } });
  expect(raw).toContain("From: dev@example.com");
});
