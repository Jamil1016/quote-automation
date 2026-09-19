// lib/quotes/swift-account-actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { createServiceClient } from "@/lib/supabase/service";
import { validateSwiftInput } from "@/lib/swift/validate";
import { verifySwiftCredentials } from "@/lib/swift/auth";
import { encryptSwiftSecret } from "@/lib/swift/crypto";

/** Verify the caller's PM API credentials, then store them encrypted. */
export async function connectSwift(username: string, password: string) {
  const user = await requireUser();
  const v = validateSwiftInput(username, password);
  if (!v.ok) {
    throw new Error(v.reason === "username" ? "Enter a valid PM API email." : "Enter your PM API password.");
  }
  const check = await verifySwiftCredentials(v.username, v.password);
  if (!check.ok) throw new Error(check.reason);
  const now = new Date().toISOString();
  const svc = createServiceClient();
  const { error } = await svc
    .schema("app_quote").from("user_settings")
    .upsert({
      user_email: user,
      swift_username: v.username,
      swift_password_enc: encryptSwiftSecret(v.password),
      swift_verified_at: now,
      updated_at: now,
    }, { onConflict: "user_email" });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

/** Clear the caller's stored PM API credentials. */
export async function disconnectSwift() {
  const user = await requireUser();
  const svc = createServiceClient();
  const { error } = await svc
    .schema("app_quote").from("user_settings")
    .update({
      swift_username: null,
      swift_password_enc: null,
      swift_verified_at: null,
      updated_at: new Date().toISOString(),
    }).eq("user_email", user);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}
