export interface InlineImage {
  cid: string;
  mimeType: string;
  bytesBase64: string;
  filename: string;
}

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

/**
 * Rewrite every `<img src="data:...;base64,...">` to `src="cid:<id>"` and return
 * the extracted image parts for multipart/related embedding. Non-data-URI images
 * (hosted URLs) are left untouched. Pure string transform — no DOM.
 */
export function inlineImagesToCid(html: string): { html: string; images: InlineImage[] } {
  const images: InlineImage[] = [];
  let i = 0;
  const out = html.replace(
    /(<img\b[^>]*?\bsrc=")data:([a-zA-Z0-9.+/-]+);base64,([A-Za-z0-9+/=]+)(")/g,
    (_m, pre: string, mimeType: string, payload: string, post: string) => {
      const cid = `img${i}@quote`;
      const filename = `image-${i}.${EXT[mimeType.toLowerCase()] ?? "bin"}`;
      images.push({ cid, mimeType, bytesBase64: payload, filename });
      i += 1;
      return `${pre}cid:${cid}${post}`;
    },
  );
  return { html: out, images };
}
