"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/auth/require-user";
import { deleteDriveFile } from "@/lib/google/drive";
import { normalizeLineItems } from "./quote-model";
import type { QuoteLineItem } from "./types";

const FIELDS = ["subcon", "gc", "carrier", "market", "project", "fuze_id"] as const;
type Field = (typeof FIELDS)[number];

const OVERRIDE_COLS = "subcon, gc, carrier, market, project, fuze_id, verified, verified_by, verified_at, chosen_line_key, service_rate_override, product_service_override, line_items";

// Read the existing override row so we never wipe sibling fields (read-modify-write).
async function existingRow(svc: ReturnType<typeof createServiceClient>, taskDid: string) {
  const { data, error } = await svc
    .schema("app_quote")
    .from("overrides")
    .select(OVERRIDE_COLS)
    .eq("task_did", taskDid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? {};
}

/**
 * Set/clear one category override.
 * value null -> clear (auto-parse), "" -> explicit blank, "..." -> chosen value.
 */
export async function setOverride(taskDid: string, field: string, value: string | null) {
  const email = await requireUser();
  if (!taskDid) throw new Error("Missing task");
  if (!FIELDS.includes(field as Field)) throw new Error(`Invalid field: ${field}`);

  const svc = createServiceClient();
  const ex = (await existingRow(svc, taskDid)) as Record<string, unknown>;

  const merged: Record<string, unknown> = {
    task_did: taskDid,
    subcon: ex.subcon ?? null,
    gc: ex.gc ?? null,
    carrier: ex.carrier ?? null,
    market: ex.market ?? null,
    project: ex.project ?? null,
    fuze_id: ex.fuze_id ?? null,
    verified: ex.verified ?? false,
    verified_by: ex.verified_by ?? null,
    verified_at: ex.verified_at ?? null,
    chosen_line_key: ex.chosen_line_key ?? null,
    service_rate_override: ex.service_rate_override ?? null,
    product_service_override: ex.product_service_override ?? null,
    line_items: ex.line_items ?? null,
    [field]: value,
    updated_by: email,
    updated_at: new Date().toISOString(),
  };

  const { error } = await svc
    .schema("app_quote")
    .from("overrides")
    .upsert(merged, { onConflict: "task_did" });
  if (error) throw new Error(error.message);

  revalidatePath("/");
}

/** Mark a task verified (clears the needs-review flag) or undo it. */
export async function setVerified(taskDid: string, verified: boolean) {
  const email = await requireUser();
  if (!taskDid) throw new Error("Missing task");

  const svc = createServiceClient();
  const ex = (await existingRow(svc, taskDid)) as Record<string, unknown>;

  const merged: Record<string, unknown> = {
    task_did: taskDid,
    subcon: ex.subcon ?? null,
    gc: ex.gc ?? null,
    carrier: ex.carrier ?? null,
    market: ex.market ?? null,
    project: ex.project ?? null,
    fuze_id: ex.fuze_id ?? null,
    verified,
    verified_by: verified ? email : null,
    verified_at: verified ? new Date().toISOString() : null,
    chosen_line_key: ex.chosen_line_key ?? null,
    service_rate_override: ex.service_rate_override ?? null,
    product_service_override: ex.product_service_override ?? null,
    line_items: ex.line_items ?? null,
    updated_by: email,
    updated_at: new Date().toISOString(),
  };

  const { error } = await svc
    .schema("app_quote")
    .from("overrides")
    .upsert(merged, { onConflict: "task_did" });
  if (error) throw new Error(error.message);

  revalidatePath("/");
}

// ---- Quote Directory CRUD (Supabase reference.ref_quote_directory is the source of truth) ----

interface DirectoryInput {
  id?: number;
  gc: string;
  carrier: string;
  market: string;
  project: string;
  recipient: string;
  cc: string;
}

// must match the SQL match_key in v_quote_review's directory join
const normPart = (s: string) => (s ?? "").trim().replace(/\s+/g, " ").toUpperCase();

export async function upsertDirectoryEntry(entry: DirectoryInput) {
  await requireUser();
  const svc = createServiceClient();
  const parts = [entry.gc, entry.carrier, entry.market, entry.project];
  const row = {
    gc: entry.gc?.trim() || null,
    carrier: entry.carrier?.trim() || null,
    market: entry.market?.trim() || null,
    project: entry.project?.trim() || null,
    recipient: entry.recipient?.trim() || null,
    cc: entry.cc?.trim() || null,
    textjoin: parts.map((p) => (p ?? "").trim()).join("_"),
    match_key: parts.map(normPart).join("|"),
  };
  const q = svc.schema("reference").from("ref_quote_directory");
  const { error } = entry.id
    ? await q.update(row).eq("id", entry.id)
    : await q.insert(row);
  if (error) throw new Error(error.message);
  revalidatePath("/directory");
  revalidatePath("/");
}

export async function deleteDirectoryEntry(id: number) {
  await requireUser();
  const svc = createServiceClient();
  const { error } = await svc.schema("reference").from("ref_quote_directory").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/directory");
  revalidatePath("/");
}

/** Override the Service Rate ($) for an entry, or clear (null) to use the invoice line's rate. */
export async function setServiceRate(taskDid: string, rate: string | null) {
  const email = await requireUser();
  if (!taskDid) throw new Error("Missing task");
  const clean = rate == null ? null : (rate.replace(/[^0-9.]/g, "") || null);

  const svc = createServiceClient();
  const ex = (await existingRow(svc, taskDid)) as Record<string, unknown>;
  const merged: Record<string, unknown> = {
    task_did: taskDid,
    subcon: ex.subcon ?? null,
    gc: ex.gc ?? null,
    carrier: ex.carrier ?? null,
    market: ex.market ?? null,
    project: ex.project ?? null,
    fuze_id: ex.fuze_id ?? null,
    verified: ex.verified ?? false,
    verified_by: ex.verified_by ?? null,
    verified_at: ex.verified_at ?? null,
    chosen_line_key: ex.chosen_line_key ?? null,
    service_rate_override: clean,
    product_service_override: ex.product_service_override ?? null,
    line_items: ex.line_items ?? null,
    updated_by: email,
    updated_at: new Date().toISOString(),
  };
  const { error } = await svc.schema("app_quote").from("overrides").upsert(merged, { onConflict: "task_did" });
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

/**
 * Override the Product/Service label for an entry, or clear (null) to use the
 * parsed/invoice-line value. Empty input is treated as clear (auto).
 */
export async function setProductService(taskDid: string, value: string | null) {
  const email = await requireUser();
  if (!taskDid) throw new Error("Missing task");
  const clean = value == null ? null : (value.trim() || null);

  const svc = createServiceClient();
  const ex = (await existingRow(svc, taskDid)) as Record<string, unknown>;
  const merged: Record<string, unknown> = {
    task_did: taskDid,
    subcon: ex.subcon ?? null,
    gc: ex.gc ?? null,
    carrier: ex.carrier ?? null,
    market: ex.market ?? null,
    project: ex.project ?? null,
    fuze_id: ex.fuze_id ?? null,
    verified: ex.verified ?? false,
    verified_by: ex.verified_by ?? null,
    verified_at: ex.verified_at ?? null,
    chosen_line_key: ex.chosen_line_key ?? null,
    service_rate_override: ex.service_rate_override ?? null,
    product_service_override: clean,
    line_items: ex.line_items ?? null,
    updated_by: email,
    updated_at: new Date().toISOString(),
  };
  const { error } = await svc.schema("app_quote").from("overrides").upsert(merged, { onConflict: "task_did" });
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

/**
 * Return a generated quote to the queue: delete its Drive PDF (if any) and the
 * generated record, so the entry is fully back in the to-do list for a fix.
 */
export async function returnToQueue(taskDid: string) {
  await requireUser();
  if (!taskDid) throw new Error("Missing task");
  const svc = createServiceClient();
  const { data, error } = await svc
    .schema("app_quote")
    .from("generated")
    .select("drive_file_id")
    .eq("task_did", taskDid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.drive_file_id) await deleteDriveFile(data.drive_file_id as string);
  const { error: delErr } = await svc
    .schema("app_quote")
    .from("generated")
    .delete()
    .eq("task_did", taskDid);
  if (delErr) throw new Error(delErr.message);
  revalidatePath("/");
  revalidatePath("/generated");
}

/** Return many generated quotes at once: delete each Drive PDF + record. */
export async function returnManyToQueue(taskDids: string[]) {
  await requireUser();
  const dids = Array.from(new Set((taskDids ?? []).filter(Boolean)));
  if (dids.length === 0) return;
  const svc = createServiceClient();
  const { data, error } = await svc
    .schema("app_quote")
    .from("generated")
    .select("task_did, drive_file_id")
    .in("task_did", dids);
  if (error) throw new Error(error.message);
  for (const r of data ?? []) {
    if (r.drive_file_id) await deleteDriveFile(r.drive_file_id as string);
  }
  const { error: delErr } = await svc
    .schema("app_quote")
    .from("generated")
    .delete()
    .in("task_did", dids);
  if (delErr) throw new Error(delErr.message);
  revalidatePath("/");
  revalidatePath("/generated");
}

/** Pick which priced invoice line to use (by its stable line_key), or clear (null). */
export async function setChosenInvoice(taskDid: string, lineKey: string | null) {
  const email = await requireUser();
  if (!taskDid) throw new Error("Missing task");

  const svc = createServiceClient();
  const ex = (await existingRow(svc, taskDid)) as Record<string, unknown>;

  const merged: Record<string, unknown> = {
    task_did: taskDid,
    subcon: ex.subcon ?? null,
    gc: ex.gc ?? null,
    carrier: ex.carrier ?? null,
    market: ex.market ?? null,
    project: ex.project ?? null,
    fuze_id: ex.fuze_id ?? null,
    verified: ex.verified ?? false,
    verified_by: ex.verified_by ?? null,
    verified_at: ex.verified_at ?? null,
    chosen_line_key: lineKey,
    service_rate_override: ex.service_rate_override ?? null,
    product_service_override: ex.product_service_override ?? null,
    line_items: ex.line_items ?? null,
    updated_by: email,
    updated_at: new Date().toISOString(),
  };

  const { error } = await svc
    .schema("app_quote")
    .from("overrides")
    .upsert(merged, { onConflict: "task_did" });
  if (error) throw new Error(error.message);

  revalidatePath("/");
}

/**
 * Set/replace the multi-line items for a quote, or clear (null) to return to the
 * single-line quote. Empty/all-blank input clears. Other overrides are preserved.
 */
export async function setLineItems(taskDid: string, items: QuoteLineItem[] | null) {
  const email = await requireUser();
  if (!taskDid) throw new Error("Missing task");
  const clean = normalizeLineItems(items);

  const svc = createServiceClient();
  const ex = (await existingRow(svc, taskDid)) as Record<string, unknown>;
  const merged: Record<string, unknown> = {
    task_did: taskDid,
    subcon: ex.subcon ?? null,
    gc: ex.gc ?? null,
    carrier: ex.carrier ?? null,
    market: ex.market ?? null,
    project: ex.project ?? null,
    fuze_id: ex.fuze_id ?? null,
    verified: ex.verified ?? false,
    verified_by: ex.verified_by ?? null,
    verified_at: ex.verified_at ?? null,
    chosen_line_key: ex.chosen_line_key ?? null,
    service_rate_override: ex.service_rate_override ?? null,
    product_service_override: ex.product_service_override ?? null,
    line_items: clean,
    updated_by: email,
    updated_at: new Date().toISOString(),
  };
  const { error } = await svc.schema("app_quote").from("overrides").upsert(merged, { onConflict: "task_did" });
  if (error) throw new Error(error.message);
  revalidatePath("/");
}
