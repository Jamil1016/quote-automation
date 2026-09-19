import { QuoteNav } from "@/components/quotes/QuoteNav";
import { PresenceCluster } from "@/components/layout/PresenceCluster";
import { UserMenu } from "@/components/layout/UserMenu";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import type { PortalUser } from "@/lib/auth/session";
import type { Theme } from "@/lib/quotes/theme";

type Props = {
  email: string;
  portalUser: PortalUser | null;
  theme: Theme;
  onSignOut: () => Promise<void>;
};

/**
 * Shared masthead + tab nav for every app page (the "Ledger" shell).
 * Masthead row: brand title (left) · presence + user menu (right).
 * Nav row: underlined tabs.
 */
export function AppHeader({ email, portalUser, theme, onSignOut }: Props) {
  return (
    <header className="shrink-0 z-30 border-b-[1.5px] border-ink bg-paper">
      <div className="mx-auto w-full max-w-[1800px] px-6 lg:px-10">
        {/* Masthead */}
        <div className="flex items-end justify-between pt-4">
          <div className="flex items-baseline gap-3.5">
            <h1 className="font-display text-[30px] leading-[0.9] tracking-[-0.02em]">
              Quote Automation
            </h1>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-gold">
              Example Co · Accounting
            </span>
          </div>
          <div className="flex items-center gap-3.5 pb-1">
            <ThemeToggle theme={theme} />
            <PresenceCluster email={email} />
            <UserMenu email={email} portalUser={portalUser} onSignOut={onSignOut} />
          </div>
        </div>
        {/* Nav + (page-provided) freshness slot */}
        <div className="mt-3.5 flex items-end justify-between gap-4">
          <QuoteNav />
          <div
            id="header-freshness"
            className="pb-3 text-right font-mono text-[10.5px] leading-snug text-muted"
          />
        </div>
      </div>
    </header>
  );
}
