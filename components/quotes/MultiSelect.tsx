"use client";
import { useEffect, useRef, useState, type MouseEvent } from "react";

interface Opt {
  value: string;
  label: string;
}

interface Props {
  options: Opt[];
  selected: string[];
  onChange: (vals: string[]) => void;
  placeholder?: string;
}

export function MultiSelect({ options, selected, onChange, placeholder = "All" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click WITHOUT a full-screen overlay, so a click meant for
  // another control lands on it in one go (matches native <select> behaviour).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const summary =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? selected[0]
        : `${selected.length} selected`;

  const onOptClick = (e: MouseEvent, v: string) => {
    const multi = e.ctrlKey || e.metaKey || selected.length > 0;
    if (multi) {
      e.preventDefault();
      onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
    } else {
      onChange([v]);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-1 text-sm px-2 py-1.5 rounded-md border border-rule-strong bg-paper hover:border-gold"
      >
        <span className={`truncate ${selected.length ? "" : "text-muted"}`}>{summary}</span>
        <span className="text-muted-soft shrink-0">▾</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 left-0 w-full max-h-60 overflow-y-auto rounded-md border border-rule-strong bg-card shadow-[0_18px_40px_-18px_rgba(33,28,20,0.5)] text-[12px]">
          <div className="px-2 py-1 text-[10px] text-muted-soft border-b border-rule">
            Ctrl/Cmd-click to pick several
          </div>
          <button
            type="button"
            onClick={() => { onChange([]); setOpen(false); }}
            className="flex w-full items-center gap-1 px-2 py-1 text-left text-muted hover:bg-gold-wash"
          >
            <span className="w-3 shrink-0" />
            <span className="min-w-0 truncate">{placeholder}</span>
          </button>
          {options.map((o) => {
            const sel = selected.includes(o.value);
            return (
              <button
                type="button"
                key={o.value}
                title={o.label}
                onClick={(e) => onOptClick(e, o.value)}
                className={`flex w-full items-center gap-1 px-2 py-1 text-left hover:bg-gold-wash ${sel ? "bg-gold-wash" : ""}`}
              >
                <span className="w-3 shrink-0 text-gold">{sel ? "✓" : ""}</span>
                <span className="min-w-0 truncate">{o.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
