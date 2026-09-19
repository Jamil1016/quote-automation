"use client";
import { useState, useTransition } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";
import type { CategorySuggestions, DirectoryRow } from "@/lib/quotes/types";
import { EmailChips } from "./EmailChips";
import { EmailInput } from "./EmailInput";
import { ConfirmDialog } from "./ConfirmDialog";
import { upsertDirectoryEntry, deleteDirectoryEntry } from "@/lib/quotes/actions";
import { useColumnFilters, type ColDef } from "@/lib/quotes/useColumnFilters";
import { ColumnFilterHeader } from "./ColumnFilterHeader";

type Draft = { id?: number; gc: string; carrier: string; market: string; project: string; recipient: string; cc: string };
const blank: Draft = { gc: "", carrier: "", market: "", project: "", recipient: "", cc: "" };

const DIR_COLDEFS: ColDef<DirectoryRow>[] = [
  { key: "gc", label: "GC", get: (r) => r.gc },
  { key: "carrier", label: "Carrier", get: (r) => r.carrier },
  { key: "market", label: "Market", get: (r) => r.market },
  { key: "project", label: "Project", get: (r) => r.project },
  { key: "recipient", label: "Recipient", get: (r) => r.recipient },
  { key: "cc", label: "CC", get: (r) => r.cc },
];
const toDraft = (r: DirectoryRow): Draft => ({
  id: r.id, gc: r.gc ?? "", carrier: r.carrier ?? "", market: r.market ?? "",
  project: r.project ?? "", recipient: r.recipient ?? "", cc: r.cc ?? "",
});

// Default column widths (px) — drag a header edge to resize, double-click to fit.
const DIR_W: Record<string, number> = { gc: 150, carrier: 130, market: 150, project: 150, recipient: 280, cc: 280 };
const DIR_ACTIONS_W = 100;

export function DirectoryClient({ rows, suggestions }: { rows: DirectoryRow[]; suggestions: CategorySuggestions }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  const [pending, start] = useTransition();
  const [pendingDelete, setPendingDelete] = useState<DirectoryRow | null>(null);
  const [clashConfirm, setClashConfirm] = useState<{ draft: Draft; clash: DirectoryRow } | null>(null);

  // Tokenized AND search: every word must appear somewhere in the row. Punctuation-only
  // tokens (e.g. the "·" separators if a label is pasted in) are ignored, so searches like
  // "Northwind Builders · Carrier A · North Valley · 5G Upgrade" or just "northwind valley" both match.
  const terms = query.trim().toLowerCase().split(/\s+/).filter((t) => /[a-z0-9]/.test(t));
  const filtered = terms.length
    ? rows.filter((r) => {
        const hay = [r.gc, r.carrier, r.market, r.project, r.recipient, r.cc].map((v) => (v ?? "").toLowerCase()).join(" ");
        return terms.every((t) => hay.includes(t));
      })
    : rows;

  // per-column sort + Excel-style value filters over the search result
  const ctl = useColumnFilters(filtered, DIR_COLDEFS);
  const shown = ctl.processed;

  // resizable column widths (Excel-style)
  const [dirW, setDirW] = useState<Record<string, number>>(DIR_W);
  const resizeDir = (k: string, w: number) => setDirW((p) => ({ ...p, [k]: w }));

  // canonical normalized key (matches analytics.quote_norm: case + unify _/- + collapse ws)
  const normKey = (r: { gc: string | null; carrier: string | null; market: string | null; project: string | null }) =>
    [r.gc, r.carrier, r.market, r.project]
      .map((x) => (x ?? "").trim().replace(/[_\-]+/g, " ").replace(/\s+/g, " ").toUpperCase())
      .join("|");
  const canonEmails = (s: string | null) =>
    (s ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean).sort().join(",");
  const conflictKeys = (() => {
    const map = new Map<string, Set<string>>();
    for (const r of rows) {
      const k = normKey(r);
      if (!map.has(k)) map.set(k, new Set());
      map.get(k)!.add(`${canonEmails(r.recipient)}~~${canonEmails(r.cc)}`);
    }
    const s = new Set<string>();
    map.forEach((v, k) => { if (v.size > 1) s.add(k); });
    return s;
  })();

  const beginAdd = () => { setDraft(blank); setEditing("new"); };
  const beginEdit = (r: DirectoryRow) => { setDraft(toDraft(r)); setEditing(r.id); };
  const cancel = () => { setEditing(null); setDraft(blank); };
  const doSave = (d: Draft) => {
    start(async () => { await upsertDirectoryEntry(d); setEditing(null); setDraft(blank); setClashConfirm(null); });
  };
  const save = () => {
    const dk = normKey(draft);
    const clash = rows.find((r) => r.id !== draft.id && normKey(r) === dk);
    if (clash) { setClashConfirm({ draft, clash }); return; }
    doSave(draft);
  };
  const remove = (r: DirectoryRow) => setPendingDelete(r);
  const confirmRemove = () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    start(async () => { await deleteDirectoryEntry(id); setPendingDelete(null); });
  };

  const inp = "w-full text-[12px] px-1.5 py-1 rounded border border-rule bg-input";
  const cat = (field: keyof Draft, listId: string, ph: string) => (
    <input className={inp} list={listId} placeholder={ph} value={draft[field] as string}
      onChange={(e) => setDraft({ ...draft, [field]: e.target.value })} />
  );

  const EditCells = () => (
    <>
      <td className="px-2 py-1">{cat("gc", "dl-gc", "GC")}</td>
      <td className="px-2 py-1">{cat("carrier", "dl-carrier", "Carrier")}</td>
      <td className="px-2 py-1">{cat("market", "dl-market", "Market")}</td>
      <td className="px-2 py-1">{cat("project", "dl-project", "Project")}</td>
      <td className="px-2 py-1"><EmailInput value={draft.recipient} onChange={(v) => setDraft({ ...draft, recipient: v })} placeholder="add email" /></td>
      <td className="px-2 py-1"><EmailInput value={draft.cc} onChange={(v) => setDraft({ ...draft, cc: v })} placeholder="add email" /></td>
      <td className="px-2 py-1 whitespace-nowrap">
        <button onClick={save} disabled={pending} className="text-[11px] font-semibold text-white bg-moss rounded px-2 py-1 hover:opacity-90 disabled:opacity-50">Save</button>
        <button onClick={cancel} disabled={pending} className="text-[11px] text-muted ml-1 hover:text-signal">Cancel</button>
      </td>
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-rule bg-card">
      <div className="shrink-0 flex justify-between items-center px-4 py-2.5 border-b border-rule bg-card-2">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">
          Quote Directory · {rows.length} entries · Recipient + CC by GC / Carrier / Market / Project
        </div>
        <div className="flex items-center gap-3">
          <button onClick={beginAdd} disabled={editing === "new"} className="inline-flex items-center gap-1 text-[12px] font-semibold text-white bg-signal rounded px-2 py-1 hover:bg-signal-deep disabled:opacity-50">
            <Plus size={13} /> Add entry
          </button>
        </div>
      </div>

      <div className="shrink-0 p-2 border-b border-rule">
        <input className="w-full text-sm px-2 py-1 rounded border border-rule bg-input"
          placeholder="Search GC / carrier / market / project / email" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {/* suggestion lists from the asset categories */}
      <datalist id="dl-gc">{suggestions.gc.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-carrier">{suggestions.carrier.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-market">{suggestions.market.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="dl-project">{suggestions.project.map((v) => <option key={v} value={v} />)}</datalist>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <table className="w-full text-[12px] border-collapse" style={{ tableLayout: "fixed" }}>
          <colgroup>
            {DIR_COLDEFS.map((c) => (
              <col key={c.key} style={{ width: dirW[c.key] ?? 150 }} />
            ))}
            <col style={{ width: DIR_ACTIONS_W }} />
          </colgroup>
          <thead className="sticky top-0 bg-paper-deep z-10">
            <tr className="text-left text-muted-soft">
              {DIR_COLDEFS.map((c) => (
                <ColumnFilterHeader
                  key={c.key}
                  col={c}
                  className="relative px-2 py-1 font-semibold"
                  width={dirW[c.key]}
                  onResize={resizeDir}
                  sort={ctl.sort}
                  onCycleSort={ctl.cycleSort}
                  onSetSort={ctl.setSort}
                  distinct={ctl.distinct(c.key)}
                  active={ctl.filters[c.key]}
                  onApply={(s) => ctl.setColumnFilter(c.key, s)}
                />
              ))}
              <th className="px-2 py-1 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {editing === "new" && (
              <tr className="border-t border-rule bg-card-2 align-top shadow-[inset_3px_0_0_var(--gold)]">{EditCells()}</tr>
            )}
            {shown.map((r) => (
              <tr key={r.id} className="border-t border-rule/60 align-top hover:bg-card-2">
                {editing === r.id ? (
                  EditCells()
                ) : (
                  <>
                    <td className="px-2 py-1 font-medium">
                      {r.gc ?? "—"}
                      {conflictKeys.has(normKey(r)) && (
                        <span className="ml-1 text-[9px] text-ember border border-ember/40 rounded px-1" title="Conflicting recipients for this GC/Carrier/Market/Project — resolve">⚠ conflict</span>
                      )}
                    </td>
                    <td className="px-2 py-1 truncate" title={r.carrier ?? ""}>{r.carrier ?? "—"}</td>
                    <td className="px-2 py-1 truncate" title={r.market ?? ""}>{r.market ?? "—"}</td>
                    <td className="px-2 py-1 truncate" title={r.project ?? ""}>{r.project ?? "—"}</td>
                    <td className="px-2 py-1"><EmailChips value={r.recipient} /></td>
                    <td className="px-2 py-1"><EmailChips value={r.cc} /></td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      <button onClick={() => beginEdit(r)} className="text-muted hover:text-signal" title="Edit"><Pencil size={13} /></button>
                      <button onClick={() => remove(r)} className="text-muted hover:text-ember ml-2" title="Delete"><Trash2 size={13} /></button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {shown.length === 0 && editing !== "new" && (
              <tr><td colSpan={7} className="px-2 py-4 text-muted">No directory rows match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete directory entry"
        destructive
        busy={pending}
        confirmLabel="Delete"
        onConfirm={confirmRemove}
        onCancel={() => setPendingDelete(null)}
        message={
          pendingDelete ? (
            <>
              Delete the recipient entry for{" "}
              <span className="font-semibold">
                {[pendingDelete.gc, pendingDelete.carrier, pendingDelete.market, pendingDelete.project].filter(Boolean).join(" · ") || "—"}
              </span>
              ? This can&apos;t be undone.
            </>
          ) : null
        }
      />

      <ConfirmDialog
        open={!!clashConfirm}
        title="Duplicate directory key"
        busy={pending}
        confirmLabel="Save anyway"
        onConfirm={() => clashConfirm && doSave(clashConfirm.draft)}
        onCancel={() => setClashConfirm(null)}
        message={
          clashConfirm ? (
            <>
              An entry with the same GC / Carrier / Market / Project already exists
              (recipient: <span className="font-semibold">{clashConfirm.clash.recipient ?? "—"}</span>). Save anyway?
            </>
          ) : null
        }
      />
    </div>
  );
}
