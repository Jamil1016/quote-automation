import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. BYPASSES RLS. Server-only.
 *
 * This app does ALL of its database reads and writes through this client.
 * The trust boundary is therefore in application code, not in RLS policies:
 *
 *   - every page sits behind the (app) layout gate (signed in + allowlisted), and
 *   - every Server Action / Route Handler calls `requireUser()` first (or, for
 *     the queue dispatcher, checks a shared secret) before touching this client.
 *
 * The database side is locked down to match (supabase/schema.sql): RLS is
 * enabled on every table with no policies, and nothing is granted to `anon` or
 * `authenticated`, so the browser's anon key cannot read any of it.
 *
 * Rules: never import this from a Client Component, and never call it from a
 * handler that has not authenticated the caller.
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
