// components/quotes/ScheduleEmailModal.tsx
"use client";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { EmailTemplate, QuoteRow } from "@/lib/quotes/types";
import type { SendIdentity } from "@/lib/quotes/send-identities";
import { renderEmail, tokenValuesFor } from "@/lib/quotes/email-template";
import { etToUtcIso, formatEtDate, formatEtDateTime } from "@/lib/quotes/email-time";
import { EmailChips } from "./EmailChips";

export interface SchedulePayload {
  taskDids: string[];
  subject: string;
  bodyHtml: string;
  templateName: string | null;
  scheduledAtUtc: string;
  fromEmail: string;
}

/**
 * Schedule the selected quotes: pick a saved template, preview each with its real
 * row values, pick an ET send time, confirm. On confirm it hands the payload to the
 * parent (which creates the Gmail drafts in the background + shows a progress panel)
 * and closes — so the user isn't blocked. Template authoring lives in /email-builder.
 * gmailEmail = the caller's connected Gmail (null = not connected).
 */
export function ScheduleEmailModal({ rows, templates, gmailEmail, identities, defaultFrom, onSchedule, onClose }: {
  rows: QuoteRow[];
  templates: EmailTemplate[];
  gmailEmail: string | null;
  identities: SendIdentity[];
  defaultFrom: string | null;
  onSchedule: (payload: SchedulePayload) => void;
  onClose: () => void;
}) {
  const [templateId, setTemplateId] = useState<number | "">(templates[0]?.id ?? "");
  const picked = templates.find((t) => t.id === templateId) ?? null;
  const [when, setWhen] = useState(""); // datetime-local, interpreted as ET
  const [idx, setIdx] = useState(0); // which selected row to preview

  // From choices: the active account address + each configured shared identity.
  const fromOptions = [
    ...(gmailEmail ? [{ label: gmailEmail, value: gmailEmail }] : []),
    ...identities.map((i) => ({ label: `${i.name} <${i.email}>`, value: i.email })),
  ];
  const [fromEmail, setFromEmail] = useState<string>(defaultFrom ?? gmailEmail ?? "");
  const fromLabel = fromOptions.find((o) => o.value === fromEmail)?.label
    ?? (gmailEmail ?? "(no active sender — set one in Settings)");

  const noRecipient = rows.filter((r) => !r.quote_recipient);
  const scheduledAtUtc = when ? etToUtcIso(when) : null;
  const row = rows[Math.min(idx, rows.length - 1)] ?? null;

  const preview = useMemo(() => {
    if (!row || !picked) return null;
    const values = tokenValuesFor(row, scheduledAtUtc ? formatEtDate(scheduledAtUtc) : "MM/DD/YYYY");
    return renderEmail({ subject: picked.subject, body_html: picked.body_html }, values);
  }, [row, picked, scheduledAtUtc]);

  const canSchedule = !!gmailEmail && !!picked && !!when && rows.length > 0 && noRecipient.length === 0;

  const doSchedule = () => {
    if (!canSchedule) return;
    onSchedule({
      taskDids: rows.map((r) => r.task_did),
      subject: picked!.subject,
      bodyHtml: picked!.body_html,
      templateName: picked!.name,
      scheduledAtUtc: scheduledAtUtc!,
      fromEmail: fromEmail || gmailEmail || "",
    });
    onClose();
  };

  const eyebrow = "font-mono text-[10px] uppercase tracking-[0.14em] text-muted";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-rule-strong bg-card">
        {/* header */}
        <div className="flex shrink-0 items-center justify-between border-b border-rule bg-card-2 px-4 py-2.5">
          <span className={eyebrow}>Schedule email · {rows.length} {rows.length === 1 ? "quote" : "quotes"}</span>
          <button onClick={onClose} aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-md border border-rule-strong text-muted transition-colors hover:border-gold hover:text-ink">
            <X size={15} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
              {/* left: scheduling controls only */}
              <div className="w-64 shrink-0 space-y-5 overflow-y-auto border-r border-rule p-4">
                {!gmailEmail && (
                  <div className="rounded border border-amber bg-gold-wash p-2 text-[12px]">
                    No Gmail connected for your account.{" "}
                    <a className="font-semibold text-signal underline" href="/api/gmail/connect">Connect Gmail</a> to schedule sends.
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className={eyebrow}>Template</div>
                  {templates.length ? (
                    <>
                      <select className="w-full rounded border border-rule-strong bg-input px-2 py-1.5 text-[12px] focus:border-gold focus:outline-none"
                        value={templateId} onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : "")}>
                        {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      {picked && (
                        <a href={`/email-builder?template=${picked.id}`}
                          className="inline-block text-[11px] font-semibold text-signal hover:underline">
                          Edit in builder ↗
                        </a>
                      )}
                    </>
                  ) : (
                    <div className="rounded border border-rule bg-paper-deep p-2 text-[12px] text-muted">
                      No templates yet.{" "}
                      <a href="/email-builder" className="font-semibold text-signal hover:underline">Create one in the builder</a>.
                    </div>
                  )}
                </div>

                {fromOptions.length > 1 && (
                  <div className="space-y-1.5">
                    <div className={eyebrow}>Send as</div>
                    <select value={fromEmail} onChange={(e) => setFromEmail(e.target.value)}
                      className="w-full rounded border border-rule-strong bg-input px-2 py-1.5 text-[12px] focus:border-gold focus:outline-none">
                      {fromOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className={eyebrow}>Send at (Eastern Time)</div>
                  <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)}
                    className="w-full rounded border border-rule-strong bg-input px-2 py-1.5 text-[12px] focus:border-gold focus:outline-none" />
                  {scheduledAtUtc && (
                    <div className="text-[11px] text-muted">Sends {formatEtDateTime(scheduledAtUtc)}</div>
                  )}
                </div>

                {noRecipient.length > 0 && (
                  <div className="rounded border border-ember bg-ember-wash p-2 text-[12px] text-ember">
                    {noRecipient.length} selected {noRecipient.length === 1 ? "entry has" : "entries have"} no recipient. Assign recipients in the Queue first.
                  </div>
                )}
              </div>

              {/* right: preview (hero), steppable across the selected rows */}
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4">
                <div className="flex items-center justify-between">
                  <span className={eyebrow}>Preview · {row?.asset_name ?? "—"}</span>
                  {rows.length > 1 && (
                    <div className="flex items-center gap-1 text-[11px] text-muted">
                      <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx <= 0}
                        className="grid h-6 w-6 place-items-center rounded border border-rule-strong hover:border-gold disabled:opacity-40"><ChevronLeft size={13} /></button>
                      <span className="tabular-nums">{Math.min(idx, rows.length - 1) + 1} of {rows.length}</span>
                      <button onClick={() => setIdx((i) => Math.min(rows.length - 1, i + 1))} disabled={idx >= rows.length - 1}
                        className="grid h-6 w-6 place-items-center rounded border border-rule-strong hover:border-gold disabled:opacity-40"><ChevronRight size={13} /></button>
                    </div>
                  )}
                </div>
                <div className="flex min-h-0 flex-1 flex-col rounded border border-rule bg-white p-3">
                  <div className="shrink-0 border-b border-rule pb-2 text-[12px]">
                    <div><span className="text-muted">From:</span> {fromLabel}</div>
                    <div className="mt-0.5 flex items-start gap-1"><span className="text-muted">To:</span> <EmailChips value={row?.quote_recipient ?? ""} /></div>
                    {row?.quote_cc && <div className="mt-0.5 flex items-start gap-1"><span className="text-muted">Cc:</span> <EmailChips value={row.quote_cc} /></div>}
                    <div className="mt-1 font-semibold">{preview?.subject || "(empty subject)"}</div>
                  </div>
                  <iframe title="Email body preview" sandbox=""
                    className="mt-2 min-h-[200px] w-full flex-1 rounded border border-rule bg-white" srcDoc={preview?.html ?? ""} />
                  <div className="mt-2 shrink-0 border-t border-rule pt-2 text-[11px] text-muted">
                    📎 {row?.asset_name} - Example Co Quote.pdf
                  </div>
                </div>
              </div>
            </div>

        {/* footer: the single action, separated */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-rule bg-card-2 px-4 py-3">
          <span className="text-[10.5px] text-muted-soft">
            Drafts are created in the background, you can close this. Editing a draft in Gmail changes what is sent; deleting it cancels that send.
          </span>
          <button onClick={doSchedule} disabled={!canSchedule}
            className="shrink-0 rounded bg-moss px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50">
            Create {rows.length} Gmail {rows.length === 1 ? "draft" : "drafts"} + schedule
          </button>
        </div>
      </div>
    </div>
  );
}
