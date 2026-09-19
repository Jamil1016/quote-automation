"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";

/** Invalidate every quote-app route segment so cross-tab lists update without a manual refresh. */
export async function revalidateQuotes() {
  await requireUser(); // gate like every other quote server action; this is a callable endpoint
  for (const p of ["/", "/generated", "/directory", "/email-builder", "/settings"]) revalidatePath(p);
}
