// components/quotes/extensions/ResizableImageView.tsx
"use client";
import { useRef } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

/** Renders the image with a bottom-right drag handle (shown when selected) that
 *  writes a pixel `width` onto the node, persisted as inline style into the HTML. */
export function ResizableImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = imgRef.current?.offsetWidth ?? 0;
    const onMove = (me: MouseEvent) => {
      const w = Math.max(40, Math.round(startW + (me.clientX - startX)));
      updateAttributes({ width: w });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const width = node.attrs.width as number | null;
  return (
    <NodeViewWrapper className="relative inline-block" style={{ lineHeight: 0 }} data-drag-handle>
      <img
        ref={imgRef}
        src={node.attrs.src}
        alt={node.attrs.alt ?? ""}
        style={{ width: width ? `${width}px` : "auto", maxWidth: "100%", height: "auto" }}
        className={selected ? "outline outline-2 outline-signal" : ""}
      />
      {selected && (
        <span
          onMouseDown={startResize}
          className="absolute bottom-0 right-0 h-3 w-3 -translate-x-px -translate-y-px cursor-nwse-resize rounded-sm border border-white bg-signal"
          title="Drag to resize"
        />
      )}
    </NodeViewWrapper>
  );
}
