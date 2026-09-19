// components/quotes/extensions/ResizableImage.ts
import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ResizableImageView } from "./ResizableImageView";

/** @tiptap/extension-image + a persisted pixel `width` attribute (rendered as inline
 *  style so it survives into the saved template HTML and the sent email) + a React
 *  NodeView providing a corner drag-resize handle. allowBase64 so data-URIs render. */
export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => {
          const styleW = (el as HTMLElement).style?.width;
          const attrW = (el as HTMLElement).getAttribute("width");
          const v = styleW || attrW;
          const n = v ? parseInt(v, 10) : NaN;
          return Number.isFinite(n) ? n : null;
        },
        renderHTML: (attrs) => (attrs.width ? { style: `width:${attrs.width}px;max-width:100%;height:auto` } : {}),
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
}).configure({ inline: false, allowBase64: true });
