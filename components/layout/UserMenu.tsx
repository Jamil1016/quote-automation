"use client";

import { useState } from "react";
import { LogOut, User as UserIcon, Settings } from "lucide-react";
import type { PortalUser } from "@/lib/auth/session";

type Props = {
  portalUser: PortalUser | null;
  email: string;
  onSignOut: () => Promise<void>;
};

function initialsFor(name: string | null, email: string): string {
  const source = (name && name.trim()) || email;
  const parts = source.replace(/@.+$/, "").split(/[\s._-]+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase().slice(0, 2);
}

export function UserMenu({ portalUser, email, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const display = portalUser?.display_name ?? email;
  const initials = initialsFor(portalUser?.display_name ?? null, email);
  const role = portalUser?.role_name ?? "Unprovisioned";

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Open user menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="group flex items-center gap-2 rounded-full border border-rule px-1.5 py-1.5 transition-colors hover:border-ink-soft"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-ink font-mono text-[10px] font-medium tracking-wider text-paper">
          {initials}
        </span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40"
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-72 origin-top-right rounded-md border border-rule bg-paper shadow-[0_22px_60px_-30px_rgba(11,15,26,0.4)]"
          >
            <div className="border-b border-rule px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
                Signed in as
              </p>
              <p className="mt-1 truncate font-display text-[17px] leading-tight">
                {display}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted">{email}</p>
              <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-soft">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-signal" />
                {role}
              </p>
            </div>
            <div className="py-1">
              <MenuItem icon={<UserIcon size={14} strokeWidth={1.7} />}>
                Profile (coming soon)
              </MenuItem>
              <a href="/settings" role="menuitem" onClick={() => setOpen(false)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-ink transition-colors hover:bg-paper-deep">
                <Settings size={14} strokeWidth={1.7} />
                Settings
              </a>
            </div>
            <div className="border-t border-rule py-1">
              <form action={onSignOut}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-ink transition-colors hover:bg-paper-deep"
                >
                  <LogOut size={14} strokeWidth={1.7} />
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      role="menuitem"
      className="flex w-full cursor-not-allowed items-center gap-3 px-4 py-2.5 text-sm text-muted"
    >
      {icon}
      {children}
    </div>
  );
}
