// Quote Automation production reset.
//
// Clears the test data we accumulated while building the app so we can go live
// from a clean slate:
//   - app_quote.overrides     (per-task category / rate / verify edits)
//   - app_quote.generated     (generated-quote tracking rows)
//   - app_quote.email_queue   (the email outbox / send log)
//   - the PDF files the app created in the generated-quotes Drive folder
//
// It NEVER touches the things we keep for production:
//   reference.ref_quote_directory          (the cleaned directory)
//   app_quote.email_templates (email templates)
//   app_quote.gmail_connections / _send_identities / _user_settings
//     (connected accounts, sender masks, per-user settings)
//
// Default run = PREVIEW (dry-run, deletes nothing). To execute:
//   npm run quote:reset -- --confirm        then type the phrase when prompted.
//
// Usage:
//   npm run quote:reset                      # preview
//   npm run quote:reset -- --confirm         # execute (typed phrase required)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { OAuth2Client } from "google-auth-library";

// supabase-js eagerly builds a realtime client whose factory throws on Node 20
// (no global WebSocket). We never use realtime; a dummy ctor satisfies it.
globalThis.WebSocket = globalThis.WebSocket || class FakeWS {};
const { createClient } = await import("@supabase/supabase-js");

const DRIVE = "https://www.googleapis.com/drive/v3";
const CONFIRM_PHRASE = "RESET QUOTE DATA";

// ---- env: parse .env.local directly (BOM-stripped), not via Next ----
function loadEnv() {
  const env = {};
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/^﻿/, "");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  const need = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "GDRIVE_CLIENT_ID",
    "GDRIVE_CLIENT_SECRET",
    "GDRIVE_REFRESH_TOKEN",
    "QUOTE_DRIVE_FOLDER_ID",
  ];
  const missing = need.filter((k) => !env[k]);
  if (missing.length) {
    console.error(`Missing required env in .env.local: ${missing.join(", ")}`);
    process.exit(1);
  }
  return env;
}

function supa(env) {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function driveToken(env) {
  const c = new OAuth2Client(env.GDRIVE_CLIENT_ID, env.GDRIVE_CLIENT_SECRET);
  c.setCredentials({ refresh_token: env.GDRIVE_REFRESH_TOKEN });
  const { token } = await c.getAccessToken();
  if (!token) throw new Error("Drive: could not obtain an access token");
  return token;
}

// ---- Drive: list/delete only files THIS app created (drive.file scope) ----
async function listFolderFiles(token, folder) {
  const files = [];
  let pageToken;
  do {
    const url = new URL(`${DRIVE}/files`);
    url.searchParams.set("q", `'${folder}' in parents and trashed = false`);
    url.searchParams.set("fields", "nextPageToken, files(id,name)");
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Drive list failed (${res.status}): ${await res.text()}`);
    const j = await res.json();
    files.push(...(j.files ?? []));
    pageToken = j.nextPageToken;
  } while (pageToken);
  return files;
}

async function deleteDriveFile(token, id) {
  const res = await fetch(`${DRIVE}/files/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Drive delete failed (${res.status}): ${await res.text()}`);
  }
}

// ---- table helpers ----
async function countRows(sb, table) {
  const { count, error } = await sb
    .schema("app_quote")
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(`count ${table} failed: ${error.message}`);
  return count ?? 0;
}

async function fetchAll(sb, table) {
  const { data, error } = await sb.schema("app_quote").from(table).select("*");
  if (error) throw new Error(`read ${table} failed: ${error.message}`);
  return data ?? [];
}

async function deleteAll(sb, table, pk) {
  // pk is the PK column (never null), so this matches every row.
  const { error } = await sb.schema("app_quote").from(table).delete().not(pk, "is", null);
  if (error) throw new Error(`delete ${table} failed: ${error.message}`);
}

async function main() {
  const confirm = process.argv.includes("--confirm");
  const env = loadEnv();
  const sb = supa(env);
  const token = await driveToken(env);
  const folder = env.QUOTE_DRIVE_FOLDER_ID;

  // ---- PREVIEW (always) ----
  const overridesCount = await countRows(sb, "overrides");
  const generatedCount = await countRows(sb, "generated");
  const emailQueueCount = await countRows(sb, "email_queue");
  const driveFiles = await listFolderFiles(token, folder);

  console.log("\nQuote Automation production reset");
  console.log("---------------------------------");
  console.log(`  overrides rows   : ${overridesCount}`);
  console.log(`  generated rows   : ${generatedCount}`);
  console.log(`  email_queue rows : ${emailQueueCount}`);
  console.log(`  Drive PDFs in folder       : ${driveFiles.length}`);
  console.log("  PRESERVED (never touched)  : ref_quote_directory, email_templates,");
  console.log("                               gmail_connections, _send_identities, _user_settings\n");

  if (!confirm) {
    console.log('DRY RUN. Nothing deleted. Re-run with --confirm to execute:');
    console.log("  npm run quote:reset -- --confirm\n");
    return;
  }

  // ---- CONFIRM ----
  const rl = createInterface({ input, output });
  const answer = await rl.question(`Type "${CONFIRM_PHRASE}" to proceed: `);
  rl.close();
  if (answer.trim() !== CONFIRM_PHRASE) {
    console.error("\nPhrase did not match. Aborted. Nothing deleted.\n");
    process.exit(1);
  }

  // ---- SNAPSHOT (before any delete) ----
  const overrides = await fetchAll(sb, "overrides");
  const generated = await fetchAll(sb, "generated");
  const emailQueue = await fetchAll(sb, "email_queue");
  mkdirSync(new URL("../out/", import.meta.url), { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = new URL(`../out/quote-reset-backup-${stamp}.json`, import.meta.url);
  writeFileSync(
    backupPath,
    JSON.stringify({ created_at: new Date().toISOString(), overrides: overrides, generated: generated, email_queue: emailQueue }, null, 2),
  );
  console.log(`\nBackup written: out/quote-reset-backup-${stamp}.json`);

  // ---- DELETE: Drive first, then tables ----
  let deleted = 0;
  const failed = [];
  for (const f of driveFiles) {
    try {
      await deleteDriveFile(token, f.id);
      deleted++;
    } catch (e) {
      failed.push({ id: f.id, name: f.name, error: String(e) });
    }
  }
  await deleteAll(sb, "generated", "task_did");
  await deleteAll(sb, "overrides", "task_did");
  await deleteAll(sb, "email_queue", "id");

  // ---- VERIFY ----
  const overridesLeft = await countRows(sb, "overrides");
  const generatedLeft = await countRows(sb, "generated");
  const emailQueueLeft = await countRows(sb, "email_queue");

  console.log("\nDone.");
  console.log(`  Drive PDFs deleted         : ${deleted}/${driveFiles.length}`);
  if (failed.length) {
    console.log(`  Drive deletes FAILED       : ${failed.length} (clean up manually):`);
    for (const f of failed) console.log(`    - ${f.id} (${f.name}): ${f.error}`);
  }
  console.log(`  generated left   : ${generatedLeft}`);
  console.log(`  overrides left   : ${overridesLeft}`);
  console.log(`  email_queue left : ${emailQueueLeft}`);

  // A leftover row means a delete partially failed (or a row had a null PK and
  // the match missed it). For a "clean slate" tool, surface that as a non-zero
  // exit instead of a silent success.
  if (overridesLeft || generatedLeft || emailQueueLeft) {
    console.error("\nWARNING: tables not fully cleared. Investigate before going live.");
    process.exitCode = 1;
  }

  // The backup also holds generated rows, but their Drive PDFs are now
  // deleted and not recoverable. Generated quotes are meant to be regenerated,
  // so only the override edits are worth restoring from the backup.
  console.log(`\nTo restore overrides if this was a mistake, re-insert the rows in`);
  console.log(`  out/quote-reset-backup-${stamp}.json -> app_quote.overrides\n`);
}

main().catch((e) => {
  console.error("\nReset failed:", e?.message ?? e);
  process.exit(1);
});
