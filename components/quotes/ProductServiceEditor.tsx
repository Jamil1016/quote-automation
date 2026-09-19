"use client";
import { useState, useTransition } from "react";
import { setProductService } from "@/lib/quotes/actions";
import { cleanServiceLabel } from "@/lib/quotes/format";

/**
 * Editable Product/Service for an invoicing-form line. Combobox: a free-text input
 * with a datalist of values used on other entries (type a new one or pick an
 * existing). Mirrors RateEditor. `values` is the live suggestion list from
 * getQuoteData, so it always reflects current data (including saved overrides).
 */
export function ProductServiceEditor({
  taskDid,
  value,
  overridden,
  values,
}: {
  taskDid: string;
  value: string | null;
  overridden: boolean;
  values: string[];
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? "");
  const [pending, start] = useTransition();
  const listId = `ps-list-${taskDid}`;

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-[14px] font-semibold">{cleanServiceLabel(value)}</span>
        {overridden && (
          <span className="text-[10px] font-semibold text-signal" title="manually set">● edited</span>
        )}
        <button
          onClick={() => { setVal(value ?? ""); setEditing(true); }}
          className="text-[11px] text-signal hover:underline"
        >
          edit
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <input
        autoFocus
        list={listId}
        className="w-72 max-w-full rounded border border-rule bg-input px-2 py-1 text-sm"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Product / Service"
      />
      <datalist id={listId}>
        {values.map((v) => <option key={v} value={v} />)}
      </datalist>
      <button
        onClick={() => start(async () => { await setProductService(taskDid, val); setEditing(false); })}
        disabled={pending}
        className="rounded bg-moss px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        Save
      </button>
      <button
        onClick={() => setEditing(false)}
        disabled={pending}
        className="text-[11px] text-muted hover:text-signal"
      >
        Cancel
      </button>
      {overridden && (
        <button
          onClick={() => start(async () => { await setProductService(taskDid, null); setEditing(false); })}
          disabled={pending}
          className="text-[11px] text-muted hover:text-signal"
        >
          ↺ auto
        </button>
      )}
    </span>
  );
}
