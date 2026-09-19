"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import type { DirectoryRow, InvoiceOption, QuoteRow } from "@/lib/quotes/types";
import { StatusBadge } from "./StatusBadge";
import { EditableChip } from "./EditableChip";
import { RecipientAssigner } from "./RecipientAssigner";
import { RateEditor } from "./RateEditor";
import { ProductServiceEditor } from "./ProductServiceEditor";
import { QuotePreview } from "./QuotePreview";
import { GenerateToDriveButton } from "./GenerateToDriveButton";
import { setVerified, setChosenInvoice, returnToQueue, setLineItems } from "@/lib/quotes/actions";
import { LineItemsEditor } from "./LineItemsEditor";
import { EmailChips } from "./EmailChips";
import { cleanServiceLabel, formatRate, formatRefreshedET } from "@/lib/quotes/format";
import { canGenerateToDrive, isGenerated, isStaleGenerated, quoteDisplayStatus } from "@/lib/quotes/bulk";
import { AlertTriangle, CheckCircle2, CornerUpLeft, ExternalLink, RotateCw, X } from "lucide-react";

function EmailBubbles({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-1 w-6 shrink-0 font-mono text-[10px] text-muted">{label}</span>
      <EmailChips value={value} />
    </div>
  );
}

const sectionHd = "mb-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted";

/**
 * SOW value clamped to 2 lines. The "see more"/"see less" toggle only appears
 * when the text actually overflows the clamp (measured), and clicking the text
 * itself expands/collapses it.
 */
function SowField({ value }: { value: string | null }) {
  const text = value ?? "—";
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const expandedRef = useRef(false);
  // Mirror `expanded` for the ResizeObserver callback (refs must not be written during render).
  useEffect(() => { expandedRef.current = expanded; }, [expanded]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Only measure while clamped, so expanding doesn't make it read as "fits".
    const check = () => {
      if (expandedRef.current) return;
      setOverflowing(el.scrollHeight > el.clientHeight + 1);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);

  return (
    <div>
      <span className="font-mono text-[11px] text-muted">SOW</span>
      <div
        ref={ref}
        onClick={() => overflowing && setExpanded((e) => !e)}
        title={overflowing ? (expanded ? "Click to collapse" : "Click to expand") : undefined}
        className={`${overflowing ? "cursor-pointer" : ""} ${expanded ? "" : "line-clamp-2"}`}
      >
        {text}
      </div>
      {overflowing && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-0.5 text-[11px] font-semibold text-gold hover:underline"
        >
          {expanded ? "see less" : "see more"}
        </button>
      )}
    </div>
  );
}

export function TaskDetail({ row, options, directory, productServiceValues = [], onClose, onGenerated }: { row: QuoteRow | null; options: InvoiceOption[]; directory: DirectoryRow[]; productServiceValues?: string[]; onClose?: () => void; onGenerated?: (taskDid: string) => void }) {
  const [pending, start] = useTransition();
  if (!row) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center rounded-2xl border border-rule bg-card text-sm text-muted">
        Select a task to see its details.
      </div>
    );
  }
  const taskDid = row.task_did;
  const segments = Array.from(
    new Set((row.asset_id ?? "").split("/").map((s) => s.trim()).filter(Boolean)),
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-rule bg-card shadow-[0_14px_40px_-26px_rgba(33,28,20,0.5)]">
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {/* header */}
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-display text-[26px] leading-tight tracking-[-0.02em]">{row.asset_name}</h2>
              <StatusBadge status={quoteDisplayStatus(row)} />
            </div>
            <div className="mt-1 text-[12.5px] text-muted">{row.task_name} · {row.task_status}</div>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {canGenerateToDrive(row) && <GenerateToDriveButton taskDid={taskDid} onGenerated={onGenerated} />}
            {row.status !== "no_match" && row.inv_service_rate && <QuotePreview row={row} />}
            {onClose && (
              <button
                onClick={onClose}
                title="Close panel"
                aria-label="Close panel"
                className="grid h-7 w-7 place-items-center rounded-md border border-rule-strong text-muted transition-colors hover:border-gold hover:text-ink"
              >
                <X size={15} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
        <div className="mt-1.5 break-all font-mono text-[11px] text-muted-soft" title="Asset Site ID path">
          {row.asset_id ?? "—"}
        </div>

        {/* generated banner */}
        {isGenerated(row) && (
          <div className={`mt-3 flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[12px] ${
            isStaleGenerated(row) ? "bg-gold-wash text-amber" : "bg-moss-wash text-moss"
          }`}>
            <span className="flex min-w-0 items-center gap-1.5">
              {isStaleGenerated(row) ? <RotateCw size={14} /> : <CheckCircle2 size={14} />}
              <span className="truncate">
                {isStaleGenerated(row) ? "Edited since generated — regenerate. " : ""}
                Generated {formatRefreshedET(row.generated_at)}{row.generated_by ? ` by ${row.generated_by}` : ""}
              </span>
            </span>
            <div className="flex shrink-0 items-center gap-2">
              {row.drive_link && (
                <a href={row.drive_link} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold underline-offset-2 hover:underline">
                  <ExternalLink size={12} /> Open in Drive
                </a>
              )}
              <button
                onClick={() => start(() => { void returnToQueue(taskDid); })}
                disabled={pending}
                title="Delete the Drive PDF and return this entry to the queue for a fix"
                className="inline-flex items-center gap-1 rounded border border-current/30 px-2 py-1 text-[11px] hover:bg-card disabled:opacity-50"
              >
                <CornerUpLeft size={12} /> Return to queue
              </button>
            </div>
          </div>
        )}

        {/* review / verified banner */}
        {row.needs_review_base && (row.needs_review ? (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-gold-wash px-2.5 py-1.5 text-[12px] text-amber">
            <span className="flex items-center gap-2">
              <AlertTriangle size={14} /> Parsed columns may be unreliable for this path — verify.
            </span>
            <button
              onClick={() => start(() => { void setVerified(taskDid, true); })}
              disabled={pending}
              className="shrink-0 rounded bg-moss px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              ✓ Mark Verified
            </button>
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-moss-wash px-2.5 py-1.5 text-[12px] text-moss">
            <span>✓ Verified{row.verified_by ? ` by ${row.verified_by}` : ""}</span>
            <button
              onClick={() => start(() => { void setVerified(taskDid, false); })}
              disabled={pending}
              className="shrink-0 rounded border border-moss/40 px-2 py-1 text-[11px] hover:bg-card disabled:opacity-50"
            >
              Undo
            </button>
          </div>
        ))}

        {/* editable category chips */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          <EditableChip taskDid={row.task_did} field="subcon"  label="Subcon"  value={row.subcon}  overridden={row.subcon_overridden}  segments={segments} />
          <EditableChip taskDid={row.task_did} field="gc"      label="GC"      value={row.gc}      overridden={row.gc_overridden}      segments={segments} />
          <EditableChip taskDid={row.task_did} field="carrier" label="Carrier" value={row.carrier} overridden={row.carrier_overridden} segments={segments} />
          <EditableChip taskDid={row.task_did} field="market"  label="Market"  value={row.market}  overridden={row.market_overridden}  segments={segments} />
          <EditableChip taskDid={row.task_did} field="project" label="Project" value={row.project} overridden={row.project_overridden} segments={segments} />
          <EditableChip taskDid={row.task_did} field="fuze_id" label="Project ID" value={row.fuze_id} overridden={row.fuze_id_overridden} segments={segments} />
        </div>
        {row.override_by && (
          <div className="mt-2 text-[10.5px] text-muted-soft">● manually edited by {row.override_by}</div>
        )}

        {/* invoicing-form line */}
        <div className="mt-5 border-t border-rule pt-4">
          <div className={sectionHd}>Invoicing-form line</div>
          {row.status === "no_match" ? (
            <div className="text-sm text-muted">No invoicing-form entry matched this site.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {!(row.line_items && row.line_items.length) && (
                  <ProductServiceEditor taskDid={taskDid} value={row.inv_product_service} overridden={row.product_service_overridden} values={productServiceValues} />
                )}
                {row.inv_product_service_type && (
                  <span className="rounded-full bg-signal-wash px-2 py-0.5 font-mono text-[10px] font-semibold text-signal">
                    {row.inv_product_service_type}
                  </span>
                )}
              </div>
              {row.line_items && row.line_items.length > 0 ? (
                <LineItemsEditor
                  taskDid={taskDid}
                  items={row.line_items}
                  invoiceOptions={options}
                  productServiceValues={productServiceValues}
                />
              ) : (
                <>
                  {row.priced_line_count > 1 && !row.invoice_chosen ? (
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-gold-wash px-2.5 py-1.5 text-[12px] font-semibold text-amber">
                      {row.priced_line_count} priced lines, choose one below to set the price
                    </div>
                  ) : (
                    <div className="mt-3">
                      <RateEditor taskDid={taskDid} value={row.inv_service_rate} overridden={row.service_rate_overridden} />
                    </div>
                  )}
                  <button
                    onClick={() => start(() => { void setLineItems(taskDid, [
                      { product: row.inv_product_service ?? "", qty: 1, rate: Number(String(row.inv_service_rate ?? "").replace(/[^0-9.]/g, "")) || 0 },
                    ]); })}
                    disabled={pending}
                    className="mt-2 text-[11px] text-signal hover:underline disabled:opacity-50"
                  >
                    + add line items (multi-line quote)
                  </button>
                </>
              )}
              <div className="mt-3.5 space-y-2.5 text-[12.5px] text-ink-soft">
                <div className="flex gap-2">
                  <span className="shrink-0 font-mono text-[11px] text-muted">Site ID</span>
                  <span className="break-all font-mono text-[11.5px]">{row.inv_site_id ?? "—"}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4">
                  <div><span className="font-mono text-[11px] text-muted">Project</span><br />{row.inv_project ?? "—"}</div>
                  <div><span className="font-mono text-[11px] text-muted">Req status</span><br />{row.inv_requirement_status ?? "—"}</div>
                </div>
                <SowField key={taskDid} value={row.inv_sow} />
              </div>
              <div className="mt-2 font-mono text-[10px] text-muted-soft">PM form: {row.inv_form_did ?? "—"}</div>

              {row.priced_line_count > 1 && options.length > 1 && (
                <div className="mt-4 border-t border-rule pt-3">
                  <div className={sectionHd}>{options.length} priced lines — choose which to use</div>
                  <div className="flex flex-col gap-1.5">
                    {options.map((o) => {
                      const isActive = row.chosen_line_key === o.line_key;
                      return (
                        <button
                          key={o.line_key}
                          onClick={() => start(() => { void setChosenInvoice(taskDid, isActive ? null : o.line_key); })}
                          disabled={pending}
                          className={`rounded-lg border px-2.5 py-1.5 text-left text-[12px] disabled:opacity-50 ${
                            isActive ? "border-moss bg-moss-wash" : "border-rule hover:border-gold"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-semibold text-signal">{formatRate(o.service_rate)}</span>
                            {isActive && <span className="text-[10px] font-semibold text-moss">✓ chosen</span>}
                          </div>
                          <div>{cleanServiceLabel(o.product_service)}</div>
                          <div className="text-[11px] text-muted">{(o.project ?? "—")} · {(o.requirement_status ?? "—")}</div>
                        </button>
                      );
                    })}
                  </div>
                  {row.invoice_chosen && (
                    <button
                      onClick={() => start(() => { void setChosenInvoice(taskDid, null); })}
                      disabled={pending}
                      className="mt-1.5 text-[11px] text-muted hover:text-gold disabled:opacity-50"
                    >
                      ↺ clear choice (use default)
                    </button>
                  )}
                </div>
              )}
              {row.status === "no_price" && (
                <div className="mt-2 text-[12px] text-amber">Matched, but no Service Rate yet.</div>
              )}
            </>
          )}
        </div>

        {/* recipients */}
        <div className="mt-5 border-t border-rule pt-4">
          <div className={sectionHd}>Quote recipients · directory</div>
          {!row.directory_matched ? (
            <div className="text-[12px] text-amber">
              No Quote Directory match for {(row.gc ?? "—")} · {(row.carrier ?? "—")} · {(row.market ?? "—")} · {(row.project ?? "—")} — add it in the directory.
            </div>
          ) : row.directory_conflict ? (
            <div className="text-[12px] text-ember">
              ⚠ The directory has conflicting recipients for {(row.gc ?? "—")} · {(row.carrier ?? "—")} · {(row.market ?? "—")} · {(row.project ?? "—")} — resolve it in the Quote Directory.
            </div>
          ) : (
            <div className="space-y-1.5">
              <EmailBubbles label="To" value={row.quote_recipient} />
              <EmailBubbles label="CC" value={row.quote_cc} />
            </div>
          )}
          <RecipientAssigner key={row.task_did} row={row} directory={directory} />
        </div>
      </div>
    </div>
  );
}
