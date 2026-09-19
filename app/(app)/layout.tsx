import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { currentAllowlist, isAllowed } from "@/lib/auth/allowlist";
import { isDemoMode } from "@/lib/demo/mode";
import { DemoBanner } from "@/components/layout/DemoBanner";
import { AppHeader } from "@/components/layout/AppHeader";
import { getTheme } from "@/lib/quotes/queries";
import type { Theme } from "@/lib/quotes/theme";
import { signOut } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/signin");
  const email = session.authUser.email ?? "";
  if (!isAllowed(email, currentAllowlist())) {
    redirect("/not-authorized");
  }
  // Server-stamp the theme on the shell root so there's no flash. Never block render on it.
  let theme: Theme = "ledger";
  try { theme = await getTheme(email.toLowerCase()); } catch { theme = "ledger"; }
  return (
    <div
      id="app-shell"
      data-theme={theme === "brand" ? "brand" : undefined}
      className="flex h-screen flex-col overflow-hidden bg-paper text-ink"
    >
      {isDemoMode() && <DemoBanner />}
      <AppHeader email={email} portalUser={session.portalUser} theme={theme} onSignOut={signOut} />
      {children}
    </div>
  );
}
