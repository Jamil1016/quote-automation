"use client";
import type { ReactNode } from "react";

/**
 * In-app confirmation modal, styled to match the webapp (replaces native
 * window.confirm, which renders the browser's own dialog).
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="bg-card rounded shadow-xl w-[min(440px,95vw)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-rule bg-paper-deep rounded-t">
          <span className="text-sm font-semibold text-ink">{title}</span>
        </div>
        <div className="px-4 py-4 text-[13px] leading-relaxed text-ink">{message}</div>
        <div className="px-4 py-3 border-t border-rule flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="text-[12px] text-muted hover:text-signal px-2 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`text-[12px] font-semibold text-white rounded px-3 py-1.5 disabled:opacity-50 ${
              destructive ? "bg-ember hover:opacity-90" : "bg-signal hover:bg-signal-deep"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
