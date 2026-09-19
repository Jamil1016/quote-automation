import { test, expect } from "@playwright/test";
import { isDemoMode, DEMO_USER_EMAIL } from "./mode";
import { demoFileId, demoFileLink, demoUploader, taskDidFromDemoFileId } from "./drive";
import { demoCreateDraft, demoSendDraft, demoDeleteDraft, DEMO_ACCESS_TOKEN } from "./gmail";
import { getQuoteUploader, deleteDriveFile } from "@/lib/google/drive";
import { accessTokenForConnection, createDraft, sendDraft, sendDraftWithRetry, deleteDraft } from "@/lib/google/gmail";
import { verifySwiftCredentials } from "@/lib/swift/auth";
import { encryptSwiftSecret, DEMO_PASSWORD_PLACEHOLDER } from "@/lib/swift/crypto";
import { emailMode, resolveRecipients, TEST_RECIPIENT } from "@/lib/quotes/email-safety";
import { currentAllowlist, isAllowed } from "@/lib/auth/allowlist";

// These tests mutate process.env and globalThis.fetch, so run them one at a time.
test.describe.configure({ mode: "serial" });

const ENV_KEYS = [
  "DEMO_MODE", "QUOTE_EMAIL_MODE", "QUOTE_EMAIL_ALLOW_CUSTOMER_SEND", "QUOTE_APP_ALLOWED_EMAILS",
  "GDRIVE_CLIENT_ID", "GDRIVE_CLIENT_SECRET", "GDRIVE_REFRESH_TOKEN", "GMAIL_TOKEN_KEY", "SWIFT_CREDENTIAL_KEY",
] as const;
const savedEnv: Record<string, string | undefined> = {};
const realFetch = globalThis.fetch;
let fetchCalls = 0;

test.beforeEach(() => {
  for (const k of ENV_KEYS) { savedEnv[k] = process.env[k]; delete process.env[k]; }
  fetchCalls = 0;
  // Any network call in demo mode is a bug: count them and fail loudly.
  globalThis.fetch = (async () => { fetchCalls++; throw new Error("network call attempted"); }) as unknown as typeof fetch;
});
test.afterEach(() => {
  for (const k of ENV_KEYS) { if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k]; }
  globalThis.fetch = realFetch;
});

test("isDemoMode: only the exact opt-in turns it on", () => {
  expect(isDemoMode()).toBe(false);
  for (const v of ["", "false", "0", "1", "yes", "on"]) { process.env.DEMO_MODE = v; expect(isDemoMode()).toBe(false); }
  for (const v of ["true", "TRUE", " true "]) { process.env.DEMO_MODE = v; expect(isDemoMode()).toBe(true); }
});

test("demo file ids round-trip and link to the in-app PDF route", () => {
  expect(taskDidFromDemoFileId(demoFileId("T-1001"))).toBe("T-1001");
  expect(taskDidFromDemoFileId("1AbCrealDriveId")).toBeNull();
  expect(taskDidFromDemoFileId("demo-")).toBeNull();
  expect(demoFileLink("T 1/2")).toBe("/api/quote-pdf?task_did=T%201%2F2&inline=1");
});

test("demo uploader returns a fake id + link and needs the task id", async () => {
  const up = demoUploader();
  expect(await up.upload("x.pdf", new Uint8Array([1]), { taskDid: "T-1001" }))
    .toEqual({ id: "demo-T-1001", link: "/api/quote-pdf?task_did=T-1001&inline=1", updated: false });
  await expect(up.upload("x.pdf", new Uint8Array([1]))).rejects.toThrow(/task id/);
});

test("demo Gmail stubs return distinct fake ids", async () => {
  const [a, b] = [await demoCreateDraft(), await demoCreateDraft()];
  expect(a).toMatch(/^demo-draft-[0-9a-f]{12}$/);
  expect(a).not.toBe(b);
  expect((await demoSendDraft()).messageId).toMatch(/^demo-msg-[0-9a-f]{12}$/);
  await expect(demoDeleteDraft()).resolves.toBeUndefined();
});

test("DEMO_MODE on: Drive, Gmail and PM API boundaries make no network call and need no credentials", async () => {
  process.env.DEMO_MODE = "true";
  const up = await getQuoteUploader(); // the real one would throw "Drive not configured"
  expect((await up.upload("q.pdf", new Uint8Array([1]), { taskDid: "T-7" })).id).toBe("demo-T-7");
  await expect(deleteDriveFile("demo-T-7")).resolves.toBeUndefined();

  expect(await accessTokenForConnection("demo-mode-no-token")).toBe(DEMO_ACCESS_TOKEN); // no GMAIL_TOKEN_KEY set
  const draftId = await createDraft(DEMO_ACCESS_TOKEN, "cmF3");
  expect(draftId).toMatch(/^demo-draft-/);
  expect((await sendDraft(DEMO_ACCESS_TOKEN, draftId)).messageId).toMatch(/^demo-msg-/);
  expect((await sendDraftWithRetry(DEMO_ACCESS_TOKEN, draftId)).messageId).toMatch(/^demo-msg-/);
  await expect(deleteDraft(DEMO_ACCESS_TOKEN, draftId)).resolves.toBeUndefined();

  expect(await verifySwiftCredentials("anyone@example.com", "anything")).toEqual({ ok: true });
  expect(encryptSwiftSecret("typed by a visitor")).toBe(DEMO_PASSWORD_PLACEHOLDER); // never stored

  expect(fetchCalls).toBe(0);
});

test("DEMO_MODE off: the real code paths run (they reach for credentials / the network)", async () => {
  await expect(getQuoteUploader()).rejects.toThrow(/Drive not configured/);
  await expect(accessTokenForConnection("not-a-box")).rejects.toThrow(/GMAIL_TOKEN_KEY/);
  await expect(createDraft("t", "cmF3")).rejects.toThrow(/network call attempted/);
  await expect(sendDraft("t", "d1")).rejects.toThrow(/network call attempted/);
  await expect(deleteDraft("t", "d1")).rejects.toThrow(/network call attempted/);
  expect((await verifySwiftCredentials("u@example.com", "pw")).ok).toBe(false);
  expect(() => encryptSwiftSecret("pw")).toThrow(/SWIFT_CREDENTIAL_KEY/);
  expect(fetchCalls).toBe(4);
});

test("email gate: demo forces test mode and can never go live", () => {
  expect(emailMode()).toBe("off"); // unchanged default when demo is off
  process.env.DEMO_MODE = "true";
  process.env.QUOTE_EMAIL_MODE = "live";
  process.env.QUOTE_EMAIL_ALLOW_CUSTOMER_SEND = "true";
  expect(emailMode()).toBe("test");
  const plan = resolveRecipients(["northwind.quotes@example.com"], ["northwind.pm@example.com"]);
  expect(plan.to).toEqual([TEST_RECIPIENT]);
  expect(plan.cc).toEqual([]);
});

test("allowlist: the demo user is allowed only while DEMO_MODE is on", () => {
  process.env.QUOTE_APP_ALLOWED_EMAILS = "dev@example.com";
  expect(isAllowed(DEMO_USER_EMAIL, currentAllowlist())).toBe(false);
  expect(isAllowed("dev@example.com", currentAllowlist())).toBe(true);
  process.env.DEMO_MODE = "true";
  expect(isAllowed(DEMO_USER_EMAIL, currentAllowlist())).toBe(true);
  expect(isAllowed("dev@example.com", currentAllowlist())).toBe(true);
  expect(isAllowed("stranger@example.com", currentAllowlist())).toBe(false);
});
