"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { DEMO_USER_EMAIL, isDemoMode } from "@/lib/demo/mode";

/**
 * Server Action: kick off the Google OAuth flow via Supabase Auth.
 *
 * Requires Google to be configured as an auth provider for the project:
 *
 *   1. Supabase Dashboard → Authentication → Providers → Google → Enable
 *   2. Paste a Google OAuth Client ID + Secret (Google Cloud Console, Web client)
 *   3. Add the redirect URL Supabase shows you to the client's
 *      "Authorized redirect URIs"
 *
 * If the provider is not configured, Supabase returns an error and the sign-in
 * page shows a setup hint. After sign-in the (app) layout still applies the
 * QUOTE_APP_ALLOWED_EMAILS allowlist.
 */
export async function signInWithGoogle(): Promise<void> {
  const supabase = await createClient();
  const reqHeaders = await headers();
  const origin =
    reqHeaders.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });

  if (error) {
    // Surface a useful query param so the page can show a friendly hint
    // (e.g., "Google provider isn't enabled yet").
    redirect(`/signin?err=${encodeURIComponent(error.message)}`);
  }

  if (data?.url) redirect(data.url);
  redirect("/signin?err=no_redirect");
}

/**
 * Server Action (DEMO_MODE only): sign in the seeded demo user with email +
 * password, no Google involved. The user is created once in Supabase Auth
 * (see README, "Run the demo") and its password lives in DEMO_USER_PASSWORD,
 * which never leaves the server. Refuses outright when DEMO_MODE is off.
 */
export async function enterDemo(): Promise<void> {
  if (!isDemoMode()) redirect("/signin?err=" + encodeURIComponent("Demo mode is not enabled."));
  const password = process.env.DEMO_USER_PASSWORD;
  if (!password) redirect("/signin?err=" + encodeURIComponent("DEMO_USER_PASSWORD is not set."));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: DEMO_USER_EMAIL, password });
  if (error) {
    redirect(
      "/signin?err=" +
        encodeURIComponent(`Demo sign-in failed: ${error.message}. Create the ${DEMO_USER_EMAIL} user in Supabase Auth (see README).`),
    );
  }
  redirect("/");
}
