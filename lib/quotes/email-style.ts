// lib/quotes/email-style.ts
// Single source of truth for the email body look, shared by the editor and the
// sent HTML so edit view == preview == Gmail. Styles are emitted INLINE because
// Gmail strips <style> blocks from message bodies.

export const BODY_FONT = "Verdana, sans-serif";
export const BODY_FONT_SIZE = "13px";
export const BODY_COLOR = "#222222";
export const BODY_LINE_HEIGHT = "1.45";
export const INDENT_STEP_PX = 40; // per indent level (Gmail-like)

/** The wrapper style applied to the whole body div (for inheritance). */
export const BODY_WRAPPER_STYLE =
  `font-family:${BODY_FONT};font-size:${BODY_FONT_SIZE};color:${BODY_COLOR};line-height:${BODY_LINE_HEIGHT}`;

/** CSS injected into the editor so the edit view matches the sent email. */
export const EDITOR_CONTENT_CSS = `
.ProseMirror { font-family:${BODY_FONT}; font-size:${BODY_FONT_SIZE}; color:${BODY_COLOR}; line-height:${BODY_LINE_HEIGHT}; }
.ProseMirror p, .ProseMirror h1, .ProseMirror h2, .ProseMirror h3,
.ProseMirror h4, .ProseMirror h5, .ProseMirror h6,
.ProseMirror li, .ProseMirror blockquote { margin-top:0; margin-bottom:10px; }
`.trim();

const BLOCK_RE = /<(p|h[1-6]|li|blockquote)\b([^>]*)>/gi;

// Longhand only, so we never emit a `margin` shorthand that would clobber a
// user-set margin-left (indent). Each is added only if absent.
const DEFAULTS: Array<[string, string]> = [
  ["margin-top", "0"],
  ["margin-bottom", "10px"],
  ["line-height", BODY_LINE_HEIGHT],
];

/**
 * Inject the default block styles inline into each block element, merging into
 * any existing style attribute and never overwriting a property the element
 * already declares (so per-paragraph line-height and indent margin-left survive).
 *
 * Assumes well-formed, TipTap-serialized HTML: block tags with no literal `>`
 * inside attribute values and double-quoted `style="..."` attributes (TipTap always
 * emits both). Single-quoted style attributes or `>` inside attrs (only possible
 * from hand-authored / externally-pasted raw HTML) are not handled here.
 */
export function inlineEmailStyles(html: string): string {
  return html.replace(BLOCK_RE, (_m, tag: string, attrs: string) => {
    const styleMatch = attrs.match(/\sstyle\s*=\s*"([^"]*)"/i);
    const existing = (styleMatch ? styleMatch[1] : "").trim();
    const present = new Set(
      existing
        .split(";")
        .map((d) => d.split(":")[0].trim().toLowerCase())
        .filter(Boolean),
    );
    const additions = DEFAULTS.filter(([k]) => !present.has(k)).map(([k, v]) => `${k}:${v}`);
    if (!additions.length && styleMatch) return `<${tag}${attrs}>`;
    const merged = [existing.replace(/;\s*$/, ""), ...additions].filter(Boolean).join(";");
    const newAttrs = styleMatch
      ? attrs.replace(/\sstyle\s*=\s*"[^"]*"/i, ` style="${merged}"`)
      : `${attrs} style="${merged}"`;
    return `<${tag}${newAttrs}>`;
  });
}
