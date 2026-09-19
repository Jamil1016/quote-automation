// lib/quotes/email-style.test.ts
import { test, expect } from "@playwright/test";
import { inlineEmailStyles } from "./email-style";

test("adds default margins + line-height to a bare paragraph", () => {
  const out = inlineEmailStyles("<p>Hello</p>");
  expect(out).toContain("margin-top:0");
  expect(out).toContain("margin-bottom:10px");
  expect(out).toContain("line-height:1.45");
});

test("preserves a user line-height and does not duplicate it", () => {
  const out = inlineEmailStyles('<p style="line-height:2">Hi</p>');
  expect(out).toContain("line-height:2");
  expect(out).not.toContain("line-height:1.45");
  // still adds the margins it was missing
  expect(out).toContain("margin-bottom:10px");
});

test("preserves an indent margin-left and never adds a margin shorthand", () => {
  const out = inlineEmailStyles('<p style="margin-left:40px">Indented</p>');
  expect(out).toContain("margin-left:40px");
  expect(out).not.toMatch(/style="[^"]*\bmargin:/); // no shorthand that would clobber margin-left
  expect(out).toContain("margin-bottom:10px");
});

test("applies to li, blockquote and headings too", () => {
  const out = inlineEmailStyles("<blockquote>q</blockquote><li>x</li><h2>t</h2>");
  expect((out.match(/line-height:1.45/g) ?? []).length).toBe(3);
});

test("leaves an empty nbsp paragraph (blank line) intact", () => {
  const out = inlineEmailStyles("<p>&nbsp;</p>");
  expect(out).toContain("&nbsp;");
  expect(out).toContain("margin-bottom:10px");
});

test("does not touch non-block tags", () => {
  const out = inlineEmailStyles('<span style="color:red">x</span>');
  expect(out).toBe('<span style="color:red">x</span>');
});
