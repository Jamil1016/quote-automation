// components/quotes/EmailComposer.tsx
"use client";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ResizableImage } from "./extensions/ResizableImage";
import { TokenNode } from "./extensions/TokenNode";
import { Indent } from "./extensions/Indent";
import { LineHeight } from "./extensions/LineHeight";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle, FontSize } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import { downscaleImageFile } from "@/lib/quotes/image-downscale";
import { tokenizeHtml, serializeHtml } from "@/lib/quotes/token-html";
import { EDITOR_CONTENT_CSS } from "@/lib/quotes/email-style";

/**
 * Rich-text body editor for quote emails (TipTap). Emits HTML via onChange.
 * {{token}} insertion is handled externally via the EmailComposerHandle ref.
 * Tokens are substituted per-entry at draft-build time. Paste from Gmail works
 * (TipTap sanitizes to its schema), so the legacy email can be pasted in directly.
 *
 * StarterKit v3 bundles Underline + Link; no separate extension imports needed.
 * Link is configured with openOnClick: false to prevent the editor navigating away.
 */

export interface EmailComposerHandle {
  insertToken: (token: string) => void;
}

export const EmailComposer = forwardRef<EmailComposerHandle, {
  value: string;
  onChange: (html: string) => void;
  onFocusBody?: () => void;
  fill?: boolean;
}>(function EmailComposer({ value, onChange, onFocusBody, fill = false }, ref) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // editorRef lets insertImageFile (defined after useEditor) be called from stable
  // handlePaste/handleDrop closures captured at useEditor initialisation time.
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);

  const editorClass = fill
    ? "min-h-full px-3 py-2 text-[13px] focus:outline-none"
    : "min-h-[180px] max-h-[320px] overflow-y-auto px-3 py-2 text-[13px] focus:outline-none";

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      ResizableImage, TokenNode, Indent, LineHeight,
      TextAlign.configure({ types: ["paragraph", "heading"] }),
      TextStyle, Color, FontFamily, FontSize,
    ],
    content: tokenizeHtml(value),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: editorClass,
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) =>
          f.type.startsWith("image/"),
        );
        if (!files.length) return false;
        event.preventDefault();
        files.forEach((f) => void insertImageFile(f));
        return true;
      },
      handleDrop: (_view, event) => {
        const dt = (event as DragEvent).dataTransfer;
        const files = Array.from(dt?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (files.length) {
          event.preventDefault();
          files.forEach((f) => void insertImageFile(f));
          return true;
        }
        // A dragged field chip drops as `{{token}}` text — insert it as a pill node.
        const m = (dt?.getData("text/plain") ?? "").match(/^\{\{(\w+)\}\}$/);
        if (m) {
          event.preventDefault();
          editorRef.current?.chain().focus().insertContent({ type: "token", attrs: { name: m[1] } }).run();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => onChange(serializeHtml(editor.getHTML())),
    onFocus: () => onFocusBody?.(),
  });

  // Keep editorRef in sync so insertImageFile can always reach the editor instance.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (editorRef as any).current = editor;

  async function insertImageFile(file: File) {
    try {
      const dataUrl = await downscaleImageFile(file);
      editorRef.current?.chain().focus().setImage({ src: dataUrl }).run();
    } catch {
      // ignore unreadable / oversized images
    }
  }

  useImperativeHandle(ref, () => ({
    insertToken: (token: string) => {
      editor?.chain().focus().insertContent({ type: "token", attrs: { name: token } }).run();
    },
  }), [editor]);

  // Load a different template into the editor when the parent swaps `value`. Compare in
  // the canonical {{token}} form so token pills don't trigger a redundant reset+caret jump.
  useEffect(() => {
    if (editor && value !== serializeHtml(editor.getHTML())) editor.commands.setContent(tokenizeHtml(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return fill
    ? <div className="h-full rounded border border-rule bg-white" />
    : <div className="min-h-[180px] rounded border border-rule bg-white" />;

  const btn = (active: boolean) =>
    `px-1.5 py-0.5 rounded text-[12px] border ${active ? "bg-signal text-white border-signal" : "bg-input border-rule hover:border-signal"}`;

  const selectCls = "rounded border border-rule bg-input px-1 py-0.5 text-[12px]";
  const toolbarItems: { key: string; node: ReactNode }[] = [
    { key: "bold", node: <button type="button" className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></button> },
    { key: "italic", node: <button type="button" className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></button> },
    { key: "underline", node: <button type="button" className={btn(editor.isActive("underline"))} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></button> },
    { key: "bullet", node: <button type="button" className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}>• list</button> },
    { key: "outdent", node: <button type="button" className={btn(false)} title="Outdent" onClick={() => editor.chain().focus().outdent().run()}>⇤</button> },
    { key: "indent", node: <button type="button" className={btn(false)} title="Indent" onClick={() => editor.chain().focus().indent().run()}>⇥</button> },
    { key: "spacing", node: (
      <select title="Line spacing" className={selectCls} value=""
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") return;
          if (v === "default") editor.chain().focus().unsetLineHeight().run();
          else editor.chain().focus().setLineHeight(v).run();
          e.target.value = "";
        }}>
        <option value="">↕ spacing</option>
        <option value="default">Default</option>
        <option value="0">0</option>
        <option value="0.25">0.25</option>
        <option value="0.5">0.5</option>
        <option value="1">1</option>
        <option value="1.15">1.15</option>
        <option value="1.5">1.5</option>
        <option value="2">2</option>
      </select>
    ) },
    { key: "ordered", node: <button type="button" className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. list</button> },
    { key: "strike", node: <button type="button" className={btn(editor.isActive("strike"))} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></button> },
    { key: "align-left", node: <button type="button" className={btn(editor.isActive({ textAlign: "left" }))} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Align left">⬅</button> },
    { key: "align-center", node: <button type="button" className={btn(editor.isActive({ textAlign: "center" }))} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Align center">⬌</button> },
    { key: "align-right", node: <button type="button" className={btn(editor.isActive({ textAlign: "right" }))} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Align right">➡</button> },
    { key: "font", node: (
      <select title="Font" className={selectCls} value=""
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") return;
          if (v === "default") editor.chain().focus().unsetFontFamily().run();
          else editor.chain().focus().setFontFamily(v).run();
          e.target.value = "";
        }}>
        <option value="">Font</option>
        <option value="default">Default (Verdana)</option>
        <option value="Arial, sans-serif">Arial</option>
        <option value="Tahoma, sans-serif">Tahoma</option>
        <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
        <option value="Georgia, serif">Georgia</option>
        <option value="'Times New Roman', serif">Times New Roman</option>
        <option value="'Courier New', monospace">Courier New</option>
      </select>
    ) },
    { key: "size", node: (
      <select title="Font size" className={selectCls} value=""
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") return;
          if (v === "default") editor.chain().focus().unsetFontSize().run();
          else editor.chain().focus().setFontSize(v).run();
          e.target.value = "";
        }}>
        <option value="">Size</option>
        <option value="default">Default (13)</option>
        {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72].map((s) => (
          <option key={s} value={`${s}px`}>{s}</option>
        ))}
      </select>
    ) },
    { key: "color", node: (
      <input type="color" title="Text color" className="h-6 w-6 cursor-pointer rounded border border-rule bg-input"
        onChange={(e) => editor.chain().focus().setColor(e.target.value).run()} />
    ) },
    { key: "clear", node: <button type="button" className={btn(false)} title="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>⌫fmt</button> },
    { key: "link", node: (
      <button type="button" className={btn(editor.isActive("link"))}
        onClick={() => {
          const href = window.prompt("Link URL", editor.getAttributes("link").href ?? "https://");
          if (href === null) return;
          if (href === "") editor.chain().focus().unsetLink().run();
          else editor.chain().focus().setLink({ href }).run();
        }}>link</button>
    ) },
    { key: "image", node: <button type="button" className={btn(false)} title="Insert image" onClick={() => fileInputRef.current?.click()}>🖼</button> },
  ];

  return (
    <div className={fill ? "flex h-full flex-col rounded border border-rule bg-white" : "rounded border border-rule bg-white"}>
      <style>{EDITOR_CONTENT_CSS}</style>
      <OverflowToolbar items={toolbarItems} />
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void insertImageFile(f); e.target.value = ""; }} />
      {fill
        ? <div className="min-h-0 flex-1 overflow-y-auto"><EditorContent editor={editor} /></div>
        : <EditorContent editor={editor} />}
    </div>
  );
});

/**
 * A single-row toolbar that measures its items and tucks whatever does not fit
 * the current width behind a single "⋯" button. Clicking it opens a popover with
 * the overflowed controls, so nothing gets compressed out of reach on narrow panels.
 */
function OverflowToolbar({ items }: { items: { key: string; node: ReactNode }[] }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const widthsRef = useRef<number[]>([]);
  const [visibleCount, setVisibleCount] = useState(items.length);
  const [open, setOpen] = useState(false);

  const GAP = 4;        // matches gap-1
  const PADDING_X = 16; // px-2 both sides
  const MORE_W = 36;    // approx width of the ⋯ button

  const recompute = useCallback(() => {
    const row = rowRef.current;
    const widths = widthsRef.current;
    if (!row || widths.length !== items.length) return;
    const avail = row.clientWidth - PADDING_X;
    const total = widths.reduce((a, b) => a + b, 0) + GAP * (items.length - 1);
    if (total <= avail) { setVisibleCount(items.length); return; }
    let used = 0;
    let count = 0;
    for (let i = 0; i < items.length; i++) {
      const add = widths[i] + (count > 0 ? GAP : 0);
      if (used + add + GAP + MORE_W <= avail) { used += add; count++; } else break;
    }
    setVisibleCount(Math.max(1, count));
  }, [items.length]);

  // Measure natural widths once, while every item is rendered in the row.
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    if (widthsRef.current.length !== items.length) {
      const kids = Array.from(row.querySelectorAll<HTMLElement>("[data-tb-item]"));
      if (kids.length === items.length) widthsRef.current = kids.map((k) => k.offsetWidth);
    }
    recompute();
  }, [items.length, recompute]);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const ro = new ResizeObserver(() => recompute());
    ro.observe(row);
    return () => ro.disconnect();
  }, [recompute]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const visible = items.slice(0, visibleCount);
  const overflow = items.slice(visibleCount);

  return (
    <div ref={rowRef} className="flex shrink-0 items-center gap-1 border-b border-rule px-2 py-1">
      {visible.map((it) => (
        <span key={it.key} data-tb-item className="inline-flex items-center">{it.node}</span>
      ))}
      {overflow.length > 0 && (
        <div ref={menuRef} className="relative inline-flex">
          <button type="button" title="More" aria-label="More formatting" onClick={() => setOpen((o) => !o)}
            className="px-1.5 py-0.5 rounded text-[12px] border bg-input border-rule hover:border-signal">⋯</button>
          {open && (
            <div className="absolute right-0 top-full z-20 mt-1 flex max-w-[280px] flex-wrap items-center gap-1 rounded border border-rule bg-white p-2 shadow-lg">
              {overflow.map((it) => (
                <span key={it.key} className="inline-flex items-center">{it.node}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
