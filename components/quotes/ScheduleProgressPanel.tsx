"use client";
import { useEffect } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";

export interface SchedulePrep {
  done: number;
  total: number;
  scheduled: number;
  failed: number;
  phase: "running" | "done";
  error?: string;
}

/**
 * Floating lower-right panel that reports draft-creation progress so the user can
 * close the schedule modal and keep working while drafts are created in the
 * background. Auto-dismisses a few seconds after it finishes (unless there were
 * failures, which stay until dismissed).
 */
export function ScheduleProgressPanel({ prep, onDismiss }: { prep: SchedulePrep | null; onDismiss: () => void }) {
  useEffect(() => {
    if (prep?.phase === "done" && !prep.failed && !prep.error) {
      const t = setTimeout(onDismiss, 4000);
      return () => clearTimeout(t);
    }
  }, [prep?.phase, prep?.failed, prep?.error, onDismiss]);

  if (!prep) return null;
  const pct = prep.total ? Math.round((prep.done / prep.total) * 100) : 0;
  const running = prep.phase === "running";

  return (
    <div className="fixed bottom-4 right-4 z-[70] w-[300px] rounded-xl border border-rule-strong bg-card shadow-[0_18px_50px_-16px_rgba(0,0,0,0.45)]">
      <div className="flex items-center justify-between border-b border-rule bg-card-2 px-3 py-2">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          {running ? <Loader2 size={12} className="animate-spin text-gold" /> : <CheckCircle2 size={12} className="text-moss" />}
          {running ? "Scheduling emails" : "Scheduling done"}
        </span>
        <button onClick={onDismiss} aria-label="Dismiss" className="text-muted hover:text-ink"><X size={14} /></button>
      </div>
      <div className="px-3 py-3">
        <div className="mb-1.5 text-[12px] text-ink">
          {running
            ? `Creating draft ${Math.min(prep.done + 1, prep.total)} of ${prep.total}…`
            : `${prep.scheduled} scheduled${prep.failed ? ` · ${prep.failed} failed` : ""}`}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-deep">
          <div className={`h-full rounded-full transition-all duration-300 ${prep.failed ? "bg-ember" : running ? "bg-gold" : "bg-moss"}`}
            style={{ width: `${prep.phase === "done" ? 100 : pct}%` }} />
        </div>
        {prep.error && <div className="mt-2 text-[11px] text-ember">{prep.error}</div>}
        {prep.phase === "done" && (
          <div className="mt-2 text-[10.5px] text-muted-soft">Drafts are in Gmail; see the Outbox for status.</div>
        )}
      </div>
    </div>
  );
}
