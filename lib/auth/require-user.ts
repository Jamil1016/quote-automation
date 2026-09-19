import { createClient } from "@/lib/supabase/server";
import { currentAllowlist, isAllowed } from "@/lib/auth/allowlist";

/**
 * Re-check auth + allowlist (server actions and route handlers don't inherit
 * the (app) layout gate), then return the caller's email, lowercased.
 *
 * Lowercasing is the normalization invariant: Supabase Auth does not normalize
 * email case, but every reader (settings page, queries filtering owner_email/
 * user_email) lowercases, so producers must too or a mixed-case user would lose
 * sight of their own rows.
 */
export async function requireUser(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAllowed(user.email, currentAllowlist())) {
    throw new Error("Not authorized");
  }
  return (user.email as string).toLowerCase();
}
