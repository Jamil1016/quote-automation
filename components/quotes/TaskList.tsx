"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FolderUp, Pencil, RotateCw, SlidersHorizontal, Search, UserX } from "lucide-react";
import type { QuoteRow } from "@/lib/quotes/types";
import { isGenerated, isStaleGenerated, isBlankService, quoteDisplayStatus } from "@/lib/quotes/bulk";
import { cleanServiceLabel, formatRate, siteDate, siteDateSortKey } from "@/lib/quotes/format";
import { StatusBadge } from "./StatusBadge";
import { MultiSelect } from "./MultiSelect";

interface Props {
  rows: QuoteRow[];
  selected: string | null;
  onSelect: (taskDid: string) => void;
  query: string;
  onQuery: (q: string) => void;
  statusFilter: string[];
  onStatusFilter: (s: string[]) => void;
  productFilter: string[];
  onProductFilter: (p: string[]) => void;
  projectFilter: string[];
  onProjectFilter: (p: string[]) => void;
  reviewFilter: string[];
  onReviewFilter: (r: string[]) => void;
  dateFilter: string[];
  onDateFilter: (d: string[]) => void;
  multiLineOnly: boolean;
  onMultiLine: (b: boolean) => void;
  recipientFilter: string;
  onRecipientFilter: (r: string) => void;
  generatedFilter: string;
  onGeneratedFilter: (g: string) => void;
  selectedDids: Set<string>;
  onToggleSelect: (did: string) => void;
  onSelectMany: (dids: string[], select: boolean) => void;
  onClearSelection: () => void;
  onBulkGenerate: () => void;
  expanded: boolean;   // full-width overview (no detail panel) → show more columns
}

const STATUS_LABELS: Record<string, string> = {
  ready: "Ready (priced)", no_price: "No price", no_match: "No match",
};

// Shared column template for the full-width (expanded) overview, so the header
// and every row line up: checkbox · Asset · Service/Category · Project · Recipient · Status+Rate
// All tracks are fixed px or fr (NO `auto`/`min-content`): each row is its own
// grid, so a content-sized track would resolve to a different width per row and
// the columns wouldn't line up. Fixed + fr against the same container width
// resolve identically on every row → columns align.
const EXPANDED_GRID =
  "grid-cols-[28px_minmax(200px,1.6fr)_minmax(150px,1.3fr)_140px_minmax(220px,2fr)_180px]";

function isModified(r: QuoteRow): boolean {
  return (
    r.subcon_overridden || r.gc_overridden || r.carrier_overridden ||
    r.market_overridden || r.project_overridden || r.fuze_id_overridden ||
    r.verified || r.invoice_chosen
  );
}

export function TaskList({
  rows, selected, onSelect, query, onQuery,
  statusFilter, onStatusFilter, productFilter, onProductFilter,
  projectFilter, onProjectFilter, reviewFilter, onReviewFilter,
  dateFilter, onDateFilter,
  multiLineOnly, onMultiLine, recipientFilter, onRecipientFilter,
  generatedFilter, onGeneratedFilter,
  selectedDids, onToggleSelect, onSelectMany, onClearSelection, onBulkGenerate,
  expanded,
}: Props) {
  const q = query.trim().toLowerCase();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [anchorDid, setAnchorDid] = useState<string | null>(null);

  const products = useMemo(
    () => Array.from(new Set(rows.map((r) => r.inv_product_service).filter((p): p is string => !!p))).sort(),
    [rows],
  );
  const projects = useMemo(
    () => Array.from(new Set(rows.map((r) => r.inv_project).filter((p): p is string => !!p))).sort(),
    [rows],
  );
  const dates = useMemo(
    () => Array.from(new Set(rows.map((r) => siteDate(r.asset_id)).filter((d): d is string => !!d)))
      .sort((a, b) => siteDateSortKey(a) - siteDateSortKey(b)),
    [rows],
  );

  const filtered = rows.filter((r) => {
    if (statusFilter.length && !statusFilter.includes(r.status)) return false;
    if (reviewFilter.length) {
      const needs = reviewFilter.includes("needs") && (r.needs_review || r.status === "no_price" || isBlankService(r));
      const ver = reviewFilter.includes("verified") && r.needs_review_base && r.verified;
      if (!(needs || ver)) return false;
    }
    if (multiLineOnly && !(r.priced_line_count > 1)) return false;
    if (recipientFilter === "has" && !(r.directory_matched && !r.directory_conflict)) return false;
    if (recipientFilter === "conflict" && !r.directory_conflict) return false;
    if (recipientFilter === "missing" && r.directory_matched) return false;
    if (generatedFilter === "generated" && !isGenerated(r)) return false;
    if (generatedFilter === "not" && isGenerated(r)) return false;
    if (generatedFilter === "stale" && !isStaleGenerated(r)) return false;
    if (productFilter.length && !(r.inv_product_service && productFilter.includes(r.inv_product_service))) return false;
    if (projectFilter.length && !(r.inv_project && projectFilter.includes(r.inv_project))) return false;
    if (dateFilter.length) {
      const d = siteDate(r.asset_id);
      if (!d || !dateFilter.includes(d)) return false;
    }
    if (!q) return true;
    return (
      r.asset_name.toLowerCase().includes(q) ||
      (r.fuze_id ?? "").toLowerCase().includes(q) ||
      (r.carrier ?? "").toLowerCase().includes(q) ||
      (r.gc ?? "").toLowerCase().includes(q) ||
      (r.inv_product_service ?? "").toLowerCase().includes(q)
    );
  });

  const filteredDids = filtered.map((r) => r.task_did);
  const someFilteredSelected = filteredDids.some((d) => selectedDids.has(d));
  const allFilteredSelected = filteredDids.length > 0 && filteredDids.every((d) => selectedDids.has(d));

  const handleRowClick = (e: React.MouseEvent, taskDid: string) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      onToggleSelect(taskDid);
      setAnchorDid(taskDid);
    } else if (e.shiftKey && anchorDid) {
      e.preventDefault();
      const ai = filtered.findIndex((r) => r.task_did === anchorDid);
      const ci = filtered.findIndex((r) => r.task_did === taskDid);
      if (ai >= 0 && ci >= 0) {
        const [lo, hi] = ai < ci ? [ai, ci] : [ci, ai];
        onSelectMany(filtered.slice(lo, hi + 1).map((r) => r.task_did), true);
      }
    } else {
      onSelect(taskDid);
      setAnchorDid(taskDid);
    }
  };

  const trunc = (s: string) => (s.length > 28 ? s.slice(0, 28) + "…" : s);
  const active: { label: string; clear: () => void }[] = [];
  statusFilter.forEach((v) => active.push({ label: `Status: ${STATUS_LABELS[v] ?? v}`, clear: () => onStatusFilter(statusFilter.filter((x) => x !== v)) }));
  productFilter.forEach((v) => active.push({ label: `Service: ${trunc(v)}`, clear: () => onProductFilter(productFilter.filter((x) => x !== v)) }));
  projectFilter.forEach((v) => active.push({ label: `Project: ${v}`, clear: () => onProjectFilter(projectFilter.filter((x) => x !== v)) }));
  reviewFilter.forEach((v) => active.push({ label: v === "needs" ? "Needs review" : "Verified", clear: () => onReviewFilter(reviewFilter.filter((x) => x !== v)) }));
  dateFilter.forEach((v) => active.push({ label: `Date: ${v}`, clear: () => onDateFilter(dateFilter.filter((x) => x !== v)) }));
  if (multiLineOnly) active.push({ label: "Multiple entries", clear: () => onMultiLine(false) });
  if (recipientFilter !== "all") active.push({
    label: recipientFilter === "has" ? "Has recipient" : recipientFilter === "conflict" ? "Recipient conflict" : "Missing recipient",
    clear: () => onRecipientFilter("all"),
  });
  if (generatedFilter !== "all") active.push({
    label: generatedFilter === "generated" ? "Generated" : generatedFilter === "stale" ? "Regenerate" : "Not generated",
    clear: () => onGeneratedFilter("all"),
  });
  const clearAll = () => { onStatusFilter([]); onProductFilter([]); onProjectFilter([]); onReviewFilter([]); onDateFilter([]); onMultiLine(false); onRecipientFilter("all"); onGeneratedFilter("all"); };

  const fieldLabel = "font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted";
  const groupLabel = "font-mono text-[10px] uppercase tracking-[0.14em] text-muted font-semibold";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-rule bg-card">
      {/* section heading */}
      <div className="flex shrink-0 items-center gap-3 px-4 pt-3.5 pb-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted">
        The worklist
        <span className="h-px flex-1 bg-rule" />
        {filtered.length} of {rows.length}
      </div>

      {/* toolbar */}
      <div className="relative flex shrink-0 flex-col gap-2 px-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-rule-strong bg-paper px-3 py-2 text-muted focus-within:border-gold">
            <Search size={15} strokeWidth={1.9} />
            <input
              className="w-full min-w-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted-soft"
              placeholder="Search sites, carriers, FA#, service…"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => setFiltersOpen((o) => !o)}
            className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px] font-semibold transition-colors ${
              filtersOpen || active.length ? "border-gold text-gold" : "border-rule-strong text-ink-soft hover:border-gold"
            }`}
          >
            <SlidersHorizontal size={14} strokeWidth={2} />
            Filters
            {active.length > 0 && (
              <span className="rounded-full bg-gold px-1.5 font-mono text-[10px] text-white">{active.length}</span>
            )}
          </button>

          {filtersOpen && (
            <>
              <button aria-hidden onClick={() => setFiltersOpen(false)} className="fixed inset-0 z-40" />
              <div className="absolute right-4 top-12 z-50 w-[340px] rounded-xl border border-rule-strong bg-card p-4 shadow-[0_18px_50px_-18px_rgba(33,28,20,0.5)]">
                <div className="mb-3 flex items-center justify-between">
                  <span className={groupLabel}>Invoice</span>
                  {active.length > 0 && (
                    <button onClick={clearAll} className="text-[11px] font-semibold text-muted hover:text-gold">clear all</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabel}>Status</span>
                    <MultiSelect
                      options={["ready", "no_price", "no_match"].map((v) => ({ value: v, label: STATUS_LABELS[v] }))}
                      selected={statusFilter}
                      onChange={onStatusFilter}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabel}>Project</span>
                    <MultiSelect
                      options={projects.map((p) => ({ value: p, label: p }))}
                      selected={projectFilter}
                      onChange={onProjectFilter}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabel}>Recipient</span>
                    <select
                      className="w-full rounded-md border border-rule-strong bg-paper px-2 py-1.5 text-sm"
                      value={recipientFilter}
                      onChange={(e) => onRecipientFilter(e.target.value)}
                    >
                      <option value="all">All</option>
                      <option value="has">Has recipient</option>
                      <option value="conflict">Recipient conflict</option>
                      <option value="missing">Missing recipient</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabel}>Site date</span>
                    <MultiSelect
                      options={dates.map((d) => ({ value: d, label: d }))}
                      selected={dateFilter}
                      onChange={onDateFilter}
                    />
                  </label>
                  <label className="col-span-2 flex flex-col gap-1">
                    <span className={fieldLabel}>Service / Category</span>
                    <MultiSelect
                      options={products.map((p) => ({ value: p, label: p }))}
                      selected={productFilter}
                      onChange={onProductFilter}
                    />
                  </label>
                </div>

                <div className={`${groupLabel} mt-3 border-t border-rule pt-3`}>Review</div>
                <div className="mt-2 grid grid-cols-2 gap-2.5">
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabel}>Verify state</span>
                    <MultiSelect
                      options={[{ value: "needs", label: "Needs review" }, { value: "verified", label: "Verified" }]}
                      selected={reviewFilter}
                      onChange={onReviewFilter}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className={fieldLabel}>Lines</span>
                    <select
                      className="w-full rounded-md border border-rule-strong bg-paper px-2 py-1.5 text-sm"
                      value={multiLineOnly ? "multi" : "all"}
                      onChange={(e) => onMultiLine(e.target.value === "multi")}
                    >
                      <option value="all">All</option>
                      <option value="multi">Multiple entries</option>
                    </select>
                  </label>
                </div>
                <div className="mt-3 flex justify-end border-t border-rule pt-3">
                  <button
                    onClick={() => setFiltersOpen(false)}
                    className="rounded-md bg-ink px-3.5 py-1.5 text-[12px] font-semibold text-paper"
                  >
                    Done
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {active.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {active.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold-wash px-2 py-0.5 text-[11px] text-gold">
                {f.label}
                <button onClick={f.clear} className="hover:text-ember" aria-label="remove filter">✕</button>
              </span>
            ))}
            <button onClick={clearAll} className="ml-1 text-[11px] text-muted hover:text-gold">clear all</button>
          </div>
        )}

        <div className="flex items-center justify-between text-[10.5px] text-muted-soft">
          <label className="inline-flex cursor-pointer select-none items-center gap-1.5">
            <input
              type="checkbox"
              className="accent-gold"
              checked={allFilteredSelected}
              ref={(el) => { if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected; }}
              onChange={() => onSelectMany(filteredDids, !allFilteredSelected)}
              disabled={filtered.length === 0}
            />
            select all ({filtered.length})
          </label>
        </div>

        {selectedDids.size > 0 && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-gold/40 bg-gold-wash px-2.5 py-1.5">
            <span className="text-[12px] font-semibold text-gold">{selectedDids.size} selected</span>
            <div className="flex items-center gap-2">
              <button onClick={onClearSelection} className="text-[11px] text-muted hover:text-gold">clear</button>
              <button
                onClick={onBulkGenerate}
                className="inline-flex items-center gap-1.5 rounded-md bg-ink px-2.5 py-1 text-[11px] font-semibold text-paper hover:opacity-90"
              >
                <FolderUp size={13} /> Generate &amp; upload to Drive
              </button>
            </div>
          </div>
        )}
      </div>

      {/* list */}
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-rule">
        {expanded && filtered.length > 0 && (
          <div className={`sticky top-0 z-[1] grid ${EXPANDED_GRID} items-end gap-4 border-b border-rule bg-card px-3 py-2 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-soft`}>
            <span />
            <span>Asset</span>
            <span>Service / Category</span>
            <span>Project</span>
            <span>Site ID</span>
            <span className="text-right">Status / Rate</span>
          </div>
        )}
        {filtered.length === 0 && (
          <div className="p-4 text-sm text-muted">No tasks match.</div>
        )}
        {filtered.map((r) => {
          const isSel = selected === r.task_did;
          const isBulk = selectedDids.has(r.task_did);
          // Bulk-selected (for Generate) = warm brown tint + brown bar; the row open in
          // the detail panel = gold bar. Bulk takes precedence when both apply.
          const rowState = isBulk
            ? "bg-[var(--row-bulk-bg)] shadow-[inset_3px_0_0_var(--row-bulk-bar)]"
            : isSel
              ? "bg-card-2 shadow-[inset_3px_0_0_var(--gold)]"
              : "hover:bg-card-2";
          // "ready" only shows when nothing is left to fix. While a row still has
          // an open problem (needs verify, missing/conflicting recipient, or an
          // unpicked multi-line), suppress the green badge — the problem flags
          // carry the row. no_price / no_match always show (they ARE the problem).
          const hasOpenIssue =
            r.needs_review || !r.directory_matched || r.directory_conflict ||
            (r.priced_line_count > 1 && !r.invoice_chosen);
          const ds = quoteDisplayStatus(r);
          const showStatus = ds !== "ready" || !hasOpenIssue;
          // Status icons — rendered next to the name in compact view, or up in
          // the right cluster (next to the status badge) in the expanded view.
          const badges = (
            <>
              {isModified(r) && (
                <span className="inline-flex items-center gap-0.5 rounded border border-signal/30 bg-signal-wash px-1 py-0.5 text-[9px] text-signal-deep" title="This entry has manual edits">
                  <Pencil size={9} /> edited
                </span>
              )}
              {r.priced_line_count > 1 && (
                r.invoice_chosen ? (
                  <span className="rounded border border-moss/40 bg-moss-wash px-1 text-[9px] font-semibold text-moss">chosen</span>
                ) : (
                  <span className="rounded border border-amber/40 px-1 text-[9px] text-amber">{r.priced_line_count}×</span>
                )
              )}
              {r.needs_review && (
                <span className="inline-flex items-center gap-0.5 rounded bg-ember-wash px-1 py-0.5 text-[9px] font-semibold text-ember">
                  <AlertTriangle size={9} /> verify
                </span>
              )}
              {!r.directory_matched && (
                <span className="inline-flex items-center gap-0.5 rounded border border-amber/40 px-1 py-0.5 text-[9px] font-semibold text-amber" title="No quote recipient assigned">
                  <UserX size={9} /> no recipient
                </span>
              )}
              {isGenerated(r) && (
                isStaleGenerated(r) ? (
                  <span className="inline-flex items-center gap-0.5 rounded bg-gold-wash px-1 py-0.5 text-[9px] font-semibold text-amber" title="Edited since generated — regenerate">
                    <RotateCw size={9} /> regenerate
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 rounded bg-moss-wash px-1 py-0.5 text-[9px] font-semibold text-moss" title="Generated and uploaded to Drive">
                    <CheckCircle2 size={9} /> generated
                  </span>
                )
              )}
            </>
          );

          // ── Expanded (full-width) overview: aligned grid, single-line cells ──
          if (expanded) {
            return (
              <div
                key={r.task_did}
                onClick={(e) => handleRowClick(e, r.task_did)}
                onMouseDown={(e) => { if (e.shiftKey) e.preventDefault(); }}
                role="button"
                title="Click to view · Ctrl/Cmd-click to (de)select · Shift-click to select a range"
                className={`grid ${EXPANDED_GRID} cursor-pointer select-none items-center gap-4 border-b border-rule/70 px-3 py-2.5 transition-colors ${rowState}`}
              >
                <label className="self-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="accent-gold"
                    checked={selectedDids.has(r.task_did)}
                    onChange={() => onToggleSelect(r.task_did)}
                  />
                </label>
                <div className="min-w-0">
                  <div className="truncate font-display text-[15px] leading-tight tracking-[-0.01em]">{r.asset_name}</div>
                  <div className="mt-0.5 truncate font-mono text-[10px] text-muted">
                    {(r.carrier ?? "—")} · {(r.gc ?? "—")} · {(r.project ?? "—")}
                  </div>
                </div>
                <div className="min-w-0 truncate text-[12px] text-ink-soft" title={cleanServiceLabel(r.inv_product_service)}>
                  {cleanServiceLabel(r.inv_product_service)}
                </div>
                <div className="min-w-0 truncate text-[12px] text-ink-soft">{r.inv_project ?? "—"}</div>
                <div className="min-w-0 truncate font-mono text-[11px] text-muted" title={r.asset_id ?? ""}>
                  {r.asset_id ?? "—"}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    {showStatus && <StatusBadge status={ds} />}
                    {badges}
                  </div>
                  {r.priced_line_count > 1 && !r.invoice_chosen ? (
                    <span className="text-[11px] text-muted-soft">multiple</span>
                  ) : (
                    <span className="font-display text-[15px] font-semibold leading-none">{formatRate(r.inv_service_rate)}</span>
                  )}
                </div>
              </div>
            );
          }

          return (
            <div
              key={r.task_did}
              className={`flex items-start border-b border-rule/70 transition-colors ${rowState}`}
            >
              <label className="cursor-pointer pl-3 pt-3.5" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  className="accent-gold"
                  checked={selectedDids.has(r.task_did)}
                  onChange={() => onToggleSelect(r.task_did)}
                />
              </label>
              <button
                onClick={(e) => handleRowClick(e, r.task_did)}
                onMouseDown={(e) => { if (e.shiftKey) e.preventDefault(); }}
                title="Click to view · Ctrl/Cmd-click to (de)select · Shift-click to select a range"
                className="flex min-w-0 flex-1 select-none items-start gap-4 p-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-[16px] leading-tight tracking-[-0.01em]">{r.asset_name}</span>
                    {badges}
                  </div>
                  <div className="mt-1 truncate font-mono text-[11px] text-muted">
                    {(r.carrier ?? "—")} · {(r.gc ?? "—")} · {(r.project ?? "—")}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    {showStatus && <StatusBadge status={ds} />}
                  </div>
                  {r.priced_line_count > 1 && !r.invoice_chosen ? (
                    <span className="text-[11px] text-muted-soft">multiple</span>
                  ) : (
                    <span className="font-display text-[16px] font-semibold leading-none">
                      {formatRate(r.inv_service_rate)}
                    </span>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
