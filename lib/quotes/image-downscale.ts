/** Target dimensions so the longest edge is at most `max`, preserving aspect; never upscales. */
export function fitDimensions(w: number, h: number, max: number): { width: number; height: number } {
  const longest = Math.max(w, h);
  if (longest <= max) return { width: w, height: h };
  const scale = max / longest;
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

const MAX_EDGE = 1200;

/**
 * Browser-only: read an image File, downscale its longest edge to MAX_EDGE via a
 * canvas, and return a base64 data-URI. PNG kept as PNG (transparency); everything
 * else re-encoded to JPEG q0.85. Used by the composer's upload/paste/drop paths.
 */
export async function downscaleImageFile(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("could not read image file"));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("could not load image"));
    el.src = dataUrl;
  });
  const { width, height } = fitDimensions(img.naturalWidth, img.naturalHeight, MAX_EDGE);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl; // canvas unavailable — fall back to the original
  ctx.drawImage(img, 0, 0, width, height);
  const isPng = file.type === "image/png";
  return canvas.toDataURL(isPng ? "image/png" : "image/jpeg", isPng ? undefined : 0.85);
}
