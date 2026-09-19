import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. BYPASSES RLS.
 *
 * ONLY use for:
 *   - Cron jobs (`scripts/refresh-data-freshness.ts`)
 *   - Admin-only operations that explicitly need to write `agent.*` tables
 *     on behalf of a user whose role allows it
 *   - User provisioning (creating `agent.users` rows from `/admin`)
 *
 * NEVER use to answer a user's chat question — those go through the user's
 * JWT'd server client so RLS at the database remains the trust boundary.
 *
 * If you find yourself reaching for this from a route handler that serves a
 * user, stop and write the RLS policy instead.
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local for local dev."
    );
  }
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
