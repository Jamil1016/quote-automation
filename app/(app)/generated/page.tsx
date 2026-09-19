import { getQuoteData, getEmailTemplates, getEmailQueue, getSendSettings, getSendIdentitiesFor } from "@/lib/quotes/queries";
import type { SendIdentity } from "@/lib/quotes/send-identities";
import { getSession } from "@/lib/auth/session";
import { GeneratedClient } from "@/components/quotes/GeneratedClient";

export const dynamic = "force-dynamic";

export default async function GeneratedPage() {
  let data, templates, queue, session;
  let me = "";
  let gmailEmail: string | null = null;
  let activeFrom: string | null = null;
  let sendIdentities: SendIdentity[] = [];
  try {
    [data, templates, queue, session] = await Promise.all([
      getQuoteData(), getEmailTemplates(), getEmailQueue(), getSession(),
    ]);
    me = session?.authUser.email?.toLowerCase() ?? "";
    // These all depend on `me`, so they can't join the batch above — but they
    // are independent of each other. Run them concurrently instead of as a
    // serial waterfall; getSendSettings merges the active-sender + active-from
    // reads (same row) into a single round-trip.
    const [settings, identities] = await Promise.all([
      getSendSettings(me),       // active sender (null if none) + saved "send as" default
      getSendIdentitiesFor(me),
    ]);
    gmailEmail = settings.activeSender;
    activeFrom = settings.activeFrom;
    sendIdentities = identities;
  } catch (e) {
    return (
      <main className="m-6 rounded-lg border border-ember bg-card p-6 text-ember">
        Failed to load generated quotes: {(e as Error).message}
      </main>
    );
  }
  const generated = data.rows.filter((r) => r.generated_at);
  return (
    <main className="min-h-0 flex-1 p-4 lg:px-6">
      <GeneratedClient rows={generated} driveFolderId={process.env.QUOTE_DRIVE_FOLDER_ID}
        templates={templates} queue={queue} gmailEmail={gmailEmail} currentUser={me}
        sendIdentities={sendIdentities} activeFrom={activeFrom} />
    </main>
  );
}
