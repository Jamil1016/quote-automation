// components/quotes/extensions/TokenNode.ts
import { Node, mergeAttributes, InputRule } from "@tiptap/core";
import { TOKEN_LABELS } from "@/lib/quotes/token-html";

/**
 * Inline atom node for an available `{{field}}` token. In the editor it renders as a
 * gold pill showing the field's human label (no braces); in getHTML() it serializes to
 * `<span data-token="name">Label</span>`, which token-html's serializeHtml collapses
 * back to the canonical `{{name}}` for storage and sending. Typing `{{name}}` for a
 * known field auto-converts to a pill via an input rule.
 */
export const TokenNode = Node.create({
  name: "token",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      name: {
        default: "",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-token") || "",
        renderHTML: (attrs) => ({ "data-token": attrs.name }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-token]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const name = node.attrs.name as string;
    const label = TOKEN_LABELS.get(name) ?? `{{${name}}}`;
    return ["span", mergeAttributes(HTMLAttributes, { class: "token-chip" }), label];
  },

  renderText({ node }) {
    return `{{${node.attrs.name}}}`;
  },

  addInputRules() {
    return [
      new InputRule({
        find: /\{\{(\w+)\}\}$/,
        handler: ({ range, match, chain }) => {
          const name = match[1];
          if (!TOKEN_LABELS.has(name)) return;
          chain().deleteRange(range).insertContent({ type: this.name, attrs: { name } }).run();
        },
      }),
    ];
  },
});
