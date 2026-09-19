"use client";
import { useState, useTransition } from "react";
import { setLineItems } from "@/lib/quotes/actions";
import { money } from "@/lib/quotes/quote-model";
import { cleanServiceLabel } from "@/lib/quotes/format";
import type { InvoiceOption, QuoteLineItem } from "@/lib/quotes/types";

const toNum = (v: string) => Number(v.replace(/[^0-9.]/g, "")) || 0;
const lineTotal = (xs: QuoteLineItem[]) => xs.reduce((s, li) => s + (li.qty || 0) * (li.rate || 0), 0);

/**
 * Multi-line quote items. Opens in a read-only summary of the saved lines with an
 * "edit" button; editing stages changes locally and saves as a unit via
 * setLineItems, then collapses back to the summary. "revert to single line"
 * clears back to null (single-line quote).
 */
export function LineItemsEditor({ taskDid, items, invoiceOptions, productServiceValues }: {
  taskDid: string;
  items: QuoteLineItem[];
  invoiceOptions: InvoiceOption[];
  productServiceValues: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<QuoteLineItem[]>(items);
  const [pending, start] = useTransition();
  const listId = `li-ps-${taskDid}`;

  const set = (i: number, patch: Partial<QuoteLineItem>) =>
    setDraft((d) => d.map((li, idx) => (idx === i ? { ...li, ...patch } : li)));
  const removeAt = (i: number) => setDraft((d) => d.filter((_, idx) => idx !== i));
  const addCustom = () => setDraft((d) => [...d, { product: "", qty: 1, rate: 0 }]);
  const addInvoice = (o: InvoiceOption) =>
    setDraft((d) => [...d, { product: o.product_service ?? "", qty: 1, rate: toNum(String(o.service_rate ?? "")) }]);

  const beginEdit = () => { setDraft(items); setEditing(true); };
  const cancel = () => { setDraft(items); setEditing(false); };
  const save = () => start(async () => { await setLineItems(taskDid, draft); setEditing(false); });
  const revert = () => start(async () => { await setLineItems(taskDid, null); });

  // ---- Display (collapsed) mode: a read-only preview of the saved lines ----
  if (!editing) {
    return (
      <div className="mt-3 rounded-lg border border-rule bg-paper-deep p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Quote line items</span>
          <span className="text-[12px] font-semibold">Total {money(lineTotal(items))}</span>
        </div>
        <div className="flex flex-col gap-1">
          {items.map((li, i) => (
            <div key={i} className="flex items-center gap-2 text-[12px]">
              <span className="w-5 text-[11px] text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate" title={cleanServiceLabel(li.product)}>{cleanServiceLabel(li.product)}</span>
              <span className="shrink-0 text-muted tabular-nums">{li.qty} x {money(li.rate)}</span>
              <span className="w-20 shrink-0 text-right tabular-nums">{money((li.qty || 0) * (li.rate || 0))}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <button onClick={beginEdit} className="text-[11px] font-semibold text-signal hover:underline">edit</button>
          <span className="flex-1" />
          <button onClick={revert} disabled={pending}
            className="text-[11px] text-muted hover:text-signal disabled:opacity-50">↺ revert to single line</button>
        </div>
      </div>
    );
  }

  // ---- Edit mode: the builder ----
  return (
    <div className="mt-3 rounded-lg border border-rule bg-paper-deep p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Quote line items</span>
        <span className="text-[12px] font-semibold">Total {money(lineTotal(draft))}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        {draft.map((li, i) => (
          <div key={i} className="flex flex-wrap items-center gap-1.5">
            <span className="w-5 text-[11px] text-muted">{i + 1}</span>
            <input list={listId} value={li.product} placeholder="Product / Service"
              onChange={(e) => set(i, { product: e.target.value })}
              className="min-w-[220px] flex-1 rounded border border-rule bg-input px-2 py-1 text-[12px]" />
            <input type="number" min={1} value={li.qty} title="Qty"
              onChange={(e) => set(i, { qty: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
              className="w-14 rounded border border-rule bg-input px-2 py-1 text-[12px]" />
            <span className="text-muted">$</span>
            <input value={String(li.rate)} title="Rate" placeholder="0.00"
              onChange={(e) => set(i, { rate: toNum(e.target.value) })}
              className="w-24 rounded border border-rule bg-input px-2 py-1 text-[12px]" />
            <span className="w-20 text-right text-[12px] tabular-nums">{money((li.qty || 0) * (li.rate || 0))}</span>
            <button onClick={() => removeAt(i)} className="text-[11px] text-muted hover:text-ember" title="Remove">remove</button>
          </div>
        ))}
      </div>
      <datalist id={listId}>
        {productServiceValues.map((v) => <option key={v} value={v} />)}
      </datalist>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button onClick={addCustom} className="rounded border border-rule bg-input px-2 py-1 text-[11px] hover:border-signal">+ custom line</button>
        {invoiceOptions.length > 0 && (
          <select defaultValue="" onChange={(e) => { const o = invoiceOptions.find((x) => x.line_key === e.target.value); if (o) addInvoice(o); e.target.value = ""; }}
            className="w-36 truncate rounded border border-rule bg-input px-2 py-1 text-[11px]">
            <option value="">+ add invoice line</option>
            {invoiceOptions.map((o) => <option key={o.line_key} value={o.line_key}>{o.product_service} ({o.service_rate})</option>)}
          </select>
        )}
        <span className="flex-1" />
        <button onClick={save} disabled={pending}
          className="rounded bg-moss px-2.5 py-1 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50">Save lines</button>
        <button onClick={cancel} disabled={pending}
          className="text-[11px] text-muted hover:text-signal disabled:opacity-50">Cancel</button>
        <button onClick={revert} disabled={pending}
          className="text-[11px] text-muted hover:text-signal disabled:opacity-50">↺ revert to single line</button>
      </div>
    </div>
  );
}
