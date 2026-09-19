import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { UserMenu } from "@/components/layout/UserMenu";
import type { PortalUser } from "@/lib/auth/session";

type Props = {
  email: string;
  portalUser: PortalUser | null;
  onSignOut: () => Promise<void>;
};

export function TopBar({ email, portalUser, onSignOut }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-paper/80 backdrop-blur supports-[backdrop-filter]:bg-paper/70">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-5 lg:px-8">
        {/* Left cluster — menu + logo */}
        <button
          type="button"
          aria-label="Open navigation"
          className="grid h-9 w-9 place-items-center rounded-md text-ink-soft transition-colors hover:bg-paper-deep"
        >
          <Menu size={18} strokeWidth={1.7} />
        </button>

        <Link
          href="/"
          aria-label="Quote Automation — home"
          className="flex items-center gap-3 transition-opacity hover:opacity-80"
        >
          <Logo size={22} withWordmark />
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right — user */}
        <div className="flex items-center gap-3">
          <UserMenu email={email} portalUser={portalUser} onSignOut={onSignOut} />
        </div>
      </div>
    </header>
  );
}
