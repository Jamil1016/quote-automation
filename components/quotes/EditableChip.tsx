"use client";
import { useState, useTransition, type MouseEvent } from "react";
import { setOverride } from "@/lib/quotes/actions";

type Field = "subcon" | "gc" | "carrier" | "market" | "project" | "fuze_id";

interface Props {
  taskDid: string;
  field: Field;
  label: string;
  value: string | null;
  overridden: boolean;
  segments: string[];
}

const JOIN = " / ";

export function EditableChip({ taskDid, field, label, value, overridden, segments }: Props) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<number[]>([]); // indices, multi-select
  const [pending, start] = useTransition();

  const close = () => {
    setOpen(false);
    setPicked([]);
  };

  const save = (v: string | null) => {
    close();
    start(() => {
      void setOverride(taskDid, field, v);
    });
  };

  const onSegClick = (e: MouseEvent, i: number, s: string) => {
    const multi = e.ctrlKey || e.metaKey || picked.length > 0;
    if (multi) {
      e.preventDefault();
      const next = picked.includes(i) ? picked.filter((x) => x !== i) : [...picked, i];
      setPicked(next);
      // auto-save the combined value (path order); menu stays open to keep adding
      const combined = segments.filter((_, idx) => next.includes(idx)).join(JOIN);
      start(() => {
        void setOverride(taskDid, field, combined);
      });
    } else {
      save(s);
    }
  };

  return (
    <span className="relative inline-block m-0.5">
      <button
        onClick={() => (open ? close() : setOpen(true))}
        disabled={pending}
        title={overridden ? "Manually set — click to change" : "Click to set from a Site-ID segment"}
        className={`text-[11px] rounded px-2 py-0.5 border hover:border-signal ${
          overridden ? "border-signal bg-signal-wash" : "border-rule bg-input"
        } ${pending ? "opacity-50" : ""}`}
      >
        <span className="text-muted">{label}:</span> {value && value.length ? value : "—"}
        {overridden && <span className="text-signal"> ●</span>}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} />
          <div className="absolute z-20 mt-1 left-0 w-72 max-h-80 overflow-y-auto rounded border border-rule bg-card shadow-lg text-[12px]">
            <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-soft border-b border-rule">
              Set {label} from Site-ID · <span className="normal-case">Ctrl/Cmd-click to combine</span>
            </div>

            {segments.map((s, i) => {
              const sel = picked.includes(i);
              return (
                <button
                  key={i}
                  onClick={(e) => onSegClick(e, i, s)}
                  className={`block w-full text-left px-2 py-1 hover:bg-signal-wash ${
                    sel ? "bg-signal-wash" : ""
                  }`}
                >
                  <span className="inline-block w-3 text-signal">{sel ? "✓" : ""}</span>
                  {s}
                </button>
              );
            })}

            <button
              onClick={() => save("")}
              className="block w-full text-left px-2 py-1 hover:bg-signal-wash text-muted border-t border-rule"
            >
              (blank)
            </button>
            <button
              onClick={() => save(null)}
              className="block w-full text-left px-2 py-1 hover:bg-signal-wash text-muted"
            >
              ↺ auto (use parsed value)
            </button>
          </div>
        </>
      )}
    </span>
  );
}
