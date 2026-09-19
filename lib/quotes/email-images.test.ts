import { test, expect } from "@playwright/test";
import { inlineImagesToCid } from "./email-images";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

test("rewrites a data-URI img to cid and extracts the part", () => {
  const { html, images } = inlineImagesToCid(`<p>hi</p><img src="data:image/png;base64,${png}" style="width:120px">`);
  expect(images).toHaveLength(1);
  expect(images[0].mimeType).toBe("image/png");
  expect(images[0].bytesBase64).toBe(png);
  expect(images[0].filename).toMatch(/\.png$/);
  expect(html).toContain(`src="cid:${images[0].cid}"`);
  expect(html).toContain('style="width:120px"');
  expect(html).not.toContain("data:image");
});

test("multiple images get distinct cids", () => {
  const { html, images } = inlineImagesToCid(
    `<img src="data:image/png;base64,${png}"><img src="data:image/jpeg;base64,${png}">`,
  );
  expect(images).toHaveLength(2);
  expect(images[0].cid).not.toBe(images[1].cid);
  expect(images[1].mimeType).toBe("image/jpeg");
  expect((html.match(/cid:/g) ?? [])).toHaveLength(2);
});

test("hosted-url images are left untouched", () => {
  const src = `<img src="https://example.com/logo.png">`;
  const { html, images } = inlineImagesToCid(src);
  expect(images).toHaveLength(0);
  expect(html).toBe(src);
});

test("no images returns html unchanged", () => {
  const { html, images } = inlineImagesToCid("<p>plain</p>");
  expect(images).toHaveLength(0);
  expect(html).toBe("<p>plain</p>");
});

test("style-before-src attribute order is handled", () => {
  const { html, images } = inlineImagesToCid(
    `<img style="width:120px;max-width:100%;height:auto" src="data:image/png;base64,${png}">`,
  );
  expect(images).toHaveLength(1);
  expect(html).toContain('style="width:120px;max-width:100%;height:auto"');
  expect(html).not.toContain("data:image");
});
