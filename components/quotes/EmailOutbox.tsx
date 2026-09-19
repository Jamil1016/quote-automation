"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Ban, CheckCircle2, Clock, RotateCw, Search, X } from "lucide-react";
import type { EmailQueueRow } from "@/lib/quotes/types";
import { cancelScheduledEmail, returnFromOutbox, returnManyFromOutbox } from "@/lib/quotes/email-actions";
import { formatRefreshedET } from "@/lib/quotes/format";
import { isBatchSelectable, isReschedulable, returnableIds, reschedulableTaskDids, matchesOutboxSearch } from "@/lib/quotes/outbox";
import { ConfirmDialog } from "./ConfirmDialog";

type Status = "scheduled" | "sent" | "failed" | "cancelled";

// Friendly labels + visual treatment. "Waiting" reads better than the raw "scheduled"
// status for the thing the user cares about: has it gone out yet or not.
const META: Record<Status, { label: string; badge: string; bar: string; Icon: typeof Clock }> = {
  scheduled: { label: "Waiting", badge: "bg-gold-wash text-amber", bar: "var(--gold)", Icon: Clock },
  sent: { label: "Sent", badge: "bg-moss-wash text-moss", bar: "var(--moss)", Icon: CheckCircle2 },
  failed: { label: "Failed", badge: "bg-ember-wash text-ember", bar: "var(--ember)", Icon: AlertTriangle },
  cancelled: { label: "Cancelled", badge: "bg-paper-deep text-muted", bar: "var(--rule-strong)", Icon: Ban },
};
// Waiting floats to the top (still actionable), then failed, then the done pile.
const ORDER: Record<Status, number> = { scheduled: 0, failed: 1, sent: 2, cancelled: 3 };

/** Team-wide send record: every queued email with status, cancel, and bulk re-schedule. */
export function EmailOutbox({ queue, assetNames, currentUser, onReschedule }: {
  queue: EmailQueueRow[];
  assetNames: Map<string, string>;
  currentUser: string;
  onReschedule: (taskDids: string[]) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState<Status | "all" | "returned">("all");
  const [query, setQuery] = useState("");
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const toggleSel = (did: string) =>
    setSel((s) => { const n = new Set(s); if (n.has(did)) n.delete(did); else n.add(did); return n; });

  // Sent rows confirm via the in-app ConfirmDialog (not the browser's window.confirm).
  const [pendingReturn, setPendingReturn] = useState<{ id: number; target: "queue" | "generated" } | null>(null);
  const doReturn = (id: number, target: "queue" | "generated") =>
    start(async () => { await returnFromOutbox(id, target); router.refresh(); });
  const requestReturn = (q: EmailQueueRow, target: "queue" | "generated") => {
    if (q.status === "sent") setPendingReturn({ id: q.id, target });
    else doReturn(q.id, target);
  };

  const isReturned = (q: EmailQueueRow) => !!q.returned_at;

  const counts = useMemo(() => {
    const c: Record<string, number> = { scheduled: 0, sent: 0, failed: 0, cancelled: 0, returned: 0 };
    for (const q of queue) {
      if (q.returned_at) c.returned += 1;
      else c[q.status] = (c[q.status] ?? 0) + 1;
    }
    return c;
  }, [queue]);

  const sorted = useMemo(() => {
    const byStatus = filter === "returned"
      ? queue.filter((q) => q.returned_at)
      : (filter === "all" ? queue : queue.filter((q) => q.status === filter)).filter((q) => !q.returned_at);
    const list = byStatus.filter((q) => matchesOutboxSearch(q, assetNames.get(q.task_did), query));
    return [...list].sort((a, b) => {
      const o = (ORDER[a.status as Status] ?? 9) - (ORDER[b.status as Status] ?? 9);
      if (o) return o;
      // within waiting: soonest first; otherwise most-recent activity first
      const ta = new Date(a.sent_at ?? a.scheduled_at).getTime();
      const tb = new Date(b.sent_at ?? b.scheduled_at).getTime();
      return a.status === "scheduled" ? ta - tb : tb - ta;
    });
  }, [queue, filter, query, assetNames]);

  // Batch-eligible rows in the order they're shown, for shift-click range selection.
  const selectableVisible = useMemo(() => sorted.filter(isBatchSelectable), [sorted]);
  const lastIdx = useRef<number | null>(null);
  // Shift-click extends the selection from the last-clicked row to this one; a plain
  // click (or ctrl/cmd-click) toggles just this row. Index is within the visible list.
  const onCheckClick = (q: EmailQueueRow, e: React.MouseEvent<HTMLInputElement>) => {
    const i = selectableVisible.findIndex((r) => r.id === q.id);
    if (e.shiftKey && lastIdx.current !== null && i !== -1) {
      const [a, b] = lastIdx.current < i ? [lastIdx.current, i] : [i, lastIdx.current];
      const range = selectableVisible.slice(a, b + 1).map((r) => r.task_did);
      setSel((s) => { const n = new Set(s); range.forEach((d) => n.add(d)); return n; });
    } else {
      toggleSel(q.task_did);
    }
    lastIdx.current = i;
  };

  if (!queue.length) {
    return <div className="p-6 text-sm text-muted">Nothing scheduled yet. Select generated quotes and pick &quot;Schedule email&quot;.</div>;
  }

  const chips: { key: Status | "all" | "returned"; label: string; n: number }[] = [
    // "All" excludes returned rows (they live only under the Returned filter), so
    // the count matches the rows the "all" list actually renders.
    { key: "all", label: "All", n: queue.filter((q) => !q.returned_at).length },
    { key: "scheduled", label: "Waiting", n: counts.scheduled },
    { key: "sent", label: "Sent", n: counts.sent },
    { key: "failed", label: "Failed", n: counts.failed },
    { key: "cancelled", label: "Cancelled", n: counts.cancelled },
    { key: "returned", label: "Returned", n: counts.returned },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* status summary / filter + search */}
      <div className="shrink-0 flex flex-wrap items-center gap-1.5 border-b border-rule px-3 py-2">
        {chips.map((c) => {
          if (c.key !== "all" && c.n === 0) return null;
          const active = filter === c.key;
          return (
            <button key={c.key} onClick={() => setFilter(c.key)}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${active ? "border-gold bg-gold-wash text-ink" : "border-rule-strong text-muted hover:border-gold"}`}>
              {c.label} <span className="tabular-nums">{c.n}</span>
            </button>
          );
        })}
        <div className="relative ml-auto">
          <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search asset, recipient, subject, sender…"
            className="w-56 rounded-full border border-rule-strong bg-input py-1 pl-7 pr-7 text-[11px] focus:border-gold focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} title="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* bulk action bar for selected rows (waiting / failed / cancelled) */}
      {sel.size > 0 && (() => {
        // Map the selected task_dids back to live (non-returned) row ids and the
        // reschedulable subset, so each label counts only what its action touches.
        const ids = returnableIds(queue, sel);
        const reschedDids = reschedulableTaskDids(queue, sel);
        const doReturnMany = (target: "queue" | "generated") =>
          start(async () => {
            const { returned, skipped } = await returnManyFromOutbox(ids, target);
            setBulkMsg(`Returned ${returned} to ${target === "queue" ? "Queue" : "Generated"}${skipped ? ` · ${skipped} skipped` : ""}.`);
            setSel(new Set());
            router.refresh();
          });
        return (
        <div className="shrink-0 flex items-center justify-between gap-2 border-b border-rule bg-gold-wash px-3 py-1.5">
          <span className="text-[12px] font-semibold text-gold">{sel.size} selected</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSel(new Set())} className="text-[11px] text-muted hover:text-ink">clear</button>
            {reschedDids.length > 0 && (
              <button onClick={() => { onReschedule(reschedDids); setSel(new Set()); }}
                className="inline-flex items-center gap-1.5 rounded bg-moss px-2.5 py-1 text-[11px] font-semibold text-white hover:opacity-90">
                <RotateCw size={12} /> Re-schedule {reschedDids.length}
              </button>
            )}
            <button disabled={pending || !ids.length} onClick={() => doReturnMany("generated")}
              className="inline-flex items-center gap-1 rounded border border-rule px-2 py-0.5 text-[11px] hover:border-signal hover:text-signal disabled:opacity-50">
              Return {ids.length} to Generated
            </button>
            <button disabled={pending || !ids.length} onClick={() => doReturnMany("queue")}
              className="inline-flex items-center gap-1 rounded border border-rule px-2 py-0.5 text-[11px] hover:border-signal hover:text-signal disabled:opacity-50">
              Return {ids.length} to Queue
            </button>
          </div>
        </div>
        );
      })()}

      {/* result of the last bulk action */}
      {bulkMsg && (
        <div className="shrink-0 flex items-center justify-between gap-2 border-b border-rule bg-signal-wash px-3 py-1.5">
          <span className="text-[12px] text-signal-deep">{bulkMsg}</span>
          <button onClick={() => setBulkMsg(null)} className="text-muted hover:text-ink"><X size={13} /></button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 bg-card-2 text-left font-mono text-[10px] uppercase tracking-wide text-muted">
            <tr>
              <th className="w-8 px-2 py-2">
                {(() => {
                  const selectable = sorted.filter(isBatchSelectable);
                  const allSel = selectable.length > 0 && selectable.every((q) => sel.has(q.task_did));
                  return (
                    <input type="checkbox" className="accent-moss" checked={allSel}
                      disabled={!selectable.length} title="Select all (waiting / failed / cancelled)"
                      onChange={() => setSel(allSel ? new Set() : new Set(selectable.map((q) => q.task_did)))} />
                  );
                })()}
              </th><th className="px-3 py-2">Status</th><th className="px-2 py-2">Asset</th>
              <th className="px-2 py-2">Send at (ET)</th><th className="px-2 py-2">From</th>
              <th className="px-2 py-2">To</th><th className="px-2 py-2">Subject</th><th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {!sorted.length && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-[12px] text-muted">
                No entries match {query ? <>“{query}”</> : "this filter"}.
              </td></tr>
            )}
            {sorted.map((q) => {
              const m = META[q.status as Status] ?? META.cancelled;
              const Icon = m.Icon;
              return (
                <tr key={q.id} className="border-b border-rule/60 align-top hover:bg-card-2"
                  style={{ boxShadow: `inset 3px 0 0 0 ${m.bar}` }}>
                  <td className="px-2 py-2.5">
                    {isBatchSelectable(q) && (
                      <input type="checkbox" className="accent-moss" checked={sel.has(q.task_did)}
                        onClick={(e) => onCheckClick(q, e)} onChange={() => {}}
                        title="Select for batch action (shift-click to select a range)" />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${m.badge}`}>
                      <Icon size={11} /> {m.label}
                    </span>
                    {q.error && <div className="mt-1 max-w-[180px] text-[10px] text-ember">{q.error}</div>}
                  </td>
                  <td className="px-2 py-2 font-semibold">{assetNames.get(q.task_did) ?? q.task_did}</td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {formatRefreshedET(q.scheduled_at)}
                    {q.sent_at && <div className="text-[10px] text-moss">sent {formatRefreshedET(q.sent_at)}</div>}
                  </td>
                  <td className="px-2 py-2">
                    {q.from_email && q.from_email !== q.sender_email
                      ? <>{q.from_email}<div className="text-[10px] text-muted">via {q.sender_email} · by {q.created_by}</div></>
                      : <>{q.sender_email}<div className="text-[10px] text-muted">by {q.created_by}</div></>}
                  </td>
                  <td className="px-2 py-2 max-w-[220px] break-words">{q.to_resolved}{q.cc_resolved && <div className="text-[10px] text-muted">cc {q.cc_resolved}</div>}</td>
                  <td className="px-2 py-2 max-w-[260px] break-words">{q.subject_resolved}</td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {isReturned(q) ? (
                      <span className="text-[10px] text-muted">
                        returned to {q.returned_to === "queue" ? "Queue" : "Generated"} by {q.returned_by} on {formatRefreshedET(q.returned_at as string)}
                      </span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        {q.status === "scheduled" && q.created_by.toLowerCase() === currentUser && (
                          <button disabled={pending} onClick={() => start(async () => { await cancelScheduledEmail(q.id); router.refresh(); })}
                            className="rounded border border-rule px-2 py-0.5 text-[11px] hover:border-ember hover:text-ember disabled:opacity-50">Cancel</button>
                        )}
                        {isReschedulable(q.status) && (
                          <button onClick={() => onReschedule([q.task_did])}
                            className="inline-flex items-center gap-1 rounded border border-rule px-2 py-0.5 text-[11px] hover:border-gold hover:text-ink">
                            <RotateCw size={11} /> Re-schedule
                          </button>
                        )}
                        <button type="button" disabled={pending}
                          onClick={() => requestReturn(q, "generated")}
                          className="rounded border border-rule px-2 py-0.5 text-[11px] hover:border-signal hover:text-signal disabled:opacity-50">
                          Return to Generated
                        </button>
                        <button type="button" disabled={pending}
                          onClick={() => requestReturn(q, "queue")}
                          className="rounded border border-rule px-2 py-0.5 text-[11px] hover:border-signal hover:text-signal disabled:opacity-50">
                          Return to Queue
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!pendingReturn}
        title="Return a sent email?"
        destructive
        confirmLabel="Return anyway"
        cancelLabel="Cancel"
        busy={pending}
        message={
          <>
            This email already went out and <strong>can&apos;t be recalled</strong>. Returning it moves the
            quote back to the{" "}
            <strong>{pendingReturn?.target === "queue" ? "Queue" : "Generated tab"}</strong>. If you re-send
            it later, the recipient may get a <strong>duplicate</strong>.
          </>
        }
        onConfirm={() => { if (pendingReturn) { doReturn(pendingReturn.id, pendingReturn.target); setPendingReturn(null); } }}
        onCancel={() => setPendingReturn(null)}
      />
    </div>
  );
}
