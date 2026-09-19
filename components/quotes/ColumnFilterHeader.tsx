"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, Filter, Check } from "lucide-react";
import type { ColDef, SortState } from "@/lib/quotes/useColumnFilters";

/**
 * Spreadsheet-style column header: click the label to cycle sort
 * (asc -> desc -> none), or open the funnel for Sort A->Z / Z->A plus a
 * searchable checkbox list of the column's distinct values (Excel autofilter).
 * The popover is fixed-positioned so it isn't clipped by the table's overflow.
 */
export function ColumnFilterHeader<T>({
  col,
  sort,
  onCycleSort,
  onSetSort,
  distinct,
  active,
  onApply,
  className = "",
  width,
  onResize,
}: {
  col: ColDef<T>;
  sort: SortState;
  onCycleSort: (key: string) => void;
  onSetSort: (s: SortState) => void;
  distinct: string[];
  active: Set<string> | undefined;
  onApply: (included: Set<string> | null) => void;
  className?: string;
  width?: number;
  onResize?: (key: string, width: number) => void;
}) {
  const thRef = useRef<HTMLTableCellElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Excel-style drag-to-resize on the right edge of the header cell.
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = width ?? thRef.current?.offsetWidth ?? 150;
    const onMove = (ev: MouseEvent) => {
      onResize?.(col.key, Math.max(60, Math.round(startW + (ev.clientX - startX))));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  // Double-click the handle to auto-fit the column to its widest content
  // (Excel-style). Truncated cells still report full width via scrollWidth.
  const autoFit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const th = thRef.current;
    const table = th?.closest("table");
    if (!th || !table || !onResize) return;
    const idx = th.cellIndex;
    let max = (th.firstElementChild as HTMLElement | null)?.scrollWidth ?? 0; // header content
    table.querySelectorAll("tbody tr").forEach((row) => {
      const cell = (row as HTMLTableRowElement).cells[idx];
      if (cell) max = Math.max(max, cell.scrollWidth);
    });
    onResize(col.key, Math.min(800, Math.max(60, max + 24))); // +padding/icons, capped
  };
  const popRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Set<string>>(new Set());

  const sorted = sort?.key === col.key ? sort.dir : null;
  // A filter is "active" only if it actually excludes some currently-available
  // value (distinct cascades with other filters, so compare by membership).
  const isActive = !!active && active.size > 0 && !distinct.every((v) => active.has(v));

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = 240;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    setPos({ top: r.bottom + 4, left });
  };

  const openMenu = () => {
    // start from the active filter, or "all checked" when none is set
    setDraft(new Set(active ?? distinct));
    setSearch("");
    place();
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open) return;
    const onScrollResize = () => place();
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);
    return () => {
      window.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
    };
     
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const visible = search
    ? distinct.filter((v) => v.toLowerCase().includes(search.toLowerCase()))
    : distinct;

  const toggle = (v: string) =>
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });

  const allVisibleChecked = visible.length > 0 && visible.every((v) => draft.has(v));
  const toggleAllVisible = () =>
    setDraft((prev) => {
      const next = new Set(prev);
      if (allVisibleChecked) visible.forEach((v) => next.delete(v));
      else visible.forEach((v) => next.add(v));
      return next;
    });

  const apply = () => {
    // every available value checked == no filter on this column
    if (distinct.length > 0 && distinct.every((v) => draft.has(v))) onApply(null);
    else onApply(new Set(draft));
    setOpen(false);
  };
  const clear = () => {
    onApply(null);
    setOpen(false);
  };

  return (
    <th ref={thRef} className={className} style={width ? { width, maxWidth: width } : undefined}>
      <div className="flex items-center gap-1 min-w-0">
        <button
          type="button"
          onClick={() => onCycleSort(col.key)}
          className="inline-flex min-w-0 items-center gap-0.5 hover:text-signal"
          title={`${col.label} — click to sort`}
        >
          <span className="truncate">{col.label}</span>
          {sorted === "asc" ? (
            <ChevronUp size={12} className="shrink-0 text-signal" />
          ) : sorted === "desc" ? (
            <ChevronDown size={12} className="shrink-0 text-signal" />
          ) : (
            <ChevronsUpDown size={11} className="shrink-0 opacity-30" />
          )}
        </button>
        <button
          ref={btnRef}
          type="button"
          onClick={() => (open ? setOpen(false) : openMenu())}
          className={`shrink-0 rounded p-0.5 hover:bg-rule/40 ${isActive ? "text-signal" : "opacity-40 hover:opacity-100"}`}
          title="Sort & filter"
        >
          <Filter size={11} fill={isActive ? "currentColor" : "none"} />
        </button>
      </div>
      {onResize && (
        <div
          onMouseDown={startResize}
          onDoubleClick={autoFit}
          onClick={(e) => e.stopPropagation()}
          title="Drag to resize · double-click to fit"
          className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize select-none hover:bg-signal/50"
        />
      )}

      {open && (
        <div
          ref={popRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: 240 }}
          className="z-50 rounded-md border border-rule bg-card shadow-lg text-ink font-normal"
        >
          <div className="flex flex-col p-1 border-b border-rule">
            <button
              type="button"
              onClick={() => { onSetSort({ key: col.key, dir: "asc" }); setOpen(false); }}
              className="flex items-center gap-2 px-2 py-1 text-[12px] rounded hover:bg-signal-wash text-left"
            >
              <ChevronUp size={13} /> Sort A → Z
            </button>
            <button
              type="button"
              onClick={() => { onSetSort({ key: col.key, dir: "desc" }); setOpen(false); }}
              className="flex items-center gap-2 px-2 py-1 text-[12px] rounded hover:bg-signal-wash text-left"
            >
              <ChevronDown size={13} /> Sort Z → A
            </button>
          </div>

          <div className="p-1.5">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search values"
              className="w-full text-[12px] px-2 py-1 rounded border border-rule bg-input mb-1"
            />
            <label className="flex items-center gap-2 px-1 py-1 text-[12px] font-medium cursor-pointer select-none border-b border-rule/60">
              <input type="checkbox" className="accent-signal" checked={allVisibleChecked} onChange={toggleAllVisible} />
              (Select all{search ? " matching" : ""})
            </label>
            <div className="max-h-48 overflow-auto py-1">
              {visible.length === 0 && <div className="px-2 py-1 text-[11px] text-muted">No values</div>}
              {visible.map((v) => (
                <label key={v} className="flex items-center gap-2 px-1 py-0.5 text-[12px] cursor-pointer select-none hover:bg-signal-wash rounded">
                  <input type="checkbox" className="accent-signal" checked={draft.has(v)} onChange={() => toggle(v)} />
                  <span className="truncate" title={v}>{v}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 p-1.5 border-t border-rule">
            <button type="button" onClick={clear} className="text-[12px] text-muted hover:text-signal px-2 py-1">
              Clear
            </button>
            <button type="button" onClick={apply} className="inline-flex items-center gap-1 text-[12px] font-semibold text-white bg-signal rounded px-3 py-1 hover:bg-signal-deep">
              <Check size={12} /> Apply
            </button>
          </div>
        </div>
      )}
    </th>
  );
}
