import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireUser } from "@/lib/auth/require-user";
import { gmailAuthUrl } from "@/lib/google/gmail";
import { isDemoMode } from "@/lib/demo/mode";
import { connectDemoMailbox } from "@/lib/demo/actions";

export async function GET(req: NextRequest) {
  let user: string;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.redirect(new URL("/signin", req.url));
  }
  // Demo: record a fake mailbox instead of going through Google's consent screen.
  if (isDemoMode()) {
    try {
      const email = await connectDemoMailbox(user);
      return NextResponse.redirect(new URL(`/generated?gmail=connected&email=${encodeURIComponent(email)}`, req.url));
    } catch (e) {
      return NextResponse.redirect(new URL(`/generated?gmail=error&reason=${encodeURIComponent((e as Error).message)}`, req.url));
    }
  }
  const state = randomBytes(16).toString("hex");
  const redirectUri = `${req.nextUrl.origin}/api/gmail/callback`;
  const res = NextResponse.redirect(gmailAuthUrl(redirectUri, state));
  res.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    maxAge: 600,
    path: "/api/gmail",
  });
  return res;
}
