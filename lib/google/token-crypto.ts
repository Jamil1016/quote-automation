import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for secrets at rest. Key comes from a named env var (64 hex
 * chars). Box format: base64(iv).base64(ciphertext).base64(authTag)
 * Generate a key:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
function keyFromEnv(envName: string): Buffer {
  const hex = process.env[envName] ?? "";
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(`${envName} must be 64 hex chars (32 bytes).`);
  }
  return Buffer.from(hex, "hex");
}

export function encryptWith(envName: string, plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keyFromEnv(envName), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv.toString("base64"), enc.toString("base64"), c.getAuthTag().toString("base64")].join(".");
}

export function decryptWith(envName: string, box: string): string {
  const [iv, enc, tag] = box.split(".").map((s) => Buffer.from(s, "base64"));
  const d = createDecipheriv("aes-256-gcm", keyFromEnv(envName), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

// Gmail refresh tokens (existing callers, key = GMAIL_TOKEN_KEY).
export const encryptSecret = (plain: string): string => encryptWith("GMAIL_TOKEN_KEY", plain);
export const decryptSecret = (box: string): string => decryptWith("GMAIL_TOKEN_KEY", box);
