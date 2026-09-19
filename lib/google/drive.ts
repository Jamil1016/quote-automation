import { OAuth2Client } from "google-auth-library";
import { isDemoMode } from "@/lib/demo/mode";
import { demoDownload, demoUploader } from "@/lib/demo/drive";

/**
 * Google Drive upload, acting as one Google user (e.g. dev@example.com) via an
 * OAuth refresh token. Files land in the folder named by QUOTE_DRIVE_FOLDER_ID
 * and are owned by that user, so this works even when the folder lives in My
 * Drive (a service account has no storage quota there).
 *
 * Server-only. The refresh token + secret come from env that is never shipped
 * to the client.
 *
 * DEMO_MODE: the three exported operations hand off to lib/demo/drive.ts and
 * never call Google.
 */

const DRIVE = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

function oauthClient(): OAuth2Client {
  const id = process.env.GDRIVE_CLIENT_ID;
  const secret = process.env.GDRIVE_CLIENT_SECRET;
  const refresh = process.env.GDRIVE_REFRESH_TOKEN;
  if (!id || !secret || !refresh) {
    throw new Error(
      "Drive not configured — set GDRIVE_CLIENT_ID / GDRIVE_CLIENT_SECRET / GDRIVE_REFRESH_TOKEN in .env.local",
    );
  }
  const c = new OAuth2Client(id, secret);
  c.setCredentials({ refresh_token: refresh });
  return c;
}

function folderId(): string {
  const f = process.env.QUOTE_DRIVE_FOLDER_ID;
  if (!f) throw new Error("QUOTE_DRIVE_FOLDER_ID is not set");
  return f;
}

async function accessToken(client: OAuth2Client): Promise<string> {
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Drive: could not obtain an access token");
  return token;
}

export function driveViewLink(id: string): string {
  return `https://drive.google.com/file/d/${id}/view`;
}

/**
 * Delete a Drive file by id (used by "Return to queue"). drive.file scope lets
 * the app delete files IT created. A 404 is treated as success — the file is
 * already gone, which is the desired end state. Other errors throw.
 */
export async function deleteDriveFile(id: string): Promise<void> {
  if (!id) return;
  if (isDemoMode()) return; // demo files are never stored, nothing to delete
  const token = await accessToken(oauthClient());
  const res = await fetch(`${DRIVE}/files/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Drive delete failed (${res.status}): ${await res.text()}`);
  }
}

/** A Drive uploader bound to one access token, reused across a whole batch. */
export interface DriveUploader {
  /** `meta.taskDid` is ignored by Drive; the demo uploader uses it to build its fake id. */
  upload(
    name: string,
    bytes: Uint8Array,
    meta?: { taskDid: string },
  ): Promise<{ id: string; link: string; updated: boolean }>;
}

/**
 * Mint one access token and a folder handle up front, then upload many files.
 * Each upload is idempotent on filename: if a quote with the same name already
 * exists in the folder, its content is replaced (PATCH) instead of creating a
 * duplicate — so re-running the bulk job overwrites rather than piles up.
 */
export async function getQuoteUploader(): Promise<DriveUploader> {
  if (isDemoMode()) return demoUploader();
  const client = oauthClient();
  const token = await accessToken(client);
  const folder = folderId();
  const auth = { Authorization: `Bearer ${token}` };

  async function findExisting(name: string): Promise<string | null> {
    const q = `name = '${name.replace(/'/g, "\\'")}' and '${folder}' in parents and trashed = false`;
    const url = `${DRIVE}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent("files(id)")}&pageSize=1`;
    const res = await fetch(url, { headers: auth });
    if (!res.ok) throw new Error(`Drive search failed (${res.status}): ${await res.text()}`);
    const json = (await res.json()) as { files?: { id: string }[] };
    return json.files?.[0]?.id ?? null;
  }

  return {
    async upload(name, bytes) {
      const body = Buffer.from(bytes);
      const existingId = await findExisting(name);

      if (existingId) {
        const url = `${UPLOAD}/files/${existingId}?uploadType=media&fields=${encodeURIComponent("id,webViewLink")}`;
        const res = await fetch(url, {
          method: "PATCH",
          headers: { ...auth, "Content-Type": "application/pdf" },
          body,
        });
        if (!res.ok) throw new Error(`Drive update failed (${res.status}): ${await res.text()}`);
        const j = (await res.json()) as { id: string; webViewLink?: string };
        return { id: j.id, link: j.webViewLink ?? driveViewLink(j.id), updated: true };
      }

      // multipart/related: JSON metadata part + binary PDF part.
      const boundary = `brandquote_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const metadata = { name, parents: [folder], mimeType: "application/pdf" };
      const head = Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
          `${JSON.stringify(metadata)}\r\n` +
          `--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
      );
      const tail = Buffer.from(`\r\n--${boundary}--`);
      const multipart = Buffer.concat([head, body, tail]);

      const url = `${UPLOAD}/files?uploadType=multipart&fields=${encodeURIComponent("id,webViewLink")}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { ...auth, "Content-Type": `multipart/related; boundary=${boundary}` },
        body: multipart,
      });
      if (!res.ok) throw new Error(`Drive upload failed (${res.status}): ${await res.text()}`);
      const j = (await res.json()) as { id: string; webViewLink?: string };
      return { id: j.id, link: j.webViewLink ?? driveViewLink(j.id), updated: false };
    },
  };
}

/** Download a Drive file's bytes (the app created the quote PDFs, so drive.file can read them). */
export async function downloadDriveFile(id: string): Promise<Uint8Array> {
  if (isDemoMode()) return demoDownload(id);
  const token = await accessToken(oauthClient());
  const res = await fetch(`${DRIVE}/files/${id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive download failed (${res.status}): ${await res.text()}`);
  return new Uint8Array(await res.arrayBuffer());
}
