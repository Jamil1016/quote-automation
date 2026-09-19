// components/quotes/EmailTemplateBuilder.tsx
"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import type { EmailTemplate } from "@/lib/quotes/types";
import { EMAIL_TOKENS, renderEmail } from "@/lib/quotes/email-template";
import { saveEmailTemplate, deleteEmailTemplate } from "@/lib/quotes/email-actions";
import { EmailComposer, type EmailComposerHandle } from "./EmailComposer";
import { TokenField, type TokenFieldHandle } from "./TokenField";
import { ConfirmDialog } from "./ConfirmDialog";

/** Representative values so the builder preview shows realistic content (no specific quote row). */
const SAMPLE: Record<string, string> = {
  asset_name: "Maple & Pine Rooftop - New Build", asset_id: "…/Northwind Builders/Carrier A/North Valley/5G Upgrade/NV0142/Jun 2026",
  site_id: "NV0142", gc: "Northwind Builders", carrier: "Carrier A", market: "North Valley", project: "5G Upgrade",
  subcon: "", fuze_id: "", service_rate: "585", product_service: "Closeout Package - 5G Upgrade",
  send_date: "06/12/2026", drive_link: "https://drive.google.com/file/d/…/view",
  task_name: "7. Quote Provided", site_name: "Maple & Pine Rooftop", sow: "New Build",
  invoice_category: "Closeout Package - 5G Upgrade", service_type: "Carrier COP",
  requirement_status: "submitted", ts_project: "FIELD-OPS: NORTH-VALLEY",
};

const LIST_KEY = "quote.tpl.listOpen";
const PREVIEW_KEY = "quote.tpl.previewOpen";
const SPLIT_KEY = "quote.tpl.split";
const clampBasis = (n: number) => Math.max(35, Math.min(72, n));

export function EmailTemplateBuilder({ templates, initialId }: { templates: EmailTemplate[]; initialId: number | null }) {
  const router = useRouter();
  const composerRef = useRef<EmailComposerHandle>(null);
  const subjectRef = useRef<TokenFieldHandle>(null);
  const [selectedId, setSelectedId] = useState<number | null>(initialId ?? templates[0]?.id ?? null);
  const sel = templates.find((t) => t.id === selectedId) ?? null;
  const [name, setName] = useState(sel?.name ?? "");
  const [subject, setSubject] = useState(sel?.subject ?? "");
  const [bodyHtml, setBodyHtml] = useState(sel?.body_html ?? "<p></p>");
  const [lastFocused, setLastFocused] = useState<"subject" | "body">("body");
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [pending, start] = useTransition();

  // ── Collapsible rails + resizable split (Queue idiom) ───────
  const [listOpen, setListOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [basis, setBasis] = useState(60);
  const basisRef = useRef(60);
  const splitRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time read of browser-only state after mount; a lazy initializer would mismatch the server render */
    if (localStorage.getItem(LIST_KEY) === "0") setListOpen(false);
    if (localStorage.getItem(PREVIEW_KEY) === "0") setPreviewOpen(false);
    const saved = Number(localStorage.getItem(SPLIT_KEY));
    if (saved) { const c = clampBasis(saved); setBasis(c); basisRef.current = c; }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const toggleList = () => setListOpen((v) => { localStorage.setItem(LIST_KEY, v ? "0" : "1"); return !v; });
  const togglePreview = () => setPreviewOpen((v) => { localStorage.setItem(PREVIEW_KEY, v ? "0" : "1"); return !v; });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !splitRef.current) return;
      const r = splitRef.current.getBoundingClientRect();
      const pct = clampBasis(((e.clientX - r.left) / r.width) * 100);
      basisRef.current = pct;
      setBasis(pct);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem(SPLIT_KEY, String(Math.round(basisRef.current)));
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  };

  const load = (t: EmailTemplate | null) => {
    setSelectedId(t?.id ?? null);
    setName(t?.name ?? ""); setSubject(t?.subject ?? ""); setBodyHtml(t?.body_html ?? "<p></p>");
    setMsg(null);
  };

  const insertField = (token: string) => {
    if (lastFocused === "subject") subjectRef.current?.insertToken(token);
    else composerRef.current?.insertToken(token);
  };

  const save = (asNew: boolean) =>
    start(async () => {
      try {
        await saveEmailTemplate({ id: asNew ? undefined : sel?.id, name, subject, body_html: bodyHtml });
        setMsg("Saved."); router.refresh();
      } catch (e) { setMsg((e as Error).message); }
    });

  const remove = () => sel && start(async () => { await deleteEmailTemplate(sel.id); setConfirmDel(false); load(null); router.refresh(); });

  const preview = renderEmail({ subject, body_html: bodyHtml }, SAMPLE);

  const chevronBtn = "grid h-7 w-7 shrink-0 place-items-center rounded-md border border-rule-strong text-muted transition-colors hover:border-gold hover:text-ink";
  const railLabel = "font-mono text-[10px] uppercase tracking-[0.18em] text-muted [writing-mode:vertical-rl]";

  return (
    <div className="flex h-full min-h-0 gap-4">
      {/* ── library rail: templates (top) + fields (bottom) ───── */}
      {listOpen ? (
        <aside className="flex w-56 shrink-0 flex-col overflow-hidden rounded-2xl border border-rule bg-card">
          {/* templates section */}
          <div className="flex items-center justify-between border-b border-rule bg-card-2 px-3 py-2.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Templates</span>
            <div className="flex items-center gap-1.5">
              <button onClick={() => load(null)} title="New template"
                className="flex items-center gap-1 text-[11px] font-semibold text-signal hover:underline">
                <Plus size={13} /> New
              </button>
              <button onClick={toggleList} title="Collapse panel" className={chevronBtn}><ChevronLeft size={15} /></button>
            </div>
          </div>
          <div className="max-h-[42%] shrink-0 overflow-y-auto p-1">
            {templates.map((t) => (
              <button key={t.id} onClick={() => load(t)}
                className={`block w-full truncate rounded px-2 py-1.5 text-left text-[12px] ${t.id === selectedId ? "bg-signal-wash font-semibold text-signal-deep" : "hover:bg-card-2"}`}>
                {t.name}
              </button>
            ))}
            {!templates.length && <div className="p-3 text-[12px] text-muted">No templates yet.</div>}
          </div>

          {/* fields section — always visible, click or drag to insert */}
          <div className="flex items-center justify-between border-y border-rule bg-card-2 px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Fields</span>
            <span className="text-[9px] text-muted">
              into <span className="font-mono font-semibold text-ink-soft">{lastFocused === "subject" ? "Subject" : "Body"}</span>
            </span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-1">
            {EMAIL_TOKENS.map((t) => (
              <button key={t.token} type="button" draggable
                onDragStart={(e) => { e.dataTransfer.setData("text/plain", `{{${t.token}}}`); e.dataTransfer.effectAllowed = "copy"; }}
                onClick={() => insertField(t.token)} title={`Insert {{${t.token}}}`}
                className="cursor-grab rounded border border-rule bg-paper-deep px-2 py-1 text-left transition-colors hover:border-gold hover:bg-gold-wash active:cursor-grabbing">
                <span className="block truncate text-[11px] font-semibold text-ink-soft">{t.label}</span>
                <span className="block truncate font-mono text-[9px] text-muted">{`{{${t.token}}}`}</span>
              </button>
            ))}
          </div>
        </aside>
      ) : (
        <button onClick={toggleList} title="Show templates & fields"
          className="flex w-9 shrink-0 flex-col items-center gap-3 rounded-2xl border border-rule bg-card py-3 transition-colors hover:bg-card-2">
          <ChevronRight size={15} className="text-muted" />
          <span className={railLabel}>Templates · Fields</span>
        </button>
      )}

      {/* ── editor + preview split ─────────────────────────────── */}
      <div ref={splitRef} className="flex min-h-0 min-w-0 flex-1">
        {/* editor card */}
        <section
          style={previewOpen ? { flexBasis: `${basis}%` } : undefined}
          className={`flex min-h-0 min-w-[360px] flex-col overflow-hidden rounded-2xl border border-rule bg-card ${previewOpen ? "shrink-0 grow-0" : "flex-1"}`}
        >
          {/* header zone — identity + actions only */}
          <div className="flex shrink-0 items-center gap-2 border-b border-rule bg-card-2 px-4 py-2.5">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name"
              className="min-w-0 flex-1 rounded border border-rule bg-input px-2 py-1.5 text-[13px] font-semibold focus:border-gold focus:outline-none" />
            {msg && <span className="shrink-0 text-[11px] text-muted">{msg}</span>}
            <button onClick={() => save(false)} disabled={pending || !name.trim()}
              className="shrink-0 rounded bg-moss px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50">Save</button>
            <button onClick={() => save(true)} disabled={pending || !name.trim()}
              className="shrink-0 rounded border border-rule-strong px-2 py-1.5 text-[12px] font-semibold hover:border-gold disabled:opacity-50">Save as</button>
            {sel && (
              <button onClick={() => setConfirmDel(true)} disabled={pending} title="Delete template"
                className="grid h-8 w-8 shrink-0 place-items-center rounded border border-rule-strong text-muted hover:border-ember hover:text-ember disabled:opacity-50">
                <Trash2 size={14} />
              </button>
            )}
          </div>

          {/* editor zone — content */}
          <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
            <div className="eyebrow shrink-0">Subject</div>
            <div className="shrink-0 overflow-x-auto rounded-lg border border-rule-strong bg-white px-3 py-2 text-[13px] transition-colors focus-within:border-gold">
              <TokenField ref={subjectRef} value={subject} onChange={setSubject} onFocus={() => setLastFocused("subject")}
                className="min-w-full text-[13px] focus:outline-none [&_p]:m-0" />
            </div>

            <div className="shrink-0 pt-1">
              <span className="eyebrow">Body</span>
            </div>

            <div className="min-h-0 flex-1">
              <EmailComposer ref={composerRef} value={bodyHtml} onChange={setBodyHtml} onFocusBody={() => setLastFocused("body")} fill />
            </div>
          </div>
        </section>

        {/* divider — only when preview is open */}
        {previewOpen && (
          <div onMouseDown={startDrag} role="separator" aria-orientation="vertical" title="Drag to resize"
            className="group flex w-4 shrink-0 cursor-col-resize items-center justify-center self-stretch">
            <div className="h-14 w-1 rounded-full bg-rule-strong transition-colors group-hover:bg-gold" />
          </div>
        )}

        {/* preview card */}
        {previewOpen ? (
          <section className="flex min-h-0 min-w-[320px] flex-1 flex-col overflow-hidden rounded-2xl border border-rule bg-card">
            <div className="flex shrink-0 items-center justify-between border-b border-rule bg-card-2 px-4 py-2.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Preview · sample values</span>
              <button onClick={togglePreview} title="Collapse preview" className={chevronBtn}><ChevronRight size={15} /></button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col bg-white p-3">
              <div className="shrink-0 border-b border-rule pb-1 text-[12px] font-semibold">{preview.subject || "(empty subject)"}</div>
              <iframe title="Template preview" sandbox="" className="mt-2 min-h-0 w-full flex-1 rounded border border-rule bg-white" srcDoc={preview.html} />
            </div>
          </section>
        ) : (
          <button onClick={togglePreview} title="Show preview"
            className="ml-4 flex w-9 shrink-0 flex-col items-center gap-3 rounded-2xl border border-rule bg-card py-3 transition-colors hover:bg-card-2">
            <ChevronLeft size={15} className="text-muted" />
            <span className={railLabel}>Preview</span>
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmDel}
        title="Delete template"
        message={<>Delete <span className="font-semibold">{sel?.name || "this template"}</span>? This cannot be undone.</>}
        confirmLabel="Delete"
        destructive
        busy={pending}
        onConfirm={remove}
        onCancel={() => setConfirmDel(false)}
      />
    </div>
  );
}
