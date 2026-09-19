"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, CornerUpLeft, ExternalLink, FolderUp, Mail, RotateCw } from "lucide-react";
import type { QuoteRow, EmailQueueRow, EmailTemplate } from "@/lib/quotes/types";
import type { SendIdentity } from "@/lib/quotes/send-identities";
import { isStaleGenerated } from "@/lib/quotes/bulk";
import { returnToQueue, returnManyToQueue } from "@/lib/quotes/actions";
import { revalidateQuotes } from "@/lib/quotes/revalidate-actions";
import { setActiveFrom } from "@/lib/quotes/settings-actions";
import { StatusBadge } from "./StatusBadge";
import { BulkGenerateModal } from "./BulkGenerateModal";
import { GeneratedDetail } from "./GeneratedDetail";
import { ScheduleEmailModal, type SchedulePayload } from "./ScheduleEmailModal";
import { EmailOutbox } from "./EmailOutbox";
import { ScheduleProgressPanel, type SchedulePrep } from "./ScheduleProgressPanel";
import { formatRefreshedET } from "@/lib/quotes/format";

/**
 * The "done pile": quotes generated + uploaded to Drive, as a list + read-only
 * detail (same layout as the Queue, no edit controls). Plain click opens the
 * detail; checkbox / Ctrl-click / Shift-click drive a bulk re-generate. Each row
 * can be returned to the Queue (which deletes its Drive PDF). Entries edited since
 * generation are flagged ⟳ regenerate.
 */
export function GeneratedClient({ rows, driveFolderId, templates, queue, gmailEmail, currentUser, sendIdentities, activeFrom }: { rows: QuoteRow[]; driveFolderId?: string; templates: EmailTemplate[]; queue: EmailQueueRow[]; gmailEmail: string | null; currentUser: string; sendIdentities: SendIdentity[]; activeFrom: string | null }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [staleOnly, setStaleOnly] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<string | null>(null);
  const [bulk, setBulk] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [regenRows, setRegenRows] = useState<QuoteRow[] | null>(null);
  const [emailRows, setEmailRows] = useState<QuoteRow[] | null>(null);
  const [pendingDid, setPendingDid] = useState<string | null>(null);
  const [view, setView] = useState<"quotes" | "outbox">("quotes");
  const [prep, setPrep] = useState<SchedulePrep | null>(null);
  const [, start] = useTransition();
  const [fromMenuOpen, setFromMenuOpen] = useState(false);
  // Optimistic removal: task_dids returned this session disappear from Generated immediately.
  const [justReturned, setJustReturned] = useState<Set<string>>(new Set());
  // Pick the saved default "send as" identity inline (null = own account address).
  const pickFrom = (email: string | null) =>
    start(async () => { await setActiveFrom(email); setFromMenuOpen(false); router.refresh(); });

  // Create drafts in the background while a lower-right panel streams progress, so
  // the modal can close immediately and the user isn't blocked.
  const runSchedule = async (payload: SchedulePayload) => {
    // Stay on the current view; the lower-right progress panel reports progress.
    setPrep({ done: 0, total: payload.taskDids.length, scheduled: 0, failed: 0, phase: "running" });
    try {
      const res = await fetch("/api/email-queue/schedule", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok || !res.body) {
        setPrep({ done: 0, total: payload.taskDids.length, scheduled: 0, failed: payload.taskDids.length, phase: "done", error: await res.text().catch(() => "request failed") });
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "", scheduled = 0, failed = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line);
          if (e.type === "start") setPrep({ done: 0, total: e.total, scheduled: 0, failed: 0, phase: "running" });
          else if (e.type === "progress") {
            if (e.ok) scheduled++; else failed++;
            setPrep({ done: e.done, total: e.total, scheduled, failed, phase: "running" });
          } else if (e.type === "done") {
            setPrep({ done: e.scheduled + e.failed, total: e.scheduled + e.failed, scheduled: e.scheduled, failed: e.failed, phase: "done" });
          }
        }
      }
      await revalidateQuotes();
      router.refresh();
    } catch (err) {
      setPrep((p) => (p ? { ...p, phase: "done", error: (err as Error).message } : null));
    }
  };

  // Any quote that's been queued (waiting/sent/failed/cancelled) lives in the Outbox,
  // not the Quotes pile — so a quote has one home. Re-scheduling failed/cancelled is
  // done from the Outbox (multi-select), which keeps one record per quote.
  const inOutbox = new Set(queue.filter((q) => !q.returned_at).map((q) => q.task_did));
  const available = rows.filter((r) => !inOutbox.has(r.task_did) && !justReturned.has(r.task_did));
  const staleCount = available.filter(isStaleGenerated).length;
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = available.filter((r) => {
    if (staleOnly && !isStaleGenerated(r)) return false;
    if (!terms.length) return true;
    const hay = `${r.asset_name} ${r.gc ?? ""} ${r.carrier ?? ""} ${r.market ?? ""} ${r.project ?? ""} ${r.quote_recipient ?? ""}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
  const current = rows.find((r) => r.task_did === selectedDetail) ?? null;

  const toggleBulk = (did: string) =>
    setBulk((s) => { const n = new Set(s); if (n.has(did)) n.delete(did); else n.add(did); return n; });
  const rowClick = (e: React.MouseEvent, did: string, idx: number) => {
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); toggleBulk(did); setAnchor(did); }
    else if (e.shiftKey && anchor) {
      e.preventDefault();
      const ai = filtered.findIndex((r) => r.task_did === anchor);
      if (ai >= 0) { const [lo, hi] = ai < idx ? [ai, idx] : [idx, ai]; setBulk((s) => { const n = new Set(s); filtered.slice(lo, hi + 1).forEach((r) => n.add(r.task_did)); return n; }); }
    } else { setSelectedDetail(did); setAnchor(did); }
  };
  const bulkRows = filtered.filter((r) => bulk.has(r.task_did));
  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => bulk.has(r.task_did));
  const toggleSelectAll = () =>
    setBulk((s) => {
      const n = new Set(s);
      if (allFilteredSelected) filtered.forEach((r) => n.delete(r.task_did));
      else filtered.forEach((r) => n.add(r.task_did));
      return n;
    });
  // Re-schedule from the Outbox: map the selected queue task_dids back to their
  // generated rows and open the schedule modal for them.
  const reschedule = (dids: string[]) => {
    const set = new Set(dids);
    const rws = rows.filter((r) => set.has(r.task_did));
    if (rws.length) setEmailRows(rws);
  };
  const doReturn = (did: string) => {
    setPendingDid(did);
    setJustReturned((s) => { const n = new Set(s); n.add(did); return n; });
    start(async () => { await returnToQueue(did); setPendingDid(null); if (selectedDetail === did) setSelectedDetail(null); router.refresh(); });
  };

  // Esc, staged (matches the Queue): 1) close the open detail; 2) once closed, clear
  // the bulk selection. Ignored while typing in a field or when a modal is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || regenRows || emailRows) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (selectedDetail) { setSelectedDetail(null); return; }
      if (bulk.size > 0) setBulk(new Set());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedDetail, bulk, regenRows, emailRows]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-rule bg-card">
      <div className="shrink-0 flex justify-between items-center px-4 py-2.5 border-b border-rule bg-card-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">Generated quotes</span>
        <div className="flex items-center gap-3 text-[11px] text-muted">
          <span>{available.length} to schedule{inOutbox.size ? ` · ${inOutbox.size} in outbox` : ""}{staleCount ? ` · ${staleCount} need regenerate` : ""}</span>
          <div className="flex items-center gap-1 rounded-full border border-rule bg-card p-0.5 text-[11px]">
            <button onClick={() => setView("quotes")} className={`rounded-full px-2 py-0.5 ${view === "quotes" ? "bg-signal text-white" : "hover:text-signal"}`}>Quotes</button>
            <button onClick={() => setView("outbox")} className={`rounded-full px-2 py-0.5 ${view === "outbox" ? "bg-signal text-white" : "hover:text-signal"}`}>
              Outbox{queue.filter((q) => q.status === "scheduled").length ? ` · ${queue.filter((q) => q.status === "scheduled").length}` : ""}
            </button>
          </div>
          <span className="relative text-[10.5px] text-muted">
            {!gmailEmail ? (
              <a href="/settings" className="font-semibold text-signal hover:underline">Set active sender</a>
            ) : sendIdentities.length === 0 ? (
              <>Sending as: <span className="font-semibold text-ink-soft">{gmailEmail}</span></>
            ) : (
              <>
                Sending as:{" "}
                <button type="button" onClick={() => setFromMenuOpen((o) => !o)}
                  className="inline-flex items-center gap-0.5 font-semibold text-ink-soft hover:text-signal">
                  {sendIdentities.find((i) => i.email === activeFrom)?.name ?? gmailEmail}
                  <ChevronDown size={11} />
                </button>
                {fromMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setFromMenuOpen(false)} />
                    <div className="absolute left-0 top-full z-50 mt-1 min-w-[230px] overflow-hidden rounded-md border border-rule-strong bg-card py-1 shadow-lg">
                      <button type="button" onClick={() => pickFrom(null)}
                        className={`block w-full px-3 py-1.5 text-left hover:bg-card-2 ${!activeFrom ? "font-semibold text-signal" : "text-ink-soft"}`}>
                        Your account address <span className="text-muted">({gmailEmail})</span>
                      </button>
                      {sendIdentities.map((i) => (
                        <button key={i.email} type="button" onClick={() => pickFrom(i.email)}
                          className={`block w-full px-3 py-1.5 text-left hover:bg-card-2 ${activeFrom === i.email ? "font-semibold text-signal" : "text-ink-soft"}`}>
                          {i.name} &lt;{i.email}&gt;
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </span>
          {driveFolderId && (
            <a href={`https://drive.google.com/drive/folders/${driveFolderId}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-signal hover:underline">
              <ExternalLink size={12} /> Drive folder
            </a>
          )}
        </div>
      </div>

      {view === "outbox" ? (
        <EmailOutbox queue={queue} assetNames={new Map(rows.map((r) => [r.task_did, r.asset_name]))} currentUser={currentUser} onReschedule={reschedule} />
      ) : (
        <div className="flex flex-1 min-h-0">
          <div className="w-[42%] border-r border-rule flex flex-col min-h-0">
            <div className="shrink-0 p-2 border-b border-rule flex items-center gap-2">
              <input className="flex-1 min-w-0 text-sm px-2 py-1 rounded border border-rule bg-input"
                placeholder="Search asset / carrier / GC / market / recipient" value={query} onChange={(e) => setQuery(e.target.value)} />
              {staleCount > 0 && (
                <button onClick={() => setStaleOnly((v) => !v)}
                  className={`shrink-0 text-[12px] px-2 py-1 rounded-full border whitespace-nowrap ${staleOnly ? "bg-signal text-white border-signal" : "bg-input border-rule-strong hover:border-signal"}`}>
                  ⟳ {staleCount}
                </button>
              )}
            </div>

            {bulk.size > 0 && (
              <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-1.5 border-b border-rule bg-gold-wash">
                <span className="text-[12px] font-semibold text-gold">{bulk.size} selected</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setBulk(new Set())} className="text-[11px] text-muted hover:text-signal">clear</button>
                  <button
                    onClick={() => { const dids = [...bulk]; setPendingDid("__bulk__"); setJustReturned((s) => { const n = new Set(s); dids.forEach((d) => n.add(d)); return n; }); start(async () => { await returnManyToQueue(dids); setPendingDid(null); if (selectedDetail && dids.includes(selectedDetail)) setSelectedDetail(null); setBulk(new Set()); router.refresh(); }); }}
                    disabled={pendingDid === "__bulk__"}
                    className="text-[11px] px-2 py-1 rounded border border-rule hover:border-signal disabled:opacity-50 inline-flex items-center gap-1">
                    <CornerUpLeft size={12} /> Return
                  </button>
                  <button onClick={() => setRegenRows(bulkRows)} className="text-[11px] font-semibold text-white bg-signal rounded px-2.5 py-1 hover:bg-signal-deep inline-flex items-center gap-1.5">
                    <FolderUp size={13} /> Regenerate
                  </button>
                  <button onClick={() => setEmailRows(bulkRows)} className="text-[11px] font-semibold text-white bg-moss rounded px-2.5 py-1 hover:opacity-90 inline-flex items-center gap-1.5">
                    <Mail size={13} /> Schedule email
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 px-2 py-1 text-[10px] text-muted-soft border-b border-rule">
              <div className="flex items-center gap-2">
                {filtered.length > 0 && (
                  <button onClick={toggleSelectAll} className="text-[11px] font-semibold text-signal hover:underline">
                    {allFilteredSelected ? "Deselect all" : "Select all"}
                  </button>
                )}
                <span>Ctrl/Cmd-click or checkbox · Shift-click for a range</span>
              </div>
              <span>{filtered.length} of {available.length}</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {filtered.length === 0 && (
                <div className="p-6 text-sm text-muted">{
                  rows.length === 0 ? "No quotes generated yet. Generate some from the Quotation Queue."
                  : available.length === 0 ? "All generated quotes are scheduled — see the Outbox."
                  : "No generated quotes match."
                }</div>
              )}
              {filtered.map((r, idx) => {
                const stale = isStaleGenerated(r);
                return (
                  <div key={r.task_did} className={`flex items-start gap-2 border-b border-rule/60 px-2 ${bulk.has(r.task_did) ? "bg-[var(--row-bulk-bg)] shadow-[inset_3px_0_0_var(--row-bulk-bar)]" : selectedDetail === r.task_did ? "bg-card-2 shadow-[inset_3px_0_0_var(--gold)]" : "hover:bg-card-2"}`}>
                    <label className="pt-2.5 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="accent-signal" checked={bulk.has(r.task_did)} onChange={() => { toggleBulk(r.task_did); setAnchor(r.task_did); }} />
                    </label>
                    <button className="flex-1 min-w-0 text-left py-2 select-none" onClick={(e) => rowClick(e, r.task_did, idx)} onMouseDown={(e) => { if (e.shiftKey) e.preventDefault(); }}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{r.asset_name}</span>
                        <StatusBadge status={r.status} />
                        {stale
                          ? <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber bg-amber-wash rounded px-1 py-0.5"><RotateCw size={9} /> regenerate</span>
                          : <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-moss bg-moss-wash rounded px-1 py-0.5"><CheckCircle2 size={9} /> generated</span>}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">Generated {formatRefreshedET(r.generated_at)}</div>
                      <div className="text-[11px] text-muted">{(r.carrier ?? "—")} · {(r.gc ?? "—")}</div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <GeneratedDetail row={current} pending={pendingDid === current?.task_did} onReturn={doReturn} onRegenerate={(row) => setRegenRows([row])} />
        </div>
      )}

      {regenRows && (
        <BulkGenerateModal
          rows={regenRows}
          onClose={() => setRegenRows(null)}
          onDeselect={(dids) => setBulk((s) => { const n = new Set(s); dids.forEach((d) => n.delete(d)); return n; })}
          onGenerated={() => { setBulk(new Set()); revalidateQuotes().then(() => router.refresh()); }}
        />
      )}
      {emailRows && (
        <ScheduleEmailModal rows={emailRows} templates={templates} gmailEmail={gmailEmail}
          identities={sendIdentities} defaultFrom={activeFrom}
          onSchedule={runSchedule} onClose={() => setEmailRows(null)} />
      )}
      <ScheduleProgressPanel prep={prep} onDismiss={() => setPrep(null)} />
    </div>
  );
}
