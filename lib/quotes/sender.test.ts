import { test, expect } from "@playwright/test";
import { resolveActiveSender, type Conn } from "./sender";

const conn = (email: string, status = "active"): Conn => ({ email, status, refresh_token_enc: "x" });

test("returns the active connection when set and active", () => {
  const r = resolveActiveSender([conn("a@x.co"), conn("acct@x.co")], "acct@x.co");
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.connection.email).toBe("acct@x.co");
});

test("no_active when the user has not picked an active sender", () => {
  const r = resolveActiveSender([conn("a@x.co")], null);
  expect(r).toEqual({ ok: false, reason: "no_active" });
});

test("not_connected when the active email has no matching connection", () => {
  const r = resolveActiveSender([conn("a@x.co")], "gone@x.co");
  expect(r).toEqual({ ok: false, reason: "not_connected" });
});

test("error_status when the active connection is in error", () => {
  const r = resolveActiveSender([conn("acct@x.co", "error")], "acct@x.co");
  expect(r).toEqual({ ok: false, reason: "error_status" });
});
