"use client";
import { useState, useTransition } from "react";
import type { DirectoryRow, QuoteRow } from "@/lib/quotes/types";
import { upsertDirectoryEntry } from "@/lib/quotes/actions";
import { EmailChips } from "./EmailChips";
import { EmailInput } from "./EmailInput";

export function RecipientAssigner({ row, directory }: { row: QuoteRow; directory: DirectoryRow[] }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(row.gc ?? "");
  const [to, setTo] = useState(row.quote_recipient ?? "");
  const [cc, setCc] = useState(row.quote_cc ?? "");
  const [pending, start] = useTransition();

  // every whitespace-separated term must appear (AND), so "Summit Tower carrier a" matches
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  // distinct recipient groups (by recipient+cc), with a context label, filtered by search
  const groups = (() => {
    const seen = new Map<string, { label: string; recipient: string; cc: string }>();
    for (const d of directory) {
      const key = `${d.recipient ?? ""}~~${d.cc ?? ""}`;
      if (!d.recipient) continue;
      if (!seen.has(key)) {
        seen.set(key, {
          label: [d.gc, d.carrier, d.market, d.project].filter(Boolean).join(" · "),
          recipient: d.recipient ?? "",
          cc: d.cc ?? "",
        });
      }
    }
    let arr = Array.from(seen.values());
    if (terms.length) {
      arr = arr.filter((g) => {
        const hay = `${g.label} ${g.recipient} ${g.cc}`.toLowerCase();
        return terms.every((t) => hay.includes(t));
      });
    }
    return arr.slice(0, 40);
  })();

  const inp = "w-full text-[12px] px-2 py-1 rounded border border-rule bg-input";
  const save = () =>
    start(async () => {
      await upsertDirectoryEntry({
        gc: row.gc ?? "", carrier: row.carrier ?? "", market: row.market ?? "", project: row.project ?? "",
        recipient: to, cc,
      });
      setOpen(false);
    });

  const keyComplete = !!(row.gc && row.carrier && row.market && row.project);

  // Opening the panel always pre-fills the search with this entry's GC, so the
  // matching directory groups surface immediately.
  const toggle = () => {
    if (!open) setSearch(row.gc ?? "");
    setOpen((o) => !o);
  };

  return (
    <div className="mt-2">
      <button onClick={toggle} className="text-[11px] text-signal hover:underline">
        {row.directory_matched ? "Change / add recipients ▾" : "＋ Assign recipients ▾"}
      </button>

      {open && (
        <div className="mt-2 p-2 rounded border border-rule bg-paper-deep space-y-2">
          <div className="text-[11px] text-muted">
            Saves a Quote Directory entry for{" "}
            <b>{row.gc ?? "—"} · {row.carrier ?? "—"} · {row.market ?? "—"} · {row.project ?? "—"}</b>
            {!keyComplete && <span className="text-ember"> — one of these is blank; fix the category chips first or it won&apos;t match.</span>}
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-soft mb-0.5">Copy recipients from an existing group</div>
            <input className={inp} placeholder="Filter by GC / carrier / market / project / email…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="mt-1 max-h-32 overflow-y-auto border border-rule rounded bg-card">
              {groups.map((g, i) => (
                <button
                  key={i}
                  onClick={() => { setTo(g.recipient); setCc(g.cc); }}
                  className="block w-full text-left px-2 py-1 text-[11px] hover:bg-signal-wash border-b border-rule/50"
                >
                  <div className="text-muted mb-0.5">{g.label || "—"}</div>
                  <div className="flex items-start gap-1">
                    <span className="text-[10px] text-muted-soft mt-0.5 w-5 shrink-0">To</span>
                    <EmailChips value={g.recipient} />
                  </div>
                  {g.cc && (
                    <div className="flex items-start gap-1 mt-0.5">
                      <span className="text-[10px] text-muted-soft mt-0.5 w-5 shrink-0">CC</span>
                      <EmailChips value={g.cc} />
                    </div>
                  )}
                </button>
              ))}
              {groups.length === 0 && <div className="px-2 py-1 text-[11px] text-muted">No groups match.</div>}
            </div>
          </div>

          <label className="block">
            <span className="text-[10px] uppercase tracking-wide text-muted-soft">To</span>
            <div className="mt-0.5"><EmailInput value={to} onChange={setTo} placeholder="email (space or comma to add)" /></div>
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wide text-muted-soft">CC</span>
            <div className="mt-0.5"><EmailInput value={cc} onChange={setCc} placeholder="email (space or comma to add)" /></div>
          </label>

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={pending || !to.trim() || !keyComplete}
              className="text-[11px] font-semibold text-white bg-moss rounded px-2 py-1 hover:opacity-90 disabled:opacity-50"
            >
              Save to directory
            </button>
            <button onClick={() => setOpen(false)} disabled={pending} className="text-[11px] text-muted hover:text-signal">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
