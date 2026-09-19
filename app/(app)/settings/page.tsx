// app/(app)/settings/page.tsx
import { getSession } from "@/lib/auth/session";
import { getMyConnections, getActiveSenderEmail, getActiveFrom, getSendIdentitiesFor, getManagedMasks, getSwiftAccount } from "@/lib/quotes/queries";
import { isMaskAdmin } from "@/lib/quotes/send-identities";
import { SettingsClient } from "@/components/settings/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getSession();
  const me = session?.authUser.email?.toLowerCase() ?? "";
  const [connections, activeSender, activeFrom, identities, masks, swiftAccount] = await Promise.all([
    getMyConnections(me), getActiveSenderEmail(me), getActiveFrom(me), getSendIdentitiesFor(me), getManagedMasks(me), getSwiftAccount(me),
  ]);
  const admin = isMaskAdmin(me, process.env.QUOTE_MASK_ADMINS);
  return (
    <main className="min-h-0 flex-1 p-4 lg:px-6">
      <SettingsClient connections={connections} activeSender={activeSender}
        activeFrom={activeFrom} identities={identities}
        sharedMasks={masks.shared} personalMasks={masks.personal} isMaskAdmin={admin}
        swiftAccount={swiftAccount} />
    </main>
  );
}
