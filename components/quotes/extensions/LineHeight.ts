// components/quotes/extensions/LineHeight.ts
import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    lineHeight: {
      setLineHeight: (value: string) => ReturnType;
      unsetLineHeight: () => ReturnType;
    };
  }
}

export const LineHeight = Extension.create({
  name: "lineHeight",

  addOptions() {
    return { types: ["paragraph", "heading"] as string[] };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).style.lineHeight || null,
            renderHTML: (attrs) =>
              attrs.lineHeight ? { style: `line-height:${attrs.lineHeight}` } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineHeight:
        (value: string) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ tr, state, dispatch }: any) => {
          const { from, to } = state.selection;
          let changed = false;
          state.doc.nodesBetween(from, to, (node: PMNode, pos: number) => {
            if (this.options.types.includes(node.type.name)) {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, lineHeight: value });
              changed = true;
            }
          });
          if (changed && dispatch) dispatch(tr);
          return changed;
        },
      unsetLineHeight:
        () =>
        ({ commands }) =>
          this.options.types.every((t: string) => commands.resetAttributes(t, "lineHeight")),
    };
  },
});
