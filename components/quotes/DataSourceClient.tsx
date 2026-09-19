"use client";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import type { AssetTaskRow, SourceInvoiceRow } from "@/lib/quotes/types";
import { downloadCsv } from "@/lib/quotes/csv";
import { useColumnFilters, type ColDef } from "@/lib/quotes/useColumnFilters";
import { ColumnFilterHeader } from "./ColumnFilterHeader";

type Tab = "tasks" | "invoicing";

// tokenized AND search over a row's stringified values
function makeFilter<T extends object>(query: string) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter((t) => /[a-z0-9]/.test(t));
  return (row: T) => {
    if (!terms.length) return true;
    const hay = Object.values(row as Record<string, unknown>).map((v) => (v == null ? "" : String(v)).toLowerCase()).join(" ");
    return terms.every((t) => hay.includes(t));
  };
}

const TASK_COLS: { key: keyof AssetTaskRow; label: string }[] = [
  { key: "org_name", label: "Organization" },
  { key: "project_name", label: "Project" },
  { key: "asset_name", label: "Asset Name" },
  { key: "asset_id", label: "Asset Id" },
  { key: "task_name", label: "Task Name" },
  { key: "subcon", label: "Subcon" },
  { key: "gc", label: "GC" },
  { key: "carrier", label: "Carrier" },
  { key: "market", label: "Market" },
  { key: "project", label: "Scope" },
  { key: "fuze_id", label: "Project ID" },
];

const INV_COLS: { key: keyof SourceInvoiceRow; label: string }[] = [
  { key: "project", label: "Project" },
  { key: "site_name", label: "Site Name" },
  { key: "site_id", label: "Site ID" },
  { key: "sow", label: "Scope of Work (SOW)" },
  { key: "pricing_type", label: "Pricing Type" },
  { key: "service_type", label: "Service Type" },
  { key: "service_type_others", label: "Service Type (Others)" },
  { key: "service_rate", label: "Service Rate" },
  { key: "ll_cop", label: "LL COP to be handled by Example Co?" },
  { key: "landlord", label: "Landlord" },
  { key: "landlord_others", label: "Landlord (Others)" },
  { key: "pmi_cop", label: "PMI COP to be handled by Example Co?" },
  { key: "rf_mitigation_cop", label: "RF Mitigation COP to be handled by Example Co?" },
];

// Derive sort/filter column defs (a `get` accessor) from the CSV column lists.
const toColDefs = <T,>(cols: { key: keyof T; label: string }[]): ColDef<T>[] =>
  cols.map((c) => ({ key: String(c.key), label: c.label, get: (r: T) => r[c.key] as string | number | null }));
const TASK_COLDEFS = toColDefs(TASK_COLS);
const INV_COLDEFS = toColDefs(INV_COLS);

// Default column widths (px) — drag the header edge to resize, Excel-style.
const TASK_W: Record<string, number> = {
  org_name: 110, project_name: 130, asset_name: 240, asset_id: 300, task_name: 150,
  subcon: 130, gc: 130, carrier: 110, market: 150, project: 130, fuze_id: 110,
};
const INV_W: Record<string, number> = {
  project: 150, site_name: 200, site_id: 240, sow: 300, pricing_type: 130,
  service_type: 170, service_type_others: 160, service_rate: 110, ll_cop: 130,
  landlord: 150, landlord_others: 150, pmi_cop: 130, rf_mitigation_cop: 160,
};

export function DataSourceClient({ tasks, lines }: { tasks: AssetTaskRow[]; lines: SourceInvoiceRow[] }) {
  const [tab, setTab] = useState<Tab>("tasks");
  const [taskQ, setTaskQ] = useState("");
  const [invQ, setInvQ] = useState("");
  const [unpricedOnly, setUnpricedOnly] = useState(false);

  // global search first, then per-column sort/filter via the hook
  const searchedTasks = useMemo(() => tasks.filter(makeFilter<AssetTaskRow>(taskQ)), [tasks, taskQ]);
  const searchedLines = useMemo(() => {
    const f = makeFilter<SourceInvoiceRow>(invQ);
    return lines.filter((r) => f(r) && (!unpricedOnly || !r.priced));
  }, [lines, invQ, unpricedOnly]);

  const taskCtl = useColumnFilters(searchedTasks, TASK_COLDEFS);
  const invCtl = useColumnFilters(searchedLines, INV_COLDEFS);
  const shownTasks = taskCtl.processed;
  const shownLines = invCtl.processed;

  // tasks that have no referencing invoice row at all (no_match)
  const matchedTaskDids = useMemo(() => new Set(lines.map((l) => l.task_did)), [lines]);
  const unmatchedCount = tasks.filter((t) => !matchedTaskDids.has(t.task_did)).length;
  const unpricedCount = lines.filter((l) => !l.priced).length;

  // resizable column widths (Excel-style)
  const [taskW, setTaskW] = useState<Record<string, number>>(TASK_W);
  const [invW, setInvW] = useState<Record<string, number>>(INV_W);
  const resizeTask = (k: string, w: number) => setTaskW((p) => ({ ...p, [k]: w }));
  const resizeInv = (k: string, w: number) => setInvW((p) => ({ ...p, [k]: w }));
  const taskTotal = TASK_COLDEFS.reduce((s, c) => s + (taskW[c.key] ?? 150), 0);
  const invTotal = INV_COLDEFS.reduce((s, c) => s + (invW[c.key] ?? 150), 0);

  const th = "relative px-2 py-1 font-semibold text-left sticky top-0 bg-paper-deep";
  const td = "px-2 py-1 align-top truncate";

  const tabBtn = (id: Tab, label: string, count: number) => (
    <button
      onClick={() => setTab(id)}
      className={`rounded-md px-3 py-1 border text-[12px] font-semibold transition ${
        tab === id ? "bg-signal text-white border-signal" : "bg-card text-ink border-rule hover:border-signal"
      }`}
    >
      {label} <span className={tab === id ? "opacity-80" : "text-muted"}>· {count}</span>
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-rule bg-card">
      <div className="shrink-0 flex justify-between items-start px-4 py-2.5 border-b border-rule bg-card-2 gap-3">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">
          Data Source · source behind the worklist · invoicing rows shown are only those referencing a Quote-Provided asset task
        </div>
      </div>

      {/* sub-toggle between the two tables */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-rule">
        {tabBtn("tasks", "Asset Tasks", tasks.length)}
        {tabBtn("invoicing", "Invoicing Rows", lines.length)}
      </div>

      {tab === "tasks" ? (
        <>
          <div className="shrink-0 flex items-center gap-2 p-2 border-b border-rule">
            <input
              className="flex-1 text-sm px-2 py-1 rounded border border-rule bg-input"
              placeholder="Search asset / task / status / FA / site ID"
              value={taskQ}
              onChange={(e) => setTaskQ(e.target.value)}
            />
            <span className="text-[11px] text-muted whitespace-nowrap">{shownTasks.length} of {tasks.length}</span>
            <button
              onClick={() => downloadCsv("asset_tasks.csv", TASK_COLS, shownTasks)}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-white bg-signal rounded px-2 py-1 hover:bg-signal-deep"
            >
              <Download size={13} /> CSV
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="text-[12px] border-collapse" style={{ tableLayout: "fixed", width: taskTotal, minWidth: "100%" }}>
              <colgroup>
                {TASK_COLDEFS.map((c) => (
                  <col key={c.key} style={{ width: taskW[c.key] ?? 150 }} />
                ))}
              </colgroup>
              <thead>
                <tr className="text-muted-soft">
                  {TASK_COLDEFS.map((c) => (
                    <ColumnFilterHeader
                      key={c.key}
                      col={c}
                      className={th}
                      width={taskW[c.key]}
                      onResize={resizeTask}
                      sort={taskCtl.sort}
                      onCycleSort={taskCtl.cycleSort}
                      onSetSort={taskCtl.setSort}
                      distinct={taskCtl.distinct(c.key)}
                      active={taskCtl.filters[c.key]}
                      onApply={(s) => taskCtl.setColumnFilter(c.key, s)}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {shownTasks.map((r) => (
                  <tr key={r.task_did} className="border-t border-rule/60 hover:bg-card-2">
                    <td className={td}>{r.org_name ?? "—"}</td>
                    <td className={td}>{r.project_name ?? "—"}</td>
                    <td className={`${td} font-medium`}>{r.asset_name}</td>
                    <td className={`${td} text-muted max-w-[260px] truncate`} title={r.asset_id ?? ""}>{r.asset_id ?? "—"}</td>
                    <td className={td}>{r.task_name}</td>
                    <td className={td}>{r.subcon ?? "—"}</td>
                    <td className={td}>{r.gc ?? "—"}</td>
                    <td className={td}>{r.carrier ?? "—"}</td>
                    <td className={td}>{r.market ?? "—"}</td>
                    <td className={td}>{r.project ?? "—"}</td>
                    <td className={td}>{r.fuze_id ?? "—"}</td>
                  </tr>
                ))}
                {shownTasks.length === 0 && <tr><td colSpan={TASK_COLS.length} className="px-2 py-4 text-muted">No asset tasks match.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="shrink-0 flex flex-wrap items-center gap-2 p-2 border-b border-rule">
            <input
              className="flex-1 min-w-[200px] text-sm px-2 py-1 rounded border border-rule bg-input"
              placeholder="Search asset / product / status / project / form"
              value={invQ}
              onChange={(e) => setInvQ(e.target.value)}
            />
            <label className="inline-flex items-center gap-1.5 text-[12px] text-ink cursor-pointer select-none">
              <input type="checkbox" className="accent-signal" checked={unpricedOnly} onChange={(e) => setUnpricedOnly(e.target.checked)} />
              Unpriced only <span className="text-muted">({unpricedCount})</span>
            </label>
            <span className="text-[11px] text-muted whitespace-nowrap">{shownLines.length} of {lines.length}</span>
            <button
              onClick={() => downloadCsv("invoicing_rows.csv", INV_COLS, shownLines)}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-white bg-signal rounded px-2 py-1 hover:bg-signal-deep"
            >
              <Download size={13} /> CSV
            </button>
          </div>
          {unmatchedCount > 0 && (
            <div className="shrink-0 px-3 py-1.5 text-[11px] text-amber bg-amber/5 border-b border-amber/20">
              {unmatchedCount} worklist task{unmatchedCount === 1 ? "" : "s"} have no referencing invoice row (no match) — they won&apos;t appear below.
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="text-[12px] border-collapse" style={{ tableLayout: "fixed", width: invTotal, minWidth: "100%" }}>
              <colgroup>
                {INV_COLDEFS.map((c) => (
                  <col key={c.key} style={{ width: invW[c.key] ?? 150 }} />
                ))}
              </colgroup>
              <thead>
                <tr className="text-muted-soft">
                  {INV_COLDEFS.map((c) => (
                    <ColumnFilterHeader
                      key={c.key}
                      col={c}
                      className={th}
                      width={invW[c.key]}
                      onResize={resizeInv}
                      sort={invCtl.sort}
                      onCycleSort={invCtl.cycleSort}
                      onSetSort={invCtl.setSort}
                      distinct={invCtl.distinct(c.key)}
                      active={invCtl.filters[c.key]}
                      onApply={(s) => invCtl.setColumnFilter(c.key, s)}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {shownLines.map((r, i) => (
                  <tr key={`${r.task_did}-${i}`} className={`border-t border-rule/60 hover:bg-card-2 ${r.priced ? "" : "bg-amber/5"}`}>
                    <td className={td}>{r.project ?? "—"}</td>
                    <td className={`${td} font-medium`}>{r.site_name ?? "—"}</td>
                    <td className={`${td} text-muted max-w-[220px] truncate`} title={r.site_id ?? ""}>{r.site_id ?? "—"}</td>
                    <td className={`${td} text-muted max-w-[260px] truncate`} title={r.sow ?? ""}>{r.sow ?? "—"}</td>
                    <td className={td}>{r.pricing_type ?? "—"}</td>
                    <td className={td}>{r.service_type ?? "—"}</td>
                    <td className={td}>{r.service_type_others ?? "—"}</td>
                    <td className={td}>
                      {r.priced
                        ? r.service_rate
                        : <span className="text-[10px] font-semibold text-amber border border-amber/40 rounded px-1">no price</span>}
                    </td>
                    <td className={td}>{r.ll_cop ?? "—"}</td>
                    <td className={td}>{r.landlord ?? "—"}</td>
                    <td className={td}>{r.landlord_others ?? "—"}</td>
                    <td className={td}>{r.pmi_cop ?? "—"}</td>
                    <td className={td}>{r.rf_mitigation_cop ?? "—"}</td>
                  </tr>
                ))}
                {shownLines.length === 0 && <tr><td colSpan={INV_COLS.length} className="px-2 py-4 text-muted">No invoicing rows match.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
