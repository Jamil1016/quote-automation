import { test, expect } from "@playwright/test";
import {
  DraftGoneError,
  GmailSendError,
  isRetryableSendError,
  sendDraftWithRetry,
} from "./gmail";

test("isRetryableSendError: 400 failedPrecondition is transient", () => {
  expect(isRetryableSendError(new GmailSendError("boom", 400, "failedPrecondition"))).toBe(true);
});

test("isRetryableSendError: 400 with another reason is terminal", () => {
  expect(isRetryableSendError(new GmailSendError("bad recipient", 400, "invalidArgument"))).toBe(false);
});

test("isRetryableSendError: 429 and 5xx are transient", () => {
  expect(isRetryableSendError(new GmailSendError("rate", 429))).toBe(true);
  expect(isRetryableSendError(new GmailSendError("oops", 503))).toBe(true);
});

test("isRetryableSendError: 403 only when rate-limited", () => {
  expect(isRetryableSendError(new GmailSendError("slow down", 403, "rateLimitExceeded"))).toBe(true);
  expect(isRetryableSendError(new GmailSendError("forbidden", 403, "forbidden"))).toBe(false);
});

test("isRetryableSendError: DraftGoneError is never retryable", () => {
  expect(isRetryableSendError(new DraftGoneError("gone"))).toBe(false);
});

test("isRetryableSendError: a thrown network error is transient", () => {
  expect(isRetryableSendError(new TypeError("fetch failed"))).toBe(true);
});

test("sendDraftWithRetry: succeeds on first attempt, no sleep", async () => {
  const sleeps: number[] = [];
  let calls = 0;
  const r = await sendDraftWithRetry("tok", "d1", {
    sleep: async (ms) => { sleeps.push(ms); },
    backoffMs: () => 0,
    send: async () => { calls++; return { messageId: "m1" }; },
  });
  expect(r.messageId).toBe("m1");
  expect(calls).toBe(1);
  expect(sleeps.length).toBe(0);
});

test("sendDraftWithRetry: retries a transient failure then succeeds", async () => {
  const sleeps: number[] = [];
  let calls = 0;
  const r = await sendDraftWithRetry("tok", "d1", {
    sleep: async (ms) => { sleeps.push(ms); },
    backoffMs: (attempt) => attempt * 10,
    send: async () => {
      calls++;
      if (calls < 3) throw new GmailSendError("precondition", 400, "failedPrecondition");
      return { messageId: "ok" };
    },
  });
  expect(r.messageId).toBe("ok");
  expect(calls).toBe(3);
  expect(sleeps).toEqual([10, 20]); // backoff before attempts 2 and 3
});

test("sendDraftWithRetry: exhausts maxAttempts on a persistent transient error", async () => {
  let calls = 0;
  await expect(sendDraftWithRetry("tok", "d1", {
    maxAttempts: 3,
    sleep: async () => {},
    backoffMs: () => 0,
    send: async () => { calls++; throw new GmailSendError("precondition", 400, "failedPrecondition"); },
  })).rejects.toThrow(/precondition/);
  expect(calls).toBe(3);
});

test("sendDraftWithRetry: DraftGoneError throws immediately without retry", async () => {
  let calls = 0;
  await expect(sendDraftWithRetry("tok", "d1", {
    sleep: async () => {},
    send: async () => { calls++; throw new DraftGoneError("gone"); },
  })).rejects.toBeInstanceOf(DraftGoneError);
  expect(calls).toBe(1);
});

test("sendDraftWithRetry: terminal (non-retryable) error throws immediately", async () => {
  let calls = 0;
  await expect(sendDraftWithRetry("tok", "d1", {
    sleep: async () => {},
    send: async () => { calls++; throw new GmailSendError("bad", 400, "invalidArgument"); },
  })).rejects.toThrow(/bad/);
  expect(calls).toBe(1);
});
