"use client";
import { useState } from "react";
import type { QuoteRow } from "@/lib/quotes/types";
import { buildQuote } from "@/lib/quotes/quote-model";
import { QuoteDocument } from "./QuoteDocument";

export function QuotePreview({ row }: { row: QuoteRow }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const quote = buildQuote(row);

  async function downloadPdf() {
    setBusy(true);
    try {
      const res = await fetch(`/api/quote-pdf?task_did=${encodeURIComponent(row.task_did)}`);
      if (!res.ok) throw new Error((await res.text()) || res.statusText);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${row.asset_name} - Example Co Quote.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("PDF download failed: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-[11px] font-semibold text-white bg-signal rounded px-2 py-1 hover:bg-signal-deep"
      >
        Preview quote
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded shadow-xl my-6 flex flex-col max-h-[90vh] w-[min(720px,95vw)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-3 py-2 border-b border-rule bg-paper-deep shrink-0 rounded-t">
              <span className="text-sm font-semibold text-ink">Quotation preview — {row.asset_name}</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={downloadPdf}
                  disabled={busy}
                  className="text-[11px] font-semibold text-white bg-signal rounded px-2 py-1 hover:bg-signal-deep disabled:opacity-50"
                >
                  {busy ? "Generating…" : "Download PDF"}
                </button>
                <button onClick={() => setOpen(false)} className="text-[12px] text-muted hover:text-signal">Close</button>
              </div>
            </div>
            <div className="overflow-auto p-3 bg-paper-deep/40 flex justify-center">
              {/* zoom shrinks the layout box (not just the paint) so the scroll area
                  matches the visible size and the header is never overlapped;
                  flex+justify-center keeps the fixed-width sheet horizontally centered. */}
              <div style={{ zoom: 0.8 }} className="shrink-0">
                <QuoteDocument quote={quote} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
