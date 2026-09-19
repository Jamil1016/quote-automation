import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { exchangeCode } from "@/lib/google/gmail";
import { encryptSecret } from "@/lib/google/token-crypto";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(req: NextRequest) {
  const back = (q: string) => NextResponse.redirect(new URL(`/generated?${q}`, req.url));
  let user: string;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.redirect(new URL("/signin", req.url));
  }
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("gmail_oauth_state")?.value;
  if (!code || !state || state !== cookieState) return back("gmail=error&reason=state");

  try {
    const redirectUri = `${req.nextUrl.origin}/api/gmail/callback`;
    const { email, refreshToken } = await exchangeCode(code, redirectUri);
    const svc = createServiceClient();
    const { error } = await svc
      .schema("app_quote")
      .from("gmail_connections")
      .upsert(
        {
          email,
          refresh_token_enc: encryptSecret(refreshToken),
          connected_by: user,
          connected_at: new Date().toISOString(),
          status: "active",
          last_error: null,
        },
        { onConflict: "connected_by,email" },
      );
    if (error) throw new Error(error.message);

    // First account a user connects becomes their active sender.
    const { data: s } = await svc
      .schema("app_quote").from("user_settings")
      .select("active_sender_email").eq("user_email", user).maybeSingle();
    if (!s?.active_sender_email) {
      await svc.schema("app_quote").from("user_settings")
        .upsert({ user_email: user, active_sender_email: email, updated_at: new Date().toISOString() },
          { onConflict: "user_email" });
    }
    return back(`gmail=connected&email=${encodeURIComponent(email)}`);
  } catch (e) {
    return back(`gmail=error&reason=${encodeURIComponent((e as Error).message)}`);
  }
}
