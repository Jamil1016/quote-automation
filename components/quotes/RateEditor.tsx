"use client";
import { useState, useTransition } from "react";
import { setServiceRate } from "@/lib/quotes/actions";
import { formatRate } from "@/lib/quotes/format";

export function RateEditor({ taskDid, value, overridden }: { taskDid: string; value: string | null; overridden: boolean }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? "");
  const [pending, start] = useTransition();

  if (!editing) {
    return (
      <div className="mt-1 flex items-center gap-2">
        <span className="font-mono text-2xl text-signal-deep">{formatRate(value)}</span>
        {overridden && <span className="text-[10px] font-semibold text-signal" title="manually set">● edited</span>}
        <button onClick={() => { setVal(value ?? ""); setEditing(true); }} className="text-[11px] text-signal hover:underline">edit</button>
      </div>
    );
  }
  return (
    <div className="mt-1 flex items-center gap-1 flex-wrap">
      <span className="text-muted">$</span>
      <input
        autoFocus
        className="w-24 text-sm px-2 py-1 rounded border border-rule bg-input"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="585.00"
      />
      <button
        onClick={() => start(async () => { await setServiceRate(taskDid, val); setEditing(false); })}
        disabled={pending}
        className="text-[11px] font-semibold text-white bg-moss rounded px-2 py-1 hover:opacity-90 disabled:opacity-50"
      >
        Save
      </button>
      <button onClick={() => setEditing(false)} disabled={pending} className="text-[11px] text-muted hover:text-signal">Cancel</button>
      {overridden && (
        <button
          onClick={() => start(async () => { await setServiceRate(taskDid, null); setEditing(false); })}
          disabled={pending}
          className="text-[11px] text-muted hover:text-signal"
        >
          ↺ auto
        </button>
      )}
    </div>
  );
}
