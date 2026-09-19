"use client";
import { CheckCircle2, CornerUpLeft, ExternalLink, RotateCw } from "lucide-react";
import type { QuoteRow } from "@/lib/quotes/types";
import { isStaleGenerated } from "@/lib/quotes/bulk";
import { StatusBadge } from "./StatusBadge";
import { EmailChips } from "./EmailChips";
import { QuotePreview } from "./QuotePreview";
import { cleanServiceLabel, formatRate, formatRefreshedET } from "@/lib/quotes/format";

/** Read-only category chip (mirrors EditableChip's look, no editing). */
function Chip({ label, value }: { label: string; value: string | null }) {
  return (
    <span className="inline-block m-0.5 text-[11px] rounded px-2 py-0.5 border border-rule bg-input">
      <span className="text-muted">{label}:</span> {value && value.length ? value : "—"}
    </span>
  );
}

/**
 * Read-only detail for a generated quote — same data the Queue's detail shows,
 * but with NO edit controls (no chip editing, rate editing, verify, line-pick, or
 * recipient assigner). Keeps the generated actions: Open in Drive / Regenerate /
 * Return to queue.
 */
export function GeneratedDetail({
  row, pending, onReturn, onRegenerate,
}: {
  row: QuoteRow | null;
  pending: boolean;
  onReturn: (taskDid: string) => void;
  onRegenerate: (row: QuoteRow) => void;
}) {
  if (!row) return <div className="flex-1 p-6 text-muted">Select a generated quote to see its details.</div>;
  const stale = isStaleGenerated(row);
  return (
    <div className="flex-1 min-h-0 p-4 overflow-y-auto">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-xl">{row.asset_name}</h2>
        <StatusBadge status={row.status} />
      </div>
      <div className="text-sm text-muted mt-1">{row.task_name} · {row.task_status}</div>
      <div className="text-[11px] text-muted-soft mt-0.5 font-mono break-all" title="Asset Site ID path">{row.asset_id ?? "—"}</div>

      <div className={`mt-3 flex items-center justify-between gap-2 text-[12px] rounded px-2 py-1.5 ${stale ? "text-amber bg-amber-wash" : "text-moss bg-moss-wash"}`}>
        <span className="flex items-center gap-1.5 min-w-0">
          {stale ? <RotateCw size={14} /> : <CheckCircle2 size={14} />}
          <span className="truncate">
            {stale ? "Edited since generated — regenerate. " : ""}
            Generated {formatRefreshedET(row.generated_at)}{row.generated_by ? ` by ${row.generated_by}` : ""}
          </span>
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {row.drive_link && (
            <a href={row.drive_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold underline-offset-2 hover:underline">
              <ExternalLink size={12} /> Open in Drive
            </a>
          )}
          <button onClick={() => onRegenerate(row)} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-current/30 hover:bg-card-2">
            <RotateCw size={12} /> Regenerate
          </button>
          <button onClick={() => onReturn(row.task_did)} disabled={pending} title="Delete the Drive PDF and return to the queue"
            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-current/30 hover:bg-card-2 disabled:opacity-50">
            <CornerUpLeft size={12} /> Return to queue
          </button>
        </div>
      </div>
      <div className="mt-3">
        <Chip label="Subcon" value={row.subcon} />
        <Chip label="GC" value={row.gc} />
        <Chip label="Carrier" value={row.carrier} />
        <Chip label="Market" value={row.market} />
        <Chip label="Project" value={row.project} />
        <Chip label="Fuze ID" value={row.fuze_id} />
      </div>

      <div className="mt-4 border-t border-rule pt-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-soft mb-1">Invoicing-form line</div>
        {row.status === "no_match" ? (
          <div className="text-sm text-muted">No invoicing-form entry matched this site.</div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm">{cleanServiceLabel(row.inv_product_service)}</span>
              {row.inv_product_service_type && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-signal-wash text-signal-deep">{row.inv_product_service_type}</span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 mt-1">
              <span className="text-sm font-mono text-signal-deep">{formatRate(row.inv_service_rate)}</span>
              {row.inv_service_rate && <QuotePreview row={row} />}
            </div>
            <div className="mt-2 text-[12px] text-ink-soft grid grid-cols-2 gap-x-4 gap-y-1">
              <div>Site ID: {row.inv_site_id ?? "—"}</div>
              <div>{row.inv_project ?? "—"}</div>
              <div>Req status: {row.inv_requirement_status ?? "—"}</div>
              <div>SOW: {row.inv_sow ?? "—"}</div>
            </div>
            <div className="mt-1 text-[10px] text-muted-soft">PM form: {row.inv_form_did ?? "—"}</div>
            {row.priced_line_count > 1 && (
              <div className="mt-1 text-[11px] text-muted">{row.invoice_chosen ? "Using a chosen invoice line" : `${row.priced_line_count} priced lines (default used)`}</div>
            )}
          </>
        )}
      </div>

      <div className="mt-3 border-t border-rule pt-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-soft mb-1">Quote recipients · directory</div>
        {!row.directory_matched ? (
          <div className="text-[12px] text-amber">No Quote Directory match.</div>
        ) : row.directory_conflict ? (
          <div className="text-[12px] text-ember">⚠ Conflicting recipients in the directory.</div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-start gap-1"><span className="text-[11px] text-muted mt-1 w-6 shrink-0">To</span><EmailChips value={row.quote_recipient} /></div>
            <div className="flex items-start gap-1"><span className="text-[11px] text-muted mt-1 w-6 shrink-0">CC</span><EmailChips value={row.quote_cc} /></div>
          </div>
        )}
      </div>
    </div>
  );
}
