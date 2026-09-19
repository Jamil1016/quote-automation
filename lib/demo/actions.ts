import { createServiceClient } from "@/lib/supabase/service";
import { DEMO_REFRESH_TOKEN_PLACEHOLDER, demoSendDraft } from "./gmail";

/**
 * "Connect Gmail" in demo mode: record a fake mailbox for the user (their own
 * address) instead of sending them through Google's consent screen.
 * Returns the connected address.
 */
export async function connectDemoMailbox(user: string): Promise<string> {
  const svc = createServiceClient();
  const now = new Date().toISOString();
  const { error } = await svc.schema("app_quote").from("gmail_connections").upsert(
    {
      email: user, refresh_token_enc: DEMO_REFRESH_TOKEN_PLACEHOLDER, connected_by: user,
      connected_at: now, status: "active", last_error: null,
    },
    { onConflict: "connected_by,email" },
  );
  if (error) throw new Error(error.message);
  const { data: s } = await svc
    .schema("app_quote").from("user_settings")
    .select("active_sender_email").eq("user_email", user).maybeSingle();
  if (!s?.active_sender_email) {
    await svc.schema("app_quote").from("user_settings")
      .upsert({ user_email: user, active_sender_email: user, updated_at: now }, { onConflict: "user_email" });
  }
  return user;
}

/**
 * The real deployment has an external cron (scripts/email_queue_trigger.gs)
 * calling /api/email-queue/process. A demo has no cron, so due rows are flushed
 * when the Outbox is read: claim them through the same exactly-once RPC, then
 * mark them sent with a fake message id. Returns how many rows were marked.
 */
export async function flushDueDemoEmails(): Promise<number> {
  const svc = createServiceClient();
  const { data: due, error } = await svc.schema("app_quote").rpc("claim_due_emails", { p_limit: 50 });
  if (error || !due?.length) return 0;
  let sent = 0;
  for (const row of due as { id: number }[]) {
    const { messageId } = await demoSendDraft();
    const { error: upErr } = await svc.schema("app_quote").from("email_queue")
      .update({ status: "sent", sent_at: new Date().toISOString(), gmail_message_id: messageId, error: null })
      .eq("id", row.id);
    if (!upErr) sent++;
  }
  return sent;
}
