import { getQuoteData, getDirectory } from "@/lib/quotes/queries";
import { QueueClient } from "@/components/quotes/QueueClient";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  let data, directory;
  try {
    [data, directory] = await Promise.all([getQuoteData(), getDirectory()]);
  } catch (e) {
    return (
      <main className="m-6 rounded-lg border border-ember bg-card p-6 text-ember">
        Failed to load quotation data: {(e as Error).message}
      </main>
    );
  }
  return <QueueClient data={data} directory={directory} />;
}
