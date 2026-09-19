import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cookie-bound Supabase client for Server Components, Route Handlers, and
 * Server Actions. Runs as the signed-in user (their JWT, read from cookies).
 *
 * In this app it is used for AUTH ONLY: `auth.getUser()`, sign-in, sign-out and
 * the OAuth code exchange. Data access goes through the service-role client
 * (lib/supabase/service.ts) after `requireUser()` has checked the caller.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components cannot set cookies. Safe to swallow: proxy.ts
            // refreshes the session cookie on every request before render.
          }
        },
      },
    }
  );
}
