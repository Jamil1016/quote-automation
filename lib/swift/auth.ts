import { isDemoMode } from "@/lib/demo/mode";

// The upstream project-management (PM) API. Internal identifiers keep the
// original "swift" module/env naming; set SWIFT_BASE_URL to the API's base URL.
const SWIFT_BASE_URL = process.env.SWIFT_BASE_URL ?? "https://pm-api.example.com";

export type SwiftVerifyResult = { ok: true } | { ok: false; reason: string };

/**
 * Verify PM API credentials with the same password-grant the data pipeline uses.
 * Returns ok only on HTTP 200 carrying a non-empty idToken. Does NOT cache or
 * persist the token. This is verification only, no write-back.
 *
 * DEMO_MODE: always succeeds without any network call.
 */
export async function verifySwiftCredentials(
  username: string,
  password: string,
): Promise<SwiftVerifyResult> {
  if (isDemoMode()) return { ok: true };
  let res: Response;
  try {
    res = await fetch(`${SWIFT_BASE_URL}/api/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grantType: "password",
        include: ["profile", "firebaseToken"],
        username,
        password,
      }),
    });
  } catch {
    return { ok: false, reason: "Could not reach the PM API. Please try again." };
  }
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    return { ok: false, reason: "Invalid PM API email or password." };
  }
  if (!res.ok) {
    return { ok: false, reason: "Could not reach the PM API. Please try again." };
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, reason: "Unexpected response from the PM API." };
  }
  const idToken = (body as { idToken?: unknown } | null)?.idToken;
  if (typeof idToken !== "string" || idToken.length === 0) {
    return { ok: false, reason: "Unexpected response from the PM API." };
  }
  return { ok: true };
}
