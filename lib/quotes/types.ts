export type QuoteStatus = "ready" | "no_price" | "no_match";

export interface QuoteLineItem {
  product: string;
  qty: number;
  rate: number;
}

export interface QuoteRow {
  task_did: string;
  asset_id: string;
  asset_name: string;
  task_name: string;
  task_status: string;
  subcon: string | null;
  gc: string | null;
  carrier: string | null;
  market: string | null;
  project: string | null;       // scope segment
  fuze_id: string | null;
  needs_review: boolean;          // effective (base parse problem AND not verified)
  needs_review_base: boolean;     // raw parse flag
  verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  subcon_overridden: boolean;
  gc_overridden: boolean;
  carrier_overridden: boolean;
  market_overridden: boolean;
  project_overridden: boolean;
  fuze_id_overridden: boolean;
  service_rate_overridden: boolean;
  product_service_overridden: boolean;
  override_by: string | null;
  override_at: string | null;
  inv_project: string | null;
  inv_site_name: string | null;
  inv_site_id: string | null;
  inv_product_service: string | null;
  inv_product_service_type: string | null;  // "Invoice Category" | "Service Type"
  inv_invoice_category: string | null;
  inv_service_type: string | null;
  inv_sow: string | null;
  inv_service_rate: string | null;
  inv_requirement_status: string | null;
  inv_form_did: string | null;
  chosen_line_key: string | null;
  invoice_chosen: boolean;
  quote_recipient: string | null;
  quote_cc: string | null;
  directory_matched: boolean;
  directory_conflict: boolean;
  priced_line_count: number;
  status: QuoteStatus;
  // generated-to-Drive state (merged from generated, null if not generated)
  generated_at: string | null;
  generated_by: string | null;
  drive_link: string | null;
  drive_file_id: string | null;
  /** True if this task has any row in the email Outbox (scheduled/sent/cancelled/failed). */
  emailed: boolean;
  /** Multi-line quote items; null/empty = single-line (the default). */
  line_items: QuoteLineItem[] | null;
}

export interface InvoiceOption {
  task_did: string;
  line_key: string;
  product_service: string | null;
  product_service_type: string | null;
  service_rate: string | null;
  site_id: string | null;
  project: string | null;
  requirement_status: string | null;
  form_did: string | null;
}

export interface QuoteData {
  rows: QuoteRow[];
  options: InvoiceOption[];
  refreshedAt: string | null;            // invoicing-form last load (ISO UTC)
  assetTasksRefreshedAt: string | null;  // asset-tasks last load (ISO UTC)
  /** Distinct Product/Service values seen across all entries + invoice lines,
   *  for the editable Product/Service combobox. Recomputed live each load, so
   *  new values (including saved overrides) always show up. */
  productServiceValues: string[];
}

export interface DirectoryRow {
  id: number;
  gc: string | null;
  carrier: string | null;
  market: string | null;
  project: string | null;
  recipient: string | null;
  cc: string | null;
}

export interface CategorySuggestions {
  gc: string[];
  carrier: string[];
  market: string[];
  project: string[];
}

// --- Data Source tab ---
export interface AssetTaskRow {
  task_did: string;
  org_name: string | null;       // Organization
  project_name: string | null;   // PM-system project (e.g. "FIELD-OPS: METRO-EAST")
  asset_name: string;
  asset_id: string | null;
  task_name: string;
  // parsed from the Site-ID path (carrier-anchored / FTTH parse)
  subcon: string | null;
  gc: string | null;
  carrier: string | null;
  market: string | null;
  project: string | null;        // parsed scope (e.g. "FD-MIMO", "FTTH Phase 2")
  fuze_id: string | null;
}

export interface SourceInvoiceRow {
  task_did: string;
  asset_name: string;            // matched QP asset (search aid; not a column)
  project: string | null;
  site_name: string | null;
  site_id: string | null;
  sow: string | null;
  pricing_type: string | null;
  service_type: string | null;
  service_type_others: string | null;
  service_rate: string | null;
  ll_cop: string | null;
  landlord: string | null;
  landlord_others: string | null;
  pmi_cop: string | null;
  rf_mitigation_cop: string | null;
  priced: boolean;
  form_did: string | null;
}

// --- Email send feature ---
export interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  body_html: string;
}

export type EmailQueueStatus = "scheduled" | "sent" | "failed" | "cancelled";

export interface EmailQueueRow {
  id: number;
  task_did: string;
  sender_email: string;
  scheduled_at: string;
  status: EmailQueueStatus;
  subject_resolved: string;
  to_resolved: string;
  cc_resolved: string | null;
  template_name: string | null;
  created_by: string;
  created_at: string;
  sent_at: string | null;
  error: string | null;
  from_email: string | null;
  returned_to: "queue" | "generated" | null;
  returned_by: string | null;
  returned_at: string | null;
}
