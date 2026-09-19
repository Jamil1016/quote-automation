"use client";
import { useState } from "react";
import { FolderUp, Loader2 } from "lucide-react";
import type { BulkEvent, ProblemReason } from "@/lib/quotes/bulk";
import { PROBLEM_LABELS } from "@/lib/quotes/bulk";

/**
 * Header action for the Queue detail panel: render this one quote's PDF and
 * upload it to the generated-quotes Drive folder, then let the parent refresh.
 *
 * It reuses the bulk endpoint with a single task_did, so it inherits the same
 * auth, server-side problem gate, Drive upload, and `generated`
 * record. No email is ever sent. The caller decides what to show only this
 * button when the row is good to go (see `canGenerateToDrive`).
 */
export function GenerateToDriveButton({ taskDid, onGenerated }: { taskDid: string; onGenerated?: (taskDid: string) => void }) {
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch("/api/quote-pdf/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_dids: [taskDid] }),
      });
      if (res.status === 422) {
        const body = await res.json().catch(() => null);
        const list = (body?.problems ?? [])
          .map((p: { asset: string; reason: ProblemReason }) => `• ${p.asset} — ${PROBLEM_LABELS[p.reason] ?? p.reason}`)
          .join("\n");
        alert(`This quote can't be generated yet:\n\n${list || "(unknown problem)"}`);
        return;
      }
      if (!res.ok || !res.body) throw new Error((await res.text()) || res.statusText);

      // Read the NDJSON stream to completion; capture any per-row error.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let rowError: string | null = null;
      let uploaded = 0;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const evt = JSON.parse(line) as BulkEvent;
          if (evt.type === "progress") {
            if (evt.ok) uploaded++;
            else rowError = evt.error ?? "generation failed";
          } else if (evt.type === "done") {
            uploaded = evt.uploaded;
          }
        }
      }
      if (uploaded < 1) throw new Error(rowError ?? "Nothing was uploaded.");
      onGenerated?.(taskDid); // refresh → the now-generated row leaves the queue, panel closes
    } catch (e) {
      alert("Generate & upload failed: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={generate}
      disabled={busy}
      title="Generate this quote PDF and upload it to the Drive folder (no email is sent)"
      className="inline-flex items-center gap-1 rounded bg-signal px-2 py-1 text-[11px] font-semibold text-white hover:bg-signal-deep disabled:opacity-50"
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : <FolderUp size={12} />}
      {busy ? "Generating…" : "Generate to Drive"}
    </button>
  );
}
