"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import type { DirectoryRow, QuoteData } from "@/lib/quotes/types";
import { TaskList } from "./TaskList";
import { TaskDetail } from "./TaskDetail";
import { BulkGenerateModal } from "./BulkGenerateModal";
import { formatRefreshedET } from "@/lib/quotes/format";
import { isBlankService } from "@/lib/quotes/bulk";
import { revalidateQuotes } from "@/lib/quotes/revalidate-actions";

const SPLIT_KEY = "quote.split.basis";
const clampBasis = (n: number) => Math.max(28, Math.min(72, n));

export function QueueClient({ data, directory }: { data: QuoteData; directory: DirectoryRow[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(() => params.get("task"));
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [productFilter, setProductFilter] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [reviewFilter, setReviewFilter] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<string[]>([]);
  const [multiLineOnly, setMultiLineOnly] = useState(false);
  const [recipientFilter, setRecipientFilter] = useState("all");
  const [generatedFilter, setGeneratedFilter] = useState("all");
  const [selectedDids, setSelectedDids] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  // Optimistic removal: task_dids generated this session disappear immediately.
  // Safe to accumulate — generated rows never re-enter the queue.
  const [justGenerated, setJustGenerated] = useState<Set<string>>(new Set());

  // The Queue is the to-do list: generated quotes live in the Generated tab,
  // and anything already emailed (any Outbox status) is done with — excluding
  // both keeps a data refresh from re-adding an asset that was handled.
  const rows = data.rows.filter((r) => !r.generated_at && !r.emailed && !justGenerated.has(r.task_did));
  const current = rows.find((r) => r.task_did === selected) ?? null;
  const detailOpen = current != null;   // detail panel shows only when a row is selected

  const select = (taskDid: string) => {
    setSelected(taskDid);
    const p = new URLSearchParams(Array.from(params.entries()));
    p.set("task", taskDid);
    window.history.replaceState(null, "", `/?${p.toString()}`);
  };
  // Closing the detail clears the selection → worklist expands full-width.
  const closeDetail = () => {
    setSelected(null);
    const p = new URLSearchParams(Array.from(params.entries()));
    p.delete("task");
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `/?${qs}` : "/");
  };

  const toggleSelect = (did: string) =>
    setSelectedDids((s) => {
      const n = new Set(s);
      if (n.has(did)) n.delete(did); else n.add(did);
      return n;
    });
  const selectMany = (dids: string[], on: boolean) =>
    setSelectedDids((s) => {
      const n = new Set(s);
      dids.forEach((d) => (on ? n.add(d) : n.delete(d)));
      return n;
    });
  const selectedRows = rows.filter((r) => selectedDids.has(r.task_did));

  // ── Filters reset + KPI quick-filters ───────────────────────
  const clearAll = useCallback(() => {
    setStatusFilter([]); setProductFilter([]); setProjectFilter([]);
    setReviewFilter([]); setDateFilter([]); setMultiLineOnly(false); setRecipientFilter("all");
    setGeneratedFilter("all");
  }, []);

  const total = rows.length;
  const missingRecipient = rows.filter((r) => r.status === "ready" && !r.directory_matched).length;
  // "Need review" now folds in the things that must be fixed before quoting:
  // parse-review flag, no price, and a blank single-line service name.
  const needReview = rows.filter((r) => r.needs_review || r.status === "no_price" || isBlankService(r)).length;
  const multiLine = rows.filter((r) => r.priced_line_count > 1).length;

  const noFilters =
    statusFilter.length === 0 && productFilter.length === 0 && projectFilter.length === 0 &&
    reviewFilter.length === 0 && dateFilter.length === 0 && !multiLineOnly &&
    recipientFilter === "all" && generatedFilter === "all";

  const kpis = [
    {
      key: "total", n: total, label: "In queue", sub: "Quote Provided",
      active: noFilters, gold: false,
      onClick: () => clearAll(),
    },
    {
      key: "missing", n: missingRecipient, label: "Missing recipient", sub: "priced · assign to send",
      active: recipientFilter === "missing" && statusFilter.length === 1 && statusFilter[0] === "ready",
      gold: true,
      onClick: () => { clearAll(); setStatusFilter(["ready"]); setRecipientFilter("missing"); },
    },
    {
      key: "review", n: needReview, label: "Need review", sub: "verify · no price · no service",
      active: reviewFilter.length === 1 && reviewFilter[0] === "needs",
      gold: false,
      onClick: () => { clearAll(); setReviewFilter(["needs"]); },
    },
    {
      key: "multi", n: multiLine, label: "Multi-line", sub: "pick a line",
      active: multiLineOnly,
      gold: false,
      onClick: () => { clearAll(); setMultiLineOnly(true); },
    },
  ];

  // ── Resizable split ─────────────────────────────────────────
  const [basis, setBasis] = useState(54);
  const basisRef = useRef(54);
  const splitRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const saved = Number(localStorage.getItem(SPLIT_KEY));
    if (saved) { const c = clampBasis(saved); setBasis(c); basisRef.current = c; }
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !splitRef.current) return;
      const r = splitRef.current.getBoundingClientRect();
      const pct = clampBasis(((e.clientX - r.left) / r.width) * 100);
      basisRef.current = pct;
      setBasis(pct);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem(SPLIT_KEY, String(Math.round(basisRef.current)));
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  };

  // Esc, staged: 1) close the detail panel; 2) once it's closed, clear the bulk
  // selection. (Ignored while typing in a field or when the bulk modal is open.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || bulkOpen) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (detailOpen) { closeDetail(); return; }
      if (selectedDids.size > 0) setSelectedDids(new Set());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailOpen, bulkOpen, selectedDids]);

  // Render the data-freshness line into the shared header's nav row.
  const [freshnessSlot, setFreshnessSlot] = useState<HTMLElement | null>(null);
  useEffect(() => { setFreshnessSlot(document.getElementById("header-freshness")); }, []);
  const freshness = (
    <span>
      Asset tasks · {formatRefreshedET(data.assetTasksRefreshedAt)}
      <span className="px-2 text-muted-soft">|</span>
      Invoicing · {formatRefreshedET(data.refreshedAt)}
    </span>
  );

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      {freshnessSlot && createPortal(freshness, freshnessSlot)}
      <div className="mx-auto flex min-h-0 w-full max-w-[1800px] flex-1 flex-col px-6 pb-6 pt-5 lg:px-10">
        {/* stat ribbon — cards double as one-click filters */}
        <div className="mb-5 grid shrink-0 grid-cols-2 overflow-hidden rounded-2xl border border-rule bg-card sm:grid-cols-4">
          {kpis.map((k, i) => (
            <button
              key={k.key}
              onClick={k.onClick}
              className={`group border-rule px-5 py-4 text-left transition-colors ${i > 0 ? "sm:border-l" : ""} ${
                k.active ? "bg-card-2" : "hover:bg-card-2"
              }`}
            >
              <div
                className={`font-display text-[32px] leading-[0.95] tracking-[-0.02em] ${k.gold ? "text-gold" : "text-ink"}`}
              >
                {k.n}
              </div>
              <div className="mt-1.5 text-[12px] text-muted">
                <span className="font-semibold text-ink-soft">{k.label}</span>
                <span className="text-muted"> · {k.sub}</span>
              </div>
              <div
                className={`mt-2 h-0.5 w-8 rounded-full transition-colors ${
                  k.active ? "bg-gold" : "bg-transparent group-hover:bg-rule-strong"
                }`}
              />
            </button>
          ))}
        </div>

        {/* resizable split — detail shows only when a row is selected */}
        <div ref={splitRef} className="flex min-h-0 flex-1">
          <div
            style={detailOpen ? { flexBasis: `${basis}%` } : undefined}
            className={`flex min-h-0 flex-col ${detailOpen ? "min-w-[240px] shrink-0 grow-0 pr-3" : "flex-1"}`}
          >
            <TaskList
              rows={rows}
              selected={selected}
              onSelect={select}
              query={query}
              onQuery={setQuery}
              statusFilter={statusFilter}
              onStatusFilter={setStatusFilter}
              productFilter={productFilter}
              onProductFilter={setProductFilter}
              projectFilter={projectFilter}
              onProjectFilter={setProjectFilter}
              reviewFilter={reviewFilter}
              onReviewFilter={setReviewFilter}
              dateFilter={dateFilter}
              onDateFilter={setDateFilter}
              multiLineOnly={multiLineOnly}
              onMultiLine={setMultiLineOnly}
              recipientFilter={recipientFilter}
              onRecipientFilter={setRecipientFilter}
              generatedFilter={generatedFilter}
              onGeneratedFilter={setGeneratedFilter}
              selectedDids={selectedDids}
              onToggleSelect={toggleSelect}
              onSelectMany={selectMany}
              onClearSelection={() => setSelectedDids(new Set())}
              onBulkGenerate={() => setBulkOpen(true)}
              expanded={!detailOpen}
            />
          </div>

          {detailOpen && (
            <>
              {/* divider */}
              <div
                onMouseDown={startDrag}
                role="separator"
                aria-orientation="vertical"
                title="Drag to resize"
                className="group flex w-4 shrink-0 cursor-col-resize items-center justify-center self-stretch"
              >
                <div className="h-14 w-1 rounded-full bg-rule-strong transition-colors group-hover:bg-gold" />
              </div>

              <div className="flex min-h-0 min-w-[340px] flex-1 flex-col pl-3">
                <TaskDetail
                  row={current}
                  options={current ? data.options.filter((o) => o.task_did === current.task_did) : []}
                  directory={directory}
                  productServiceValues={data.productServiceValues}
                  onClose={closeDetail}
                  onGenerated={async (taskDid) => {
                    setJustGenerated((s) => { const n = new Set(s); n.add(taskDid); return n; });
                    await revalidateQuotes();
                    router.refresh();
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {bulkOpen && (
        <BulkGenerateModal
          rows={selectedRows}
          onClose={() => setBulkOpen(false)}
          onDeselect={(dids) => selectMany(dids, false)}
          onGenerated={async (generatedDids) => {
            setJustGenerated((s) => { const n = new Set(s); generatedDids.forEach((d) => n.add(d)); return n; });
            await revalidateQuotes();
            router.refresh();
          }}
        />
      )}
    </main>
  );
}
