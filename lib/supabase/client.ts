import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client for Client Components.
 *
 * RLS context: authenticated user's JWT. Never the service role.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
