import { test, expect } from "@playwright/test";
import { tokenizeHtml, tokenizeText, serializeHtml, serializeToText } from "./token-html";

test("tokenizeHtml (body) rewrites known {{tokens}} to spans WITHOUT escaping surrounding HTML", () => {
  expect(tokenizeHtml("<p>Hi {{gc}},</p>")).toBe('<p>Hi <span data-token="gc"></span>,</p>');
  expect(tokenizeHtml("{{nope}}")).toBe("{{nope}}"); // unknown token untouched
});

test("tokenizeText (subject) escapes surrounding markup, then tokenizes", () => {
  expect(tokenizeText("Hi {{gc}}")).toBe('Hi <span data-token="gc"></span>');
  expect(tokenizeText("a & b <c> {{gc}}")).toBe('a &amp; b &lt;c&gt; <span data-token="gc"></span>');
  expect(tokenizeText("{{nope}}")).toBe("{{nope}}");
});

test("serializeHtml collapses pill spans back to literal {{token}} (storage format)", () => {
  expect(serializeHtml('Hi <span class="token-chip" data-token="gc">GC</span>!')).toBe("Hi {{gc}}!");
  // attribute order / extra attrs don't matter
  expect(serializeHtml('<span data-token="market" class="token-chip">Market</span>')).toBe("{{market}}");
});

test("round-trip: tokenize -> serialize preserves the canonical {{token}} string", () => {
  for (const s of ["Good day {{gc}} Team,", "{{carrier}}/{{market}} - {{gc}}", "no tokens here", "{{unknownX}} stays"]) {
    expect(serializeHtml(tokenizeHtml(s))).toBe(s);
  }
});

test("serializeToText flattens a single-line subject (pills + tags) to plain text", () => {
  const editorHtml = '<p>{{carrier}}/{{market}} - <span class="token-chip" data-token="gc">GC</span></p>';
  expect(serializeToText(editorHtml)).toBe("{{carrier}}/{{market}} - {{gc}}");
});
