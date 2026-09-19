import { getDirectory, getCategorySuggestions } from "@/lib/quotes/queries";
import { DirectoryClient } from "@/components/quotes/DirectoryClient";

export const dynamic = "force-dynamic";

export default async function DirectoryPage() {
  let rows, suggestions;
  try {
    [rows, suggestions] = await Promise.all([getDirectory(), getCategorySuggestions()]);
  } catch (e) {
    return (
      <main className="m-6 rounded-lg border border-ember bg-card p-6 text-ember">
        Failed to load Quote Directory: {(e as Error).message}
      </main>
    );
  }
  return (
    <main className="min-h-0 flex-1 p-4 lg:px-6">
      <DirectoryClient rows={rows} suggestions={suggestions} />
    </main>
  );
}
