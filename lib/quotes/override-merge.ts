/**
 * Pure merge for app_quote.overrides rows (kept out of actions.ts because a
 * "use server" module may only export async functions, and this needs tests).
 *
 * The row is upserted whole, so every write must carry every column: start from
 * the stored row (or the column defaults when there is none), then apply the
 * caller's patch, then stamp who/when. A patch value of `null` is meaningful
 * (it clears an override), so the patch is applied as-is, never coalesced.
 */
const OVERRIDE_DEFAULTS = {
  subcon: null,
  gc: null,
  carrier: null,
  market: null,
  project: null,
  fuze_id: null,
  verified: false,
  verified_by: null,
  verified_at: null,
  chosen_line_key: null,
  service_rate_override: null,
  product_service_override: null,
  line_items: null,
} as const;

export type OverrideColumn = keyof typeof OVERRIDE_DEFAULTS;

export function mergeOverride(
  taskDid: string,
  existing: Record<string, unknown>,
  patch: Record<string, unknown>,
  updatedBy: string,
  nowIso: string,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { task_did: taskDid };
  for (const col of Object.keys(OVERRIDE_DEFAULTS) as OverrideColumn[]) {
    merged[col] = existing[col] ?? OVERRIDE_DEFAULTS[col];
  }
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in OVERRIDE_DEFAULTS)) throw new Error(`Unknown override column: ${k}`);
    merged[k] = v;
  }
  merged.updated_by = updatedBy;
  merged.updated_at = nowIso;
  return merged;
}
