import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Session refresh (Next 16 `proxy`, formerly `middleware`), following the
 * @supabase/ssr server-side auth pattern.
 *
 * Server Components cannot write cookies, so an access token refreshed during
 * render would be lost and the rotated refresh token reused on the next request.
 * Running `auth.getUser()` here first lets the refreshed cookies be written to
 * both the forwarded request and the response.
 *
 * This does NOT gate access. Authorization stays where it was: the (app) layout
 * and `requireUser()` check the signed-in user against the allowlist.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Keep this call directly after createServerClient: it is what validates the
  // JWT and triggers the refresh.
  try {
    await supabase.auth.getUser();
  } catch {
    // Auth service unreachable: let the request through; the page-level gate decides.
  }
  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and the secret-gated queue dispatcher
    // (called by a cron with no session cookies).
    "/((?!_next/static|_next/image|favicon.ico|api/email-queue/process|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
