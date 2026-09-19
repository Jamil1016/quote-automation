"use client";
import { useCallback, useMemo, useState } from "react";

/**
 * Column definition for the spreadsheet-style sort/filter tables.
 * `get` returns the raw value used for sorting, filtering, and distinct-value
 * lists. Display rendering stays in each table's own cells.
 */
export type ColDef<T> = {
  key: string;
  label: string;
  get: (row: T) => string | number | null | undefined;
  /** Columns that hold no data (e.g. an actions column) opt out of sort/filter. */
  noControls?: boolean;
};

export type SortState = { key: string; dir: "asc" | "desc" } | null;

/** "(blank)" sentinel shown for empty values in the filter checkbox list. */
export const BLANK = "(blank)";

const norm = (v: string | number | null | undefined): string =>
  v == null || v === "" ? "" : String(v);

/** Excel-style autofilter + sort over an in-memory row set. */
export function useColumnFilters<T>(rows: T[], cols: ColDef<T>[]) {
  const [sort, setSort] = useState<SortState>(null);
  // key -> the set of INCLUDED values (string form; "" shown as BLANK). A key
  // absent from this map means "no filter on that column" (all values shown).
  const [filters, setFilters] = useState<Record<string, Set<string>>>({});

  const colByKey = useMemo(
    () => Object.fromEntries(cols.map((c) => [c.key, c])) as Record<string, ColDef<T>>,
    [cols],
  );

  /**
   * Distinct values for a column, sorted naturally; "" surfaced as BLANK.
   * Cascades like Excel: the candidate list reflects rows passing every OTHER
   * column's active filter, so once GC is filtered, Carrier/Market/etc. only
   * offer values that still exist within that GC selection. The column's own
   * filter is excluded so you can still see and re-check its values.
   */
  const distinct = useCallback(
    (key: string): string[] => {
      const c = colByKey[key];
      if (!c) return [];
      let base = rows;
      for (const [k, inc] of Object.entries(filters)) {
        if (k === key) continue;
        const cc = colByKey[k];
        if (!cc) continue;
        base = base.filter((r) => inc.has(norm(cc.get(r)) || BLANK));
      }
      const set = new Set<string>();
      for (const r of base) set.add(norm(c.get(r)) || BLANK);
      return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    },
    [rows, colByKey, filters],
  );

  const setColumnFilter = useCallback((key: string, included: Set<string> | null) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (included == null) delete next[key];
      else next[key] = included;
      return next;
    });
  }, []);

  /** Click a header to cycle that column: asc -> desc -> none. */
  const cycleSort = useCallback((key: string) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }, []);

  const processed = useMemo(() => {
    let out = rows;

    for (const [key, inc] of Object.entries(filters)) {
      const c = colByKey[key];
      if (!c) continue;
      out = out.filter((r) => inc.has(norm(c.get(r)) || BLANK));
    }

    if (sort) {
      const c = colByKey[sort.key];
      if (c) {
        const dir = sort.dir === "asc" ? 1 : -1;
        out = [...out].sort((a, b) => {
          const av = c.get(a);
          const bv = c.get(b);
          const as = norm(av);
          const bs = norm(bv);
          // empties sort last regardless of direction
          if (as === "" && bs === "") return 0;
          if (as === "") return 1;
          if (bs === "") return -1;
          const an = typeof av === "number" ? av : Number(as.replace(/[^0-9.\-]/g, ""));
          const bn = typeof bv === "number" ? bv : Number(bs.replace(/[^0-9.\-]/g, ""));
          const bothNum = Number.isFinite(an) && Number.isFinite(bn)
            && /\d/.test(as) && /\d/.test(bs)
            && /^[\s$€£,.\d-]+$/.test(as) && /^[\s$€£,.\d-]+$/.test(bs);
          if (bothNum) return (an - bn) * dir;
          return as.localeCompare(bs, undefined, { numeric: true }) * dir;
        });
      }
    }

    return out;
  }, [rows, filters, sort, colByKey]);

  return { sort, setSort, cycleSort, filters, setColumnFilter, distinct, processed };
}
