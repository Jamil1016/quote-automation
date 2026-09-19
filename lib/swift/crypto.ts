import { encryptWith, decryptWith } from "@/lib/google/token-crypto";
import { isDemoMode } from "@/lib/demo/mode";

// PM API passwords at rest. Key = SWIFT_CREDENTIAL_KEY (64 hex), distinct from
// the Gmail token key so the two secret stores stay independent.
const KEY_ENV = "SWIFT_CREDENTIAL_KEY";

/** Stored instead of a ciphertext in demo mode: a public demo must never keep
 *  whatever a visitor types into a password box. */
export const DEMO_PASSWORD_PLACEHOLDER = "demo-mode-not-stored";

export const encryptSwiftSecret = (plain: string): string =>
  isDemoMode() ? DEMO_PASSWORD_PLACEHOLDER : encryptWith(KEY_ENV, plain);
export const decryptSwiftSecret = (box: string): string => decryptWith(KEY_ENV, box);
