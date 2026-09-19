// components/quotes/extensions/Indent.ts
import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { INDENT_STEP_PX } from "@/lib/quotes/email-style";

const MAX_LEVEL = 8;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType;
      outdent: () => ReturnType;
    };
  }
}

export const Indent = Extension.create({
  name: "indent",

  addOptions() {
    return { types: ["paragraph", "heading"] as string[] };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => {
              const ml = parseInt((el as HTMLElement).style.marginLeft || "0", 10);
              return ml ? Math.min(MAX_LEVEL, Math.round(ml / INDENT_STEP_PX)) : 0;
            },
            renderHTML: (attrs) =>
              attrs.indent ? { style: `margin-left:${attrs.indent * INDENT_STEP_PX}px` } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    const shift =
      (delta: number) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ tr, state, dispatch }: any) => {
        const { from, to } = state.selection;
        let changed = false;
        state.doc.nodesBetween(from, to, (node: PMNode, pos: number) => {
          if (this.options.types.includes(node.type.name)) {
            const cur = node.attrs.indent || 0;
            const next = Math.min(MAX_LEVEL, Math.max(0, cur + delta));
            if (next !== cur) {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
              changed = true;
            }
          }
        });
        if (changed && dispatch) dispatch(tr);
        return changed;
      };
    return { indent: () => shift(1), outdent: () => shift(-1) };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (this.editor.isActive("listItem")) return this.editor.commands.sinkListItem("listItem");
        this.editor.commands.indent();
        return true; // always consume Tab so focus never leaves the editor (even at max indent)
      },
      "Shift-Tab": () => {
        if (this.editor.isActive("listItem")) return this.editor.commands.liftListItem("listItem");
        this.editor.commands.outdent();
        return true; // always consume Shift-Tab so focus never leaves the editor (even at level 0)
      },
    };
  },
});
