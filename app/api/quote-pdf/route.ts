import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/auth/require-user";
import { quoteFilename, renderQuotePdf } from "@/lib/quotes/pdf-render";
import type { QuoteRow } from "@/lib/quotes/types";

// @react-pdf renders in Node (Buffer/streams); keep this off the edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/quote-pdf?task_did=...[&inline=1]
 * `inline=1` opens the PDF in the browser instead of downloading it (demo-mode
 * "open PDF" links point here because no Drive file exists).
 * Renders the SAME <QuoteDocument> the on-screen preview uses to a single-page
 * A4 PDF (via the shared renderer) and returns it as a download. Auth + allowlist gated.
 */
export async function GET(req: NextRequest) {
  try {
    await requireUser();
  } catch {
    return new Response("Not authorized", { status: 403 });
  }

  const taskDid = req.nextUrl.searchParams.get("task_did");
  if (!taskDid) return new Response("Missing task_did", { status: 400 });

  const svc = createServiceClient();
  const { data, error } = await svc
    .schema("analytics")
    .from("v_quote_review")
    .select("*")
    .eq("task_did", taskDid)
    .maybeSingle();
  if (error) return new Response(error.message, { status: 500 });
  if (!data) return new Response("Quote not found", { status: 404 });
  const row = data as QuoteRow;

  const pdf = await renderQuotePdf(row);

  const filename = quoteFilename(row.asset_name);
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  // Uint8Array is a valid response body at runtime; cast past the SharedArrayBuffer union.
  return new Response(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
