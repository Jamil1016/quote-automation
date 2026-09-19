// app/(app)/email-builder/page.tsx
import { getEmailTemplates } from "@/lib/quotes/queries";
import { EmailTemplateBuilder } from "@/components/quotes/EmailTemplateBuilder";

export const dynamic = "force-dynamic";

export default async function EmailBuilderPage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const { template } = await searchParams;
  let templates;
  try {
    templates = await getEmailTemplates();
  } catch (e) {
    return <main className="m-6 rounded-lg border border-ember bg-card p-6 text-ember">Failed to load templates: {(e as Error).message}</main>;
  }
  const parsed = template ? Number(template) : NaN;
  const initialId = Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  return (
    <main className="min-h-0 flex-1 p-4 lg:px-6">
      <EmailTemplateBuilder templates={templates} initialId={initialId} />
    </main>
  );
}
