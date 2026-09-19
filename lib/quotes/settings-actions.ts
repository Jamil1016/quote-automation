// lib/quotes/settings-actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { createServiceClient } from "@/lib/supabase/service";
import { validateMaskInput, isMaskAdmin } from "@/lib/quotes/send-identities";
import { getSendIdentitiesFor } from "@/lib/quotes/queries";
import type { Theme } from "@/lib/quotes/theme";

/** Set the caller's active sender to one of their own connected emails. */
export async function setActiveSender(email: string) {
  const user = await requireUser();
  const svc = createServiceClient();
  const { data: conn } = await svc
    .schema("app_quote").from("gmail_connections")
    .select("email").eq("connected_by", user).eq("email", email).eq("status", "active").maybeSingle();
  if (!conn) throw new Error("That account is not connected or needs reconnecting.");
  const { error } = await svc
    .schema("app_quote").from("user_settings")
    .upsert({ user_email: user, active_sender_email: email, updated_at: new Date().toISOString() },
      { onConflict: "user_email" });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/generated");
}

/** Disconnect one of the caller's senders; clear active if it pointed there. */
export async function disconnectSender(email: string) {
  const user = await requireUser();
  const svc = createServiceClient();
  const { error } = await svc
    .schema("app_quote").from("gmail_connections")
    .delete().eq("connected_by", user).eq("email", email);
  if (error) throw new Error(error.message);
  const { data: s } = await svc
    .schema("app_quote").from("user_settings")
    .select("active_sender_email").eq("user_email", user).maybeSingle();
  if (s?.active_sender_email === email) {
    await svc.schema("app_quote").from("user_settings")
      .update({ active_sender_email: null, updated_at: new Date().toISOString() }).eq("user_email", user);
  }
  revalidatePath("/settings");
  revalidatePath("/generated");
}

/** Set the caller's saved default "send as": null (own address) or a configured identity. */
export async function setActiveFrom(email: string | null) {
  const user = await requireUser();
  const normalized = email ? email.toLowerCase() : null;
  if (normalized) {
    const ids = await getSendIdentitiesFor(user);
    if (!ids.some((i) => i.email === normalized)) {
      throw new Error("That send-as identity is not available.");
    }
  }
  const svc = createServiceClient();
  const { error } = await svc
    .schema("app_quote").from("user_settings")
    .upsert({ user_email: user, active_from_email: normalized, updated_at: new Date().toISOString() },
      { onConflict: "user_email" });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/generated");
}

/** Add a mask. Shared requires admin; personal is owned by the caller. */
export async function addMask(name: string, email: string, scope: "shared" | "personal") {
  const user = await requireUser();
  if (scope === "shared" && !isMaskAdmin(user, process.env.QUOTE_MASK_ADMINS)) {
    throw new Error("Only an admin can add a shared mask.");
  }
  const v = validateMaskInput(name, email);
  if (!v.ok) throw new Error(v.reason === "name" ? "Enter a display name." : "Enter a valid email address.");
  const svc = createServiceClient();
  const { error } = await svc.schema("app_quote").from("send_identities").insert({
    name: v.name, email: v.email, scope, owner_email: scope === "personal" ? user : null, created_by: user,
  });
  if (error) {
    if (error.code === "23505") throw new Error("That mask already exists.");
    throw new Error(error.message);
  }
  revalidatePath("/settings");
  revalidatePath("/generated");
}

/** Remove a mask (admin for shared, owner for personal); clear any default that used it. */
export async function removeMask(id: number) {
  const user = await requireUser();
  const svc = createServiceClient();
  const { data: row, error: readErr } = await svc
    .schema("app_quote").from("send_identities")
    .select("id, email, scope, owner_email").eq("id", id).maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!row) throw new Error("Mask not found.");
  if (row.scope === "shared") {
    if (!isMaskAdmin(user, process.env.QUOTE_MASK_ADMINS)) throw new Error("Only an admin can remove a shared mask.");
  } else if (row.owner_email?.toLowerCase() !== user.toLowerCase()) {
    throw new Error("Not authorized.");
  }
  const { error: delErr } = await svc
    .schema("app_quote").from("send_identities").delete().eq("id", id);
  if (delErr) throw new Error(delErr.message);
  // Clear any saved default that pointed at the removed mask (all users for shared; just the owner for personal).
  let clear = svc.schema("app_quote").from("user_settings")
    .update({ active_from_email: null, updated_at: new Date().toISOString() })
    .eq("active_from_email", row.email as string);
  if (row.scope === "personal") clear = clear.eq("user_email", user);
  const { error: clrErr } = await clear;
  if (clrErr) throw new Error(clrErr.message);
  revalidatePath("/settings");
  revalidatePath("/generated");
}

/** Save the caller's UI theme preference (ledger | brand). */
export async function setTheme(theme: Theme) {
  const user = await requireUser();
  if (theme !== "ledger" && theme !== "brand") throw new Error("Unknown theme");
  const svc = createServiceClient();
  const { error } = await svc
    .schema("app_quote").from("user_settings")
    .upsert({ user_email: user, theme, updated_at: new Date().toISOString() }, { onConflict: "user_email" });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
