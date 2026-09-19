import { test, expect } from "@playwright/test";
import { verifySwiftCredentials } from "./auth";

const realFetch = globalThis.fetch;
function stubFetch(impl: () => Response) {
  globalThis.fetch = (async () => impl()) as unknown as typeof fetch;
}
function restore() { globalThis.fetch = realFetch; }

test("ok on 200 with a non-empty idToken", async () => {
  stubFetch(() => new Response(JSON.stringify({ idToken: "jwt-abc" }), { status: 200 }));
  expect(await verifySwiftCredentials("u@x.co", "pw")).toEqual({ ok: true });
  restore();
});

test("not ok on 200 without an idToken", async () => {
  stubFetch(() => new Response(JSON.stringify({ foo: 1 }), { status: 200 }));
  expect((await verifySwiftCredentials("u@x.co", "pw")).ok).toBe(false);
  restore();
});

test("invalid-credentials reason on 401", async () => {
  stubFetch(() => new Response("", { status: 401 }));
  expect(await verifySwiftCredentials("u@x.co", "bad"))
    .toEqual({ ok: false, reason: "Invalid PM API email or password." });
  restore();
});

test("network reason when fetch throws", async () => {
  globalThis.fetch = (async () => { throw new Error("boom"); }) as unknown as typeof fetch;
  expect(await verifySwiftCredentials("u@x.co", "pw"))
    .toEqual({ ok: false, reason: "Could not reach the PM API. Please try again." });
  restore();
});
