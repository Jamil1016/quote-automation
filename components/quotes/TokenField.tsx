// components/quotes/TokenField.tsx
"use client";
import { forwardRef, useEffect, useImperativeHandle } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TokenNode } from "./extensions/TokenNode";
import { tokenizeText, serializeToText } from "@/lib/quotes/token-html";

/**
 * Single-line rich field for the email subject. Behaves like a text input but renders
 * available `{{field}}` tokens as pills (TokenNode). Value in/out is canonical plain
 * text with literal `{{token}}` — pills are an editor-only presentation. Enter is
 * blocked (single line); click/drag a field chip to insert a pill.
 */
export interface TokenFieldHandle {
  insertToken: (token: string) => void;
}

export const TokenField = forwardRef<TokenFieldHandle, {
  value: string;
  onChange: (v: string) => void;
  onFocus?: () => void;
  className?: string;
}>(function TokenField({ value, onChange, onFocus, className }, ref) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, bulletList: false, orderedList: false, listItem: false,
        blockquote: false, codeBlock: false, horizontalRule: false, code: false,
      }),
      TokenNode,
    ],
    content: tokenizeText(value),
    immediatelyRender: false,
    editorProps: {
      attributes: { class: className ?? "", style: "font-family:Verdana,sans-serif;white-space:nowrap" },
      handleKeyDown: (_view, event) => {
        if (event.key === "Enter") { event.preventDefault(); return true; }
        return false;
      },
      handleDrop: (_view, event) => {
        const text = (event as DragEvent).dataTransfer?.getData("text/plain") ?? "";
        const m = text.match(/^\{\{(\w+)\}\}$/);
        if (!m) return false;
        event.preventDefault();
        editor?.chain().focus().insertContent({ type: "token", attrs: { name: m[1] } }).run();
        return true;
      },
    },
    onUpdate: ({ editor }) => onChange(serializeToText(editor.getHTML())),
    onFocus: () => onFocus?.(),
  });

  useImperativeHandle(ref, () => ({
    insertToken: (token: string) =>
      editor?.chain().focus().insertContent({ type: "token", attrs: { name: token } }).run(),
  }), [editor]);

  // Reload external value (e.g. switching templates) without clobbering live edits.
  useEffect(() => {
    if (editor && value !== serializeToText(editor.getHTML())) editor.commands.setContent(tokenizeText(value));
     
  }, [value, editor]);

  return <EditorContent editor={editor} />;
});
