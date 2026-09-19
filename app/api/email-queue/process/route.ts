// app/api/email-queue/process/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/auth/require-user";
import { emailMode } from "@/lib/quotes/email-safety";
import { accessTokenForConnection, sendDraftWithRetry, deleteDraft, DraftGoneError } from "@/lib/google/gmail";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
// Space sends so we don't fire a tight burst at Gmail — bursts are what trigger
// the intermittent 400 failedPrecondition. Small base + jitter; with the 50/run
// cap this adds at most ~20s, well inside maxDuration.
const INTER_SEND_BASE_MS = 150;
const INTER_SEND_JITTER_MS = 250;

/** Auth-gated status peek (for manual checks). */
export async function GET() {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  const svc = createServiceClient();
  const { data, error } = await svc
    .schema("app_quote").from("email_queue").select("status");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const counts: Record<string, number> = {};
  for (const r of data ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return NextResponse.json({ mode: emailMode(), counts });
}

/** Dispatcher: secret-gated; sends every due draft. Called by Apps Script every 5 min. */
export async function POST(req: NextRequest) {
  const secret = process.env.EMAIL_QUEUE_SECRET;
  if (!secret || req.headers.get("x-email-queue-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (emailMode() === "off") {
    return NextResponse.json({ skipped: "QUOTE_EMAIL_MODE=off (kill switch)" });
  }

  const svc = createServiceClient();

  // Reaper: free rows whose claiming run died before marking them terminal. A run is
  // capped at maxDuration (120s), so anything still 'scheduled' but claimed >5 min ago
  // belongs to a dead run. Reclaiming is safe — an already-sent draft is gone, so a
  // re-send 404s (-> cancelled) rather than double-delivering.
  const staleCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  await svc
    .schema("app_quote").from("email_queue")
    .update({ claimed_at: null })
    .eq("status", "scheduled")
    .lt("claimed_at", staleCutoff);

  // Claim due rows atomically. claim_due_emails() stamps claimed_at under
  // FOR UPDATE SKIP LOCKED and returns only the rows THIS run took, so two
  // overlapping 1-min runs can never grab the same draft (the prior bug that
  // double-sent drafts -> 404/precondition -> clobbered 'sent' to cancelled/failed).
  // The RPC also enforces returned_at IS NULL, so a returned email is never sent.
  const { data: due, error } = await svc
    .schema("app_quote").rpc("claim_due_emails", { p_limit: 50 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!due?.length) return NextResponse.json({ processed: 0 });

  // One access token per sender for the batch.
  const tokens = new Map<string, string | { error: string }>();
  async function tokenFor(sender: string): Promise<string | { error: string }> {
    if (!tokens.has(sender)) {
      const { data: conn } = await svc
        .schema("app_quote").from("gmail_connections")
        .select("refresh_token_enc").eq("email", sender).eq("status", "active").maybeSingle();
      if (!conn) tokens.set(sender, { error: "no active Gmail connection (reconnect Gmail)" });
      else {
        try {
          tokens.set(sender, await accessTokenForConnection(conn.refresh_token_enc as string));
        } catch (e) {
          tokens.set(sender, { error: `token refresh failed: ${(e as Error).message} (reconnect Gmail)` });
          await svc.schema("app_quote").from("gmail_connections")
            .update({ status: "error", last_error: (e as Error).message }).eq("email", sender);
        }
      }
    }
    return tokens.get(sender)!;
  }

  let sent = 0, failed = 0, cancelled = 0, idx = 0;
  for (const row of due) {
    // De-burst: brief jittered gap between sends (skip before the first).
    if (idx++ > 0) await sleep(INTER_SEND_BASE_MS + Math.floor(Math.random() * INTER_SEND_JITTER_MS));
    const t = await tokenFor(row.sender_email as string);
    const mark = (patch: Record<string, unknown>) =>
      svc.schema("app_quote").from("email_queue").update(patch).eq("id", row.id);
    if (typeof t !== "string") {
      await mark({ status: "failed", error: t.error });
      failed++;
      continue;
    }
    try {
      const { messageId } = await sendDraftWithRetry(t, row.gmail_draft_id as string);
      await mark({ status: "sent", sent_at: new Date().toISOString(), gmail_message_id: messageId, error: null });
      sent++;
    } catch (e) {
      if (e instanceof DraftGoneError) {
        await mark({ status: "cancelled", error: "draft deleted in Gmail" });
        cancelled++;
      } else {
        // A failed send shouldn't leave a stray draft in Gmail (mirrors cancel).
        // Best-effort delete — we hold a valid token here (t is a string).
        try { await deleteDraft(t, row.gmail_draft_id as string); } catch { /* draft may already be gone */ }
        await mark({ status: "failed", error: (e as Error).message });
        failed++;
      }
    }
  }
  return NextResponse.json({ processed: due.length, sent, failed, cancelled });
}
