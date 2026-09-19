import { test, expect } from "@playwright/test";
import { gmailAuthUrl } from "./gmail";

test("gmailAuthUrl carries scope, offline access, forced consent, state", () => {
  process.env.GMAIL_CLIENT_ID = "cid";
  const u = new URL(gmailAuthUrl("http://localhost:3000/api/gmail/callback", "st4te"));
  expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
  expect(u.searchParams.get("client_id")).toBe("cid");
  expect(u.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/gmail/callback");
  expect(u.searchParams.get("scope")).toContain("gmail.compose");
  expect(u.searchParams.get("scope")).toContain("email");
  expect(u.searchParams.get("access_type")).toBe("offline");
  expect(u.searchParams.get("prompt")).toBe("consent");
  expect(u.searchParams.get("state")).toBe("st4te");
});
