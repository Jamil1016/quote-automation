// app/api/email-queue/schedule/route.ts
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createServiceClient } from "@/lib/supabase/service";
import { getQuoteData, getSendIdentitiesFor } from "@/lib/quotes/queries";
import { resolveRecipients } from "@/lib/quotes/email-safety";
import { renderEmail, tokenValuesFor } from "@/lib/quotes/email-template";
import { formatEtDate } from "@/lib/quotes/email-time";
import { buildMime, toBase64Url } from "@/lib/quotes/email-mime";
import { inlineImagesToCid } from "@/lib/quotes/email-images";
import { downloadDriveFile } from "@/lib/google/drive";
import { accessTokenForConnection, createDraft } from "@/lib/google/gmail";
import { resolveActiveSender, senderErrorMessage, type Conn } from "@/lib/quotes/sender";
import { resolveFromIdentity } from "@/lib/quotes/send-identities";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Streaming version of scheduling: for each selected generated entry, resolve
 * recipients, render the template, create a Gmail draft in the caller's account,
 * and insert a queue row — emitting NDJSON progress per row so the UI can show a
 * live "creating draft X of N" panel and let the user close the modal mid-run.
 */
type Ev =
  | { type: "start"; total: number }
  | { type: "progress"; done: number; total: number; asset_name: string; ok: boolean; error?: string }
  | { type: "done"; scheduled: number; failed: number };

const splitList = (s: string | null | undefined) =>
  (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);

export async function POST(req: NextRequest) {
  let user: string;
  try { user = await requireUser(); } catch { return new Response("Not authorized", { status: 403 }); }

  let body: { taskDids?: unknown; subject?: unknown; bodyHtml?: unknown; templateName?: unknown; scheduledAtUtc?: unknown; fromEmail?: unknown };
  try { body = await req.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }

  const dids = Array.isArray(body.taskDids)
    ? Array.from(new Set(body.taskDids.filter((d): d is string => typeof d === "string" && !!d)))
    : [];
  const subject = typeof body.subject === "string" ? body.subject : "";
  const bodyHtml = typeof body.bodyHtml === "string" ? body.bodyHtml : "";
  const templateName = typeof body.templateName === "string" ? body.templateName : null;
  const scheduledAtUtc = typeof body.scheduledAtUtc === "string" ? body.scheduledAtUtc : "";
  const fromEmailReq = typeof body.fromEmail === "string" && body.fromEmail ? body.fromEmail : null;
  if (!dids.length) return new Response("No entries selected", { status: 400 });
  if (!subject.trim()) return new Response("Subject is empty", { status: 400 });
  if (Number.isNaN(Date.parse(scheduledAtUtc))) return new Response("Invalid schedule time", { status: 400 });

  const svc = createServiceClient();
  const { data: conns, error: connErr } = await svc
    .schema("app_quote").from("gmail_connections")
    .select("email, status, refresh_token_enc").eq("connected_by", user);
  if (connErr) return new Response(connErr.message, { status: 500 });
  const { data: setting } = await svc
    .schema("app_quote").from("user_settings")
    .select("active_sender_email, active_from_email").eq("user_email", user).maybeSingle();
  const resolved = resolveActiveSender((conns ?? []) as Conn[], setting?.active_sender_email ?? null);
  if (!resolved.ok) return new Response(senderErrorMessage(resolved.reason), { status: 400 });
  const sender = resolved.connection.email;

  const fromRes = resolveFromIdentity(
    fromEmailReq, setting?.active_from_email ?? null, sender, await getSendIdentitiesFor(user));
  if (!fromRes.ok) {
    return new Response("Invalid send-as identity. Choose one in Settings.", { status: 400 });
  }
  // Record on the queue row only when it is a real alias (has a display name); NULL = own account.
  const recordedFrom = fromRes.from.name ? fromRes.from.email : null;

  let accessToken: string;
  try { accessToken = await accessTokenForConnection(resolved.connection.refresh_token_enc); }
  catch (e) { return new Response(`Gmail token error: ${(e as Error).message}`, { status: 400 }); }

  // Block double-scheduling against rows already waiting to send.
  const { data: existing } = await svc
    .schema("app_quote").from("email_queue")
    .select("task_did").eq("status", "scheduled").is("returned_at", null).in("task_did", dids);
  const already = new Set((existing ?? []).map((r: { task_did: string }) => r.task_did));

  const data = await getQuoteData();
  const byDid = new Map(data.rows.map((r) => [r.task_did, r]));
  const sendDate = formatEtDate(scheduledAtUtc);
  const enc = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: Ev) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      emit({ type: "start", total: dids.length });
      let scheduled = 0, failed = 0, done = 0;
      for (const did of dids) {
        const row = byDid.get(did);
        const name = row?.asset_name ?? did;
        try {
          if (!row) throw new Error("entry not found");
          if (already.has(did)) throw new Error("already scheduled (cancel the existing one first)");
          if (!row.generated_at || !row.drive_file_id) throw new Error("no generated PDF");
          const plan = resolveRecipients(splitList(row.quote_recipient), splitList(row.quote_cc));
          const rendered = renderEmail({ subject, body_html: bodyHtml }, tokenValuesFor(row, sendDate));
          const { html: cidHtml, images } = inlineImagesToCid(rendered.html);
          const finalSubject = plan.mode === "test" ? `[TEST] ${rendered.subject}` : rendered.subject;
          const pdf = await downloadDriveFile(row.drive_file_id);
          const raw = buildMime({
            from: fromRes.from, to: plan.to, cc: plan.cc, subject: finalSubject,
            html: cidHtml, text: rendered.text, inlineImages: images,
            attachment: {
              filename: `${row.asset_name.trim()} - Example Co Quote.pdf`,
              mimeType: "application/pdf",
              bytesBase64: Buffer.from(pdf).toString("base64"),
            },
          });
          const draftId = await createDraft(accessToken, toBase64Url(raw));
          const { error } = await svc.schema("app_quote").from("email_queue").insert({
            task_did: did, sender_email: sender, from_email: recordedFrom, gmail_draft_id: draftId, scheduled_at: scheduledAtUtc,
            status: "scheduled", subject_resolved: finalSubject, to_resolved: plan.to.join(", "),
            cc_resolved: plan.cc.join(", ") || null, template_name: templateName, created_by: user,
          });
          if (error) throw new Error(error.message);
          // One record per quote: now that it's freshly scheduled, drop any prior
          // failed/cancelled rows for the same quote so the Outbox isn't cluttered.
          await svc.schema("app_quote").from("email_queue")
            .delete().eq("task_did", did).in("status", ["failed", "cancelled"]).is("returned_at", null);
          scheduled++; done++;
          emit({ type: "progress", done, total: dids.length, asset_name: name, ok: true });
        } catch (e) {
          failed++; done++;
          emit({ type: "progress", done, total: dids.length, asset_name: name, ok: false, error: (e as Error).message });
        }
      }
      emit({ type: "done", scheduled, failed });
      controller.close();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
