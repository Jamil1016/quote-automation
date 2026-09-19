// Pure input validation for the PM API connect form. Importable by both the
// server action and the client panel (no node-only dependencies here).
export type SwiftInput =
  | { ok: true; username: string; password: string }
  | { ok: false; reason: "username" | "password" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSwiftInput(username: string, password: string): SwiftInput {
  const u = username.trim().toLowerCase();
  if (!EMAIL_RE.test(u)) return { ok: false, reason: "username" };
  if (password.trim().length === 0) return { ok: false, reason: "password" };
  return { ok: true, username: u, password };
}
