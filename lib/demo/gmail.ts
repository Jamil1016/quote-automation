import { randomBytes } from "node:crypto";

/**
 * Demo stand-ins for the Gmail REST calls. They never touch the network; they
 * only hand back plausible ids so the queue rows can move through their
 * statuses exactly as they do against the real API.
 */
export const DEMO_ACCESS_TOKEN = "demo-access-token";
/** Stored in gmail_connections.refresh_token_enc for demo mailboxes. Not a token. */
export const DEMO_REFRESH_TOKEN_PLACEHOLDER = "demo-mode-no-token";

const fakeId = (kind: string) => `demo-${kind}-${randomBytes(6).toString("hex")}`;

export async function demoCreateDraft(): Promise<string> {
  return fakeId("draft");
}

export async function demoSendDraft(): Promise<{ messageId: string }> {
  return { messageId: fakeId("msg") };
}

export async function demoDeleteDraft(): Promise<void> {
  // nothing to delete
}
