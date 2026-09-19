// lib/quotes/email-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { createServiceClient } from "@/lib/supabase/service";
import { accessTokenForConnection, deleteDraft } from "@/lib/google/gmail";
import { returnToQueue } from "./actions";

export async function saveEmailTemplate(t: { id?: number; name: string; subject: string; body_html: string }) {
  const email = await requireUser();
  if (!t.name?.trim()) throw new Error("Template needs a name");
  const svc = createServiceClient();
  const row = {
    name: t.name.trim(), subject: t.subject ?? "", body_html: t.body_html ?? "",
    updated_by: email, updated_at: new Date().toISOString(),
  };
  const q = svc.schema("app_quote").from("email_templates");
  const { error } = t.id ? await q.update(row).eq("id", t.id) : await q.insert(row);
  if (error) throw new Error(error.message);
  revalidatePath("/generated");
  revalidatePath("/email-builder");
}

export async function deleteEmailTemplate(id: number) {
  await requireUser();
  const svc = createServiceClient();
  const { error } = await svc.schema("app_quote").from("email_templates").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/generated");
  revalidatePath("/email-builder");
}

/** Cancel: delete the Gmail draft (best effort) + mark the row cancelled. */
export async function cancelScheduledEmail(id: number) {
  const user = await requireUser();
  const svc = createServiceClient();
  const { data: row, error } = await svc
    .schema("app_quote").from("email_queue")
    .select("id, sender_email, gmail_draft_id, status").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row || row.status !== "scheduled") throw new Error("Not a scheduled row");
  if (row.sender_email !== user) throw new Error("Not your scheduled email");
  try {
    const { data: conn } = await svc
      .schema("app_quote").from("gmail_connections")
      .select("refresh_token_enc").eq("email", row.sender_email).maybeSingle();
    if (conn) {
      const at = await accessTokenForConnection(conn.refresh_token_enc as string);
      await deleteDraft(at, row.gmail_draft_id as string);
    }
  } catch {
    // best effort: the draft may already be gone or the token revoked
  }
  const { error: upErr } = await svc
    .schema("app_quote").from("email_queue")
    .update({ status: "cancelled", error: `cancelled by ${user}` }).eq("id", id);
  if (upErr) throw new Error(upErr.message);
  revalidatePath("/generated");
}

/**
 * Return an Outbox entry to the Generated "to schedule" list or the Queue. The row
 * is KEPT and annotated (returned_to/by/at); a returned row no longer holds the
 * quote in the Outbox (see the returned_at IS NULL filters). Waiting rows are
 * owner-only and have their Gmail draft deleted; Sent rows are allowed (the UI
 * warns) and their send record is preserved.
 */
export async function returnFromOutbox(id: number, target: "queue" | "generated") {
  const user = await requireUser();
  const svc = createServiceClient();
  const { data: row, error } = await svc
    .schema("app_quote").from("email_queue")
    .select("id, task_did, status, sender_email, gmail_draft_id, returned_at")
    .eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Entry not found");
  if (row.returned_at) return; // already returned (idempotent)

  if (row.status === "scheduled" && row.sender_email !== user) {
    throw new Error("Only the sender can return a waiting email");
  }

  // Waiting rows have a live Gmail draft the dispatcher would send -> delete it.
  if (row.status === "scheduled" && row.gmail_draft_id) {
    try {
      const { data: conn } = await svc
        .schema("app_quote").from("gmail_connections")
        .select("refresh_token_enc").eq("email", row.sender_email).maybeSingle();
      if (conn) {
        const at = await accessTokenForConnection(conn.refresh_token_enc as string);
        await deleteDraft(at, row.gmail_draft_id as string);
      }
    } catch {
      // best effort: draft may already be gone / sent / token revoked
    }
  }

  // Stamp the return and, for a still-waiting row, take it out of the schedulable
  // state so the dispatcher can never send it (defense in depth with the dispatcher's
  // returned_at filter; the Gmail draft delete above is best-effort and can fail).
  const patch: Record<string, unknown> = { returned_to: target, returned_by: user, returned_at: new Date().toISOString() };
  if (row.status === "scheduled") patch.status = "cancelled";
  const { error: upErr } = await svc
    .schema("app_quote").from("email_queue")
    .update(patch)
    .eq("id", id);
  if (upErr) throw new Error(upErr.message);

  // Returning to the Queue also drops the PDF + generated record (full reset).
  if (target === "queue") await returnToQueue(row.task_did as string);

  revalidatePath("/");
  revalidatePath("/generated");
}

/** Return several Outbox entries at once; skips ones the caller may not return. */
export async function returnManyFromOutbox(ids: number[], target: "queue" | "generated") {
  await requireUser();
  let returned = 0, skipped = 0;
  for (const id of Array.from(new Set(ids ?? []))) {
    try { await returnFromOutbox(id, target); returned++; }
    catch { skipped++; }
  }
  return { returned, skipped };
}
