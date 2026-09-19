import type { DriveUploader } from "@/lib/google/drive";
import type { QuoteRow } from "@/lib/quotes/types";

/**
 * Demo stand-in for Google Drive. Nothing is stored: a "file" is just an id that
 * encodes the task, and its link points at the app's own PDF route, which
 * renders the quote from current data every time it is opened.
 */
const PREFIX = "demo-";

export function demoFileId(taskDid: string): string {
  return `${PREFIX}${taskDid}`;
}

/** The task a demo file id refers to, or null if it is not a demo id. */
export function taskDidFromDemoFileId(id: string): string | null {
  return id.startsWith(PREFIX) && id.length > PREFIX.length ? id.slice(PREFIX.length) : null;
}

/** Same-origin link that opens the rendered PDF in the browser. */
export function demoFileLink(taskDid: string): string {
  return `/api/quote-pdf?task_did=${encodeURIComponent(taskDid)}&inline=1`;
}

export function demoUploader(): DriveUploader {
  return {
    async upload(_name, _bytes, meta) {
      if (!meta?.taskDid) throw new Error("Demo uploader needs the task id");
      return { id: demoFileId(meta.taskDid), link: demoFileLink(meta.taskDid), updated: false };
    },
  };
}

/** "Download" = render the quote again (used when attaching the PDF to a draft). */
export async function demoDownload(id: string): Promise<Uint8Array> {
  const taskDid = taskDidFromDemoFileId(id);
  if (!taskDid) throw new Error(`Not a demo file id: ${id}`);
  const [{ createServiceClient }, { renderQuotePdf }] = await Promise.all([
    import("@/lib/supabase/service"),
    import("@/lib/quotes/pdf-render"),
  ]);
  const { data, error } = await createServiceClient()
    .schema("analytics").from("v_quote_review").select("*").eq("task_did", taskDid).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Quote not found: ${taskDid}`);
  return renderQuotePdf(data as QuoteRow);
}
