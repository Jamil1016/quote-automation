"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FolderUp, Loader2, XCircle } from "lucide-react";
import type { QuoteRow } from "@/lib/quotes/types";
import { PROBLEM_LABELS, quoteProblem, type BulkEvent, type ProblemReason } from "@/lib/quotes/bulk";

interface Props {
  rows: QuoteRow[];                 // the currently-selected rows
  onClose: () => void;
  onDeselect: (dids: string[]) => void; // remove given dids from the selection
  onGenerated?: (generatedDids: string[]) => void; // fired after a run finishes (refresh the queue)
}

type RowState = { asset: string; status: "pending" | "ok" | "fail"; link?: string; updated?: boolean; error?: string };

export function BulkGenerateModal({ rows, onClose, onDeselect, onGenerated }: Props) {
  const [phase, setPhase] = useState<"review" | "running" | "done">("review");
  const [progress, setProgress] = useState<Record<string, RowState>>({});
  const [counts, setCounts] = useState({ uploaded: 0, failed: 0, total: 0 });

  // Group problem rows by reason (no_price / no_match / needs_review).
  const problems = useMemo(() => {
    const groups: Record<ProblemReason, QuoteRow[]> = { no_match: [], no_price: [], no_service: [], needs_review: [], no_recipient: [], not_found: [] };
    for (const r of rows) {
      const reason = quoteProblem(r);
      if (reason) groups[reason].push(r);
    }
    return groups;
  }, [rows]);
  const problemRows = useMemo(() => rows.filter((r) => quoteProblem(r)), [rows]);
  const readyRows = useMemo(() => rows.filter((r) => !quoteProblem(r)), [rows]);
  const blocked = problemRows.length > 0;
  // the distinct problem reasons actually present, in display order
  const presentReasons = (["no_match", "no_price", "needs_review", "no_recipient", "not_found"] as ProblemReason[])
    .filter((r) => problems[r].length > 0);

  async function run() {
    setPhase("running");
    setCounts({ uploaded: 0, failed: 0, total: readyRows.length });
    setProgress(Object.fromEntries(readyRows.map((r) => [r.asset_name, { asset: r.asset_name, status: "pending" } as RowState])));

    // Build a name→task_did map so we can report generated task_dids to the caller.
    const nameToTaskDid = new Map(readyRows.map((r) => [r.asset_name, r.task_did]));
    const succeededDids: string[] = [];

    try {
      const res = await fetch("/api/quote-pdf/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_dids: readyRows.map((r) => r.task_did) }),
      });
      if (res.status === 422) {
        // server backstop tripped — list the specific problems it returned
        const body = await res.json().catch(() => null);
        const list = (body?.problems ?? [])
          .map((p: { asset: string; reason: ProblemReason }) => `• ${p.asset} — ${PROBLEM_LABELS[p.reason] ?? p.reason}`)
          .join("\n");
        alert(`These can't be generated yet:\n\n${list || "(unknown problem)"}\n\nRemove them and try again.`);
        setPhase("review");
        return;
      }
      if (!res.ok || !res.body) throw new Error((await res.text()) || res.statusText);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
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
            setProgress((p) => ({
              ...p,
              [evt.asset]: { asset: evt.asset, status: evt.ok ? "ok" : "fail", link: evt.link, updated: evt.updated, error: evt.error },
            }));
            setCounts((c) => (evt.ok ? { ...c, uploaded: c.uploaded + 1 } : { ...c, failed: c.failed + 1 }));
            if (evt.ok) {
              const did = nameToTaskDid.get(evt.asset);
              if (did) succeededDids.push(did);
            }
          } else if (evt.type === "done") {
            setCounts((c) => ({ ...c, uploaded: evt.uploaded, failed: evt.failed }));
          }
        }
      }
      setPhase("done");
      onGenerated?.(succeededDids); // refetch so the queue shows the new generated badges
    } catch (e) {
      alert("Bulk generation failed: " + (e as Error).message);
      setPhase("review");
    }
  }

  const progressList = Object.values(progress);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4" onClick={phase === "running" ? undefined : onClose}>
      <div className="bg-card rounded shadow-xl my-6 flex flex-col max-h-[90vh] w-[min(640px,95vw)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center px-4 py-2.5 border-b border-rule bg-paper-deep shrink-0 rounded-t">
          <span className="text-sm font-semibold text-ink flex items-center gap-2">
            <FolderUp size={15} /> Generate &amp; upload quotes to Drive
          </span>
          {phase !== "running" && (
            <button onClick={onClose} className="text-[12px] text-muted hover:text-signal">Close</button>
          )}
        </div>

        <div className="overflow-auto p-4 flex flex-col gap-3">
          {/* ---- REVIEW: problem gate ---- */}
          {phase === "review" && rows.length === 0 && (
            <div className="text-sm text-muted py-4 text-center">
              Nothing selected. <button onClick={onClose} className="text-signal hover:underline">Close</button>
            </div>
          )}
          {phase === "review" && rows.length > 0 && (
            <>
              {blocked ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-2 text-sm text-ember bg-ember-wash border border-ember/30 rounded p-3">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold">{problemRows.length} of {rows.length} selected can&apos;t be generated yet.</div>
                      <div className="text-[12px] text-ink/80 mt-0.5">
                        {presentReasons.map((r) => `${PROBLEM_LABELS[r]} (${problems[r].length})`).join(" · ")}.
                        Fix the problem on each, or remove them from the selection. Nothing is generated until the
                        selection is clean, and nothing is ever emailed.
                      </div>
                    </div>
                  </div>

                  {presentReasons.map((reason) => (
                    <div key={reason} className="border border-rule rounded">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted px-3 py-1.5 border-b border-rule bg-paper-deep">
                        {PROBLEM_LABELS[reason]} · {problems[reason].length}
                      </div>
                      <ul className="max-h-40 overflow-auto divide-y divide-rule/60">
                        {problems[reason].map((r) => (
                          <li key={r.task_did} className="px-3 py-1.5 text-[13px] flex items-center justify-between gap-2">
                            <span className="font-medium">{r.asset_name}</span>
                            <span className="text-[11px] text-muted">{r.carrier ?? "—"} · {r.gc ?? "—"}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[12px] text-muted">{readyRows.length} ready to generate after removing problems.</span>
                    <button
                      onClick={() => onDeselect(problemRows.map((r) => r.task_did))}
                      className="text-[12px] font-semibold text-white bg-signal rounded px-3 py-1.5 hover:bg-signal-deep"
                    >
                      Remove {problemRows.length} problem{problemRows.length === 1 ? "" : "s"} from selection
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="text-sm text-ink">
                    <span className="font-semibold">{readyRows.length}</span> quote{readyRows.length === 1 ? "" : "s"} will be generated
                    (one PDF per asset) and uploaded to the
                    <span className="font-semibold"> Example Co Quote Automation</span> Drive folder.
                    Existing files of the same name are overwritten. <span className="text-muted">No email is sent.</span>
                  </div>
                  <div className="border border-rule rounded max-h-56 overflow-auto divide-y divide-rule/60">
                    {readyRows.map((r) => (
                      <div key={r.task_did} className="px-3 py-1.5 text-[13px] flex items-center justify-between gap-2">
                        <span className="font-medium">{r.asset_name}</span>
                        <span className="text-[11px] text-muted">{r.carrier ?? "—"} · {r.gc ?? "—"}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button onClick={onClose} className="text-[12px] text-muted hover:text-signal px-2">Cancel</button>
                    <button
                      onClick={run}
                      className="text-[12px] font-semibold text-white bg-signal rounded px-3 py-1.5 hover:bg-signal-deep inline-flex items-center gap-1.5"
                    >
                      <FolderUp size={13} /> Generate {readyRows.length} &amp; upload
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ---- RUNNING / DONE: progress ---- */}
          {phase !== "review" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold inline-flex items-center gap-2">
                  {phase === "running" ? <Loader2 size={15} className="animate-spin text-signal" /> : <CheckCircle2 size={15} className="text-moss" />}
                  {phase === "running" ? "Generating & uploading…" : "Done"}
                </span>
                <span className="text-[12px] text-muted">
                  {counts.uploaded}/{counts.total} uploaded{counts.failed ? ` · ${counts.failed} failed` : ""}
                </span>
              </div>
              <div className="border border-rule rounded max-h-72 overflow-auto divide-y divide-rule/60">
                {progressList.map((p) => (
                  <div key={p.asset} className="px-3 py-1.5 text-[13px] flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{p.asset}</span>
                    {p.status === "pending" && <Loader2 size={13} className="animate-spin text-muted shrink-0" />}
                    {p.status === "ok" && (
                      <span className="inline-flex items-center gap-1.5 text-moss text-[11px] shrink-0">
                        {p.updated ? "updated" : "uploaded"}
                        {p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-signal hover:underline">open</a>}
                        <CheckCircle2 size={13} />
                      </span>
                    )}
                    {p.status === "fail" && (
                      <span className="inline-flex items-center gap-1 text-ember text-[11px] shrink-0" title={p.error}>
                        failed <XCircle size={13} />
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {phase === "done" && (
                <div className="flex justify-end">
                  <button onClick={onClose} className="text-[12px] font-semibold text-white bg-signal rounded px-3 py-1.5 hover:bg-signal-deep">Close</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
