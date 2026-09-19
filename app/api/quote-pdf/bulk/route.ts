import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/auth/require-user";
import { mapPool, quoteFilename, renderQuotePdf } from "@/lib/quotes/pdf-render";
import { getQuoteUploader } from "@/lib/google/drive";
import { quoteProblem, type BulkEvent, type ProblemEntry } from "@/lib/quotes/bulk";
import type { QuoteRow } from "@/lib/quotes/types";

// @react-pdf renders in Node; keep this off the edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Render this many PDFs / uploads concurrently. @react-pdf renders are CPU-bound
// and Drive uploads are I/O-bound; this keeps a big batch moving without
// hammering memory or the Drive API.
const CONCURRENCY = 4;

/**
 * POST /api/quote-pdf/bulk  body: { task_dids: string[] }
 *
 * Generates one quote PDF per asset (the same <QuoteDocument> as the single
 * download) and uploads each to the generated-quotes Drive folder. Streams
 * NDJSON progress so the UI can show live status.
 *
 * SAFETY: this route sends no email; it only renders + stores to Drive
 * (in DEMO_MODE: renders, and records a fake file id instead of uploading).
 * The run is REFUSED (422) if any requested row has a problem (no price /
 * no match / needs review), with the offending assets listed back.
 */
export async function POST(req: NextRequest) {
  let userEmail: string;
  try {
    userEmail = await requireUser();
  } catch {
    return new Response("Not authorized", { status: 403 });
  }

  let body: { task_dids?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const taskDids = Array.isArray(body.task_dids)
    ? Array.from(new Set(body.task_dids.filter((d): d is string => typeof d === "string" && !!d)))
    : [];
  if (taskDids.length === 0) return new Response("No tasks selected", { status: 400 });

  const svc = createServiceClient();
  const { data, error } = await svc
    .schema("analytics")
    .from("v_quote_review")
    .select("*")
    .in("task_did", taskDids);
  if (error) return new Response(error.message, { status: 500 });

  const rows = (data ?? []) as QuoteRow[];
  const byDid = new Map(rows.map((r) => [r.task_did, r]));

  // Server-side problem gate (the UI also gates, this is the backstop).
  const problems: ProblemEntry[] = [];
  for (const did of taskDids) {
    const row = byDid.get(did);
    if (!row) {
      problems.push({ task_did: did, asset: did, reason: "not_found" });
      continue;
    }
    const reason = quoteProblem(row);
    if (reason) problems.push({ task_did: did, asset: row.asset_name, reason });
  }
  if (problems.length > 0) {
    return Response.json({ error: "problems", problems }, { status: 422 });
  }

  // All clear — generate + upload, streaming progress as NDJSON.
  const ordered = taskDids.map((d) => byDid.get(d)!).sort((a, b) => a.asset_name.localeCompare(b.asset_name));
  const enc = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: BulkEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      let uploaded = 0;
      let failed = 0;
      const generated: { task_did: string; drive_file_id: string; drive_link: string; generated_by: string; generated_at: string }[] = [];
      try {
        emit({ type: "start", total: ordered.length });
        const uploader = await getQuoteUploader();
        await mapPool(ordered, CONCURRENCY, async (row) => {
          try {
            const pdf = await renderQuotePdf(row);
            const { id, link, updated } = await uploader.upload(quoteFilename(row.asset_name), pdf, { taskDid: row.task_did });
            uploaded++;
            generated.push({ task_did: row.task_did, drive_file_id: id, drive_link: link, generated_by: userEmail, generated_at: new Date().toISOString() });
            emit({ type: "progress", asset: row.asset_name, ok: true, link, updated });
          } catch (e) {
            failed++;
            emit({ type: "progress", asset: row.asset_name, ok: false, error: e instanceof Error ? e.message : String(e) });
          }
        });
        // Persist generated state so the queue shows the badge + Drive link, and
        // "Return to queue" can later delete the file. Upsert: re-generating bumps
        // generated_at (clears the "edited since generated" stale flag).
        if (generated.length > 0) {
          const { error: genErr } = await svc
            .schema("app_quote")
            .from("generated")
            .upsert(generated, { onConflict: "task_did" });
          if (genErr) emit({ type: "progress", asset: "—", ok: false, error: `saved to Drive but failed to record generated state: ${genErr.message}` });
        }
        emit({ type: "done", uploaded, failed });
      } catch (e) {
        // A whole-batch failure (Drive auth / renderer setup). Report and end.
        emit({ type: "progress", asset: "—", ok: false, error: e instanceof Error ? e.message : String(e) });
        emit({ type: "done", uploaded, failed });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
