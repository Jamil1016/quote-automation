import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/**
 * The shape of a fully-resolved app user.
 *
 * `authUser` is the Supabase Auth row (identity).
 * `portalUser` is the row from `agent.users` (role, scope, display name).
 *
 * If `portalUser` is null, the signed-in identity has no provisioned portal
 * access yet — the layout should redirect them to a friendly "ask your admin
 * to invite you" page rather than crash.
 */
export type DataScopeDomain =
  | "workforce"
  | "field_ops"
  | "finance"
  | "quality"
  | "all";

export type DataScope = {
  domains?: DataScopeDomain[];
  projects?: string[];
};

export type PortalUser = {
  id: string;
  auth_id: string;
  email: string;
  display_name: string | null;
  org_id: string;
  role_id: string;
  role_name: string;
  is_superuser: boolean;
  is_active: boolean;
  data_scope: DataScope;
};

export type AppSession = {
  authUser: User;
  portalUser: PortalUser | null;
};

/**
 * Resolve the current request's signed-in user.
 *
 * Returns `null` if there's no signed-in user at all.
 * Returns `{ authUser, portalUser: null }` if signed in but not yet provisioned.
 */
export async function getSession(): Promise<AppSession | null> {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;

  // OPTIONAL: a profile row (display name, role) from an `agent.users` table that
  // exists only in the internal deployment. The public schema does not create it;
  // the query then returns an error, `portalUser` is null, and the UI falls back
  // to the email address. Nothing else depends on it.
  const { data: portalUser } = await supabase
    .schema("agent")
    .from("users")
    .select(
      "id, auth_id, email, display_name, org_id, role_id, is_superuser, is_active, data_scope, roles(name)"
    )
    .eq("auth_id", authUser.id)
    .eq("is_active", true)
    .maybeSingle<{
      id: string;
      auth_id: string;
      email: string;
      display_name: string | null;
      org_id: string;
      role_id: string;
      is_superuser: boolean;
      is_active: boolean;
      data_scope: DataScope;
      roles: { name: string } | null;
    }>();

  if (!portalUser) return { authUser, portalUser: null };

  return {
    authUser,
    portalUser: {
      id: portalUser.id,
      auth_id: portalUser.auth_id,
      email: portalUser.email,
      display_name: portalUser.display_name,
      org_id: portalUser.org_id,
      role_id: portalUser.role_id,
      role_name: portalUser.roles?.name ?? "Unknown",
      is_superuser: portalUser.is_superuser,
      is_active: portalUser.is_active,
      data_scope: portalUser.data_scope ?? {},
    },
  };
}
