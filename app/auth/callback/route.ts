import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase OAuth callback. Google redirects here with a `?code=...`,
 * we exchange it for a session, then bounce to the app home.
 */
/**
 * Restrict `?next=` to same-origin paths only.
 * Rejects:
 *   - protocol-relative (`//evil.com`) → would land on evil.com
 *   - backslash variants (`/\evil.com`) → some browsers/servers normalize
 *   - absolute URLs (`https://evil.com`)
 *   - missing leading slash (relative paths resolve unpredictably)
 */
function safeNext(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${url.origin}/signin?err=${encodeURIComponent(error.message)}`
      );
    }
  }

  return NextResponse.redirect(`${url.origin}${next}`);
}
