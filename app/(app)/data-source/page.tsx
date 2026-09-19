import { getAssetTasks, getSourceInvoiceLines } from "@/lib/quotes/queries";
import { DataSourceClient } from "@/components/quotes/DataSourceClient";

export const dynamic = "force-dynamic";

export default async function DataSourcePage() {
  let tasks, lines;
  try {
    [tasks, lines] = await Promise.all([getAssetTasks(), getSourceInvoiceLines()]);
  } catch (e) {
    return (
      <main className="m-6 rounded-lg border border-ember bg-card p-6 text-ember">
        Failed to load Data Source: {(e as Error).message}
      </main>
    );
  }
  return (
    <main className="min-h-0 flex-1 p-4 lg:px-6">
      <DataSourceClient tasks={tasks} lines={lines} />
    </main>
  );
}
