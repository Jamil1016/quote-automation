import { createServiceClient } from "@/lib/supabase/service";
import type { AssetTaskRow, CategorySuggestions, DirectoryRow, EmailQueueRow, EmailTemplate, InvoiceOption, QuoteData, QuoteRow, SourceInvoiceRow } from "./types";
import type { SendIdentity } from "./send-identities";
import { resolveTheme, type Theme } from "./theme";
import { isDemoMode } from "@/lib/demo/mode";
import { flushDueDemoEmails } from "@/lib/demo/actions";

export async function getQuoteData(): Promise<QuoteData> {
  const supabase = createServiceClient();
  // These three reads are independent — fire them concurrently. Run serially
  // they cost the sum (~v_quote_review 670ms + options 120ms + loaded_at 165ms);
  // in parallel the page waits only on the slowest (v_quote_review).
  const [reviewRes, optsRes, invRefreshedRes, taskRefreshedRes, genRes, emailedRes] = await Promise.all([
    supabase
      .schema("analytics")
      .from("v_quote_review")
      .select("*")
      .order("asset_name", { ascending: true }),
    supabase
      .schema("analytics")
      .from("mv_quote_invoice_options")
      .select("task_did, line_key, product_service, product_service_type, service_rate, site_id, project, requirement_status, form_did"),
    supabase
      .schema("data_staging")
      .from("stg_invoicing_form")
      .select("loaded_at")
      .order("loaded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .schema("data_staging")
      .from("stg_asset_tasks")
      .select("loaded_at")
      .order("loaded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .schema("app_quote")
      .from("generated")
      .select("task_did, drive_file_id, drive_link, generated_by, generated_at"),
    // Any task that has touched the Outbox (any status) is excluded from the
    // Queue so a data refresh can't re-add an already-emailed asset.
    supabase
      .schema("app_quote")
      .from("email_queue")
      .select("task_did")
      .is("returned_at", null),
  ]);
  if (reviewRes.error) throw new Error(`v_quote_review read failed: ${reviewRes.error.message}`);
  if (optsRes.error) throw new Error(`mv_quote_invoice_options read failed: ${optsRes.error.message}`);

  // Merge generated-to-Drive state onto each row (small table, joined in app).
  const gen = new Map((genRes.data ?? []).map((g: Record<string, string | null>) => [g.task_did, g]));
  // Set of task_dids present anywhere in the email Outbox.
  const emailed = new Set((emailedRes.data ?? []).map((e: Record<string, string>) => e.task_did));
  const rows = (reviewRes.data ?? []).map((r: Record<string, unknown>) => {
    const g = gen.get(r.task_did as string);
    return {
      ...r,
      generated_at: g?.generated_at ?? null,
      generated_by: g?.generated_by ?? null,
      drive_link: g?.drive_link ?? null,
      drive_file_id: g?.drive_file_id ?? null,
      emailed: emailed.has(r.task_did as string),
    };
  }) as QuoteRow[];

  // Live suggestion list for the editable Product/Service combobox: every distinct
  // value currently on an entry (incl. saved overrides, via the view) plus every
  // invoice-line value. Recomputed each load, so new values always appear.
  const productServiceValues = Array.from(
    new Set(
      [
        ...rows.map((r) => r.inv_product_service),
        ...((optsRes.data ?? []) as InvoiceOption[]).map((o) => o.product_service),
      ]
        .filter((v): v is string => !!v && v.trim() !== "")
        .map((v) => v.trim()),
    ),
  ).sort((a, b) => a.localeCompare(b));

  return {
    rows,
    options: (optsRes.data ?? []) as InvoiceOption[],
    refreshedAt: invRefreshedRes.data?.loaded_at ?? null,
    assetTasksRefreshedAt: taskRefreshedRes.data?.loaded_at ?? null,
    productServiceValues,
  };
}

export async function getDirectory(): Promise<DirectoryRow[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .schema("reference")
    .from("ref_quote_directory")
    .select("id, gc, carrier, market, project, recipient, cc")
    .order("gc", { ascending: true })
    .order("carrier", { ascending: true })
    .order("market", { ascending: true })
    .order("project", { ascending: true });
  if (error) throw new Error(`ref_quote_directory read failed: ${error.message}`);
  return (data ?? []) as DirectoryRow[];
}

/** Data Source tab: the Quote-Provided worklist asset tasks (enriched + org/project). */
export async function getAssetTasks(): Promise<AssetTaskRow[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("v_quote_source_asset_tasks")
    .select("task_did, org_name, project_name, asset_name, asset_id, task_name, subcon, gc, carrier, market, project, fuze_id")
    .order("asset_name", { ascending: true });
  if (error) throw new Error(`asset tasks read failed: ${error.message}`);
  return (data ?? []) as AssetTaskRow[];
}

/** Data Source tab: invoicing-form rows referencing those tasks (priced + unpriced). */
export async function getSourceInvoiceLines(): Promise<SourceInvoiceRow[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .schema("analytics")
    .from("mv_quote_source_invoice_lines")
    .select("*")
    .order("asset_name", { ascending: true });
  if (error) throw new Error(`source invoice lines read failed: ${error.message}`);
  return (data ?? []) as SourceInvoiceRow[];
}

export async function getCategorySuggestions(): Promise<CategorySuggestions> {
  const supabase = createServiceClient();
  // Read from the base MV, NOT v_quote_review: the view recomputes the live
  // directory token-match per row (~500ms). We only need distinct category
  // values here, and the MV has them — ~0.3ms vs ~500ms.
  const { data, error } = await supabase
    .schema("analytics")
    .from("mv_quote_review")
    .select("gc, carrier, market, project");
  if (error) throw new Error(`category suggestions read failed: ${error.message}`);
  const uniq = (key: "gc" | "carrier" | "market" | "project") =>
    Array.from(new Set((data ?? []).map((r: Record<string, string | null>) => r[key]).filter((v): v is string => !!v))).sort();
  return { gc: uniq("gc"), carrier: uniq("carrier"), market: uniq("market"), project: uniq("project") };
}

export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .schema("app_quote").from("email_templates")
    .select("id, name, subject, body_html").order("name");
  if (error) throw new Error(`email templates read failed: ${error.message}`);
  return (data ?? []) as EmailTemplate[];
}

export async function getEmailQueue(): Promise<EmailQueueRow[]> {
  // A demo has no cron calling the dispatcher, so due rows are settled on read.
  if (isDemoMode()) await flushDueDemoEmails();
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .schema("app_quote").from("email_queue")
    .select("id, task_did, sender_email, scheduled_at, status, subject_resolved, to_resolved, cc_resolved, template_name, created_by, created_at, sent_at, error, from_email, returned_to, returned_by, returned_at")
    .order("scheduled_at", { ascending: false }).limit(300);
  if (error) throw new Error(`email queue read failed: ${error.message}`);
  return (data ?? []) as EmailQueueRow[];
}

export interface GmailConnection { email: string; status: string; connected_at: string }

/** The current user's own connected Gmail senders. */
export async function getMyConnections(user: string): Promise<GmailConnection[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .schema("app_quote").from("gmail_connections")
    .select("email, status, connected_at").eq("connected_by", user).order("connected_at");
  if (error) throw new Error(`gmail connections read failed: ${error.message}`);
  return (data ?? []) as GmailConnection[];
}

/** The current user's active sender email (null if none set). */
export async function getActiveSenderEmail(user: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .schema("app_quote").from("user_settings")
    .select("active_sender_email").eq("user_email", user).maybeSingle();
  if (error) throw new Error(`user settings read failed: ${error.message}`);
  return (data?.active_sender_email as string | null) ?? null;
}

/** The current user's saved default "send as" address (null = own account address). */
export async function getActiveFrom(user: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .schema("app_quote").from("user_settings")
    .select("active_from_email").eq("user_email", user).maybeSingle();
  if (error) throw new Error(`user settings read failed: ${error.message}`);
  return (data?.active_from_email as string | null) ?? null;
}

/**
 * The user's active sender AND saved default "send as" address in ONE read.
 * Both live on the same `user_settings` row, so this avoids two
 * separate round-trips (a real cost when the function region is far from the DB).
 */
export async function getSendSettings(
  user: string,
): Promise<{ activeSender: string | null; activeFrom: string | null }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .schema("app_quote").from("user_settings")
    .select("active_sender_email, active_from_email").eq("user_email", user).maybeSingle();
  if (error) throw new Error(`user settings read failed: ${error.message}`);
  return {
    activeSender: (data?.active_sender_email as string | null) ?? null,
    activeFrom: (data?.active_from_email as string | null) ?? null,
  };
}

/** The current user's saved UI theme (defaults to "ledger"). */
export async function getTheme(user: string): Promise<Theme> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .schema("app_quote").from("user_settings")
    .select("theme").eq("user_email", user).maybeSingle();
  if (error) throw new Error(`theme read failed: ${error.message}`);
  return resolveTheme(data?.theme as string | null);
}

export interface MaskRow {
  id: number;
  name: string;
  email: string;
  scope: "shared" | "personal";
  owner_email: string | null;
  created_by: string;
}

/** The user's effective send-as choices: shared masks + their own personal, deduped by email (shared wins). */
export async function getSendIdentitiesFor(user: string): Promise<SendIdentity[]> {
  const supabase = createServiceClient();
  const [sharedRes, personalRes] = await Promise.all([
    supabase.schema("app_quote").from("send_identities")
      .select("name, email").eq("scope", "shared").order("name"),
    supabase.schema("app_quote").from("send_identities")
      .select("name, email").eq("scope", "personal").eq("owner_email", user).order("name"),
  ]);
  if (sharedRes.error) throw new Error(`send identities read failed: ${sharedRes.error.message}`);
  if (personalRes.error) throw new Error(`send identities read failed: ${personalRes.error.message}`);
  const seen = new Set<string>();
  const out: SendIdentity[] = [];
  for (const r of [...(sharedRes.data ?? []), ...(personalRes.data ?? [])] as { name: string; email: string }[]) {
    if (seen.has(r.email)) continue;
    seen.add(r.email);
    out.push({ name: r.name, email: r.email });
  }
  return out;
}

/** Masks for the /settings manager: all shared, plus the user's own personal. */
export async function getManagedMasks(user: string): Promise<{ shared: MaskRow[]; personal: MaskRow[] }> {
  const supabase = createServiceClient();
  const cols = "id, name, email, scope, owner_email, created_by";
  const [sharedRes, personalRes] = await Promise.all([
    supabase.schema("app_quote").from("send_identities")
      .select(cols).eq("scope", "shared").order("name"),
    supabase.schema("app_quote").from("send_identities")
      .select(cols).eq("scope", "personal").eq("owner_email", user).order("name"),
  ]);
  if (sharedRes.error) throw new Error(`managed masks read failed: ${sharedRes.error.message}`);
  if (personalRes.error) throw new Error(`managed masks read failed: ${personalRes.error.message}`);
  return { shared: (sharedRes.data ?? []) as MaskRow[], personal: (personalRes.data ?? []) as MaskRow[] };
}

export type SwiftAccount = { username: string; verifiedAt: string | null };

/** The caller's connected PM API account: username + verified date only.
 * Never returns the encrypted password. NULL swift_username = not connected. */
export async function getSwiftAccount(me: string): Promise<SwiftAccount | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .schema("app_quote").from("user_settings")
    .select("swift_username, swift_verified_at").eq("user_email", me).maybeSingle();
  if (!data?.swift_username) return null;
  return { username: data.swift_username as string, verifiedAt: (data.swift_verified_at as string | null) ?? null };
}
