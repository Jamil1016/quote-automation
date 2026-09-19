"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { collapsePresence, type PresenceMeta } from "./collapse";

export type { PresenceUser } from "./collapse";
import type { PresenceUser } from "./collapse";

/** Human page label for the current route — what a teammate is looking at. */
export function pageLabel(path: string): string {
  if (path === "/" || path === "") return "Queue";
  if (path.startsWith("/generated")) return "Generated";
  if (path.startsWith("/directory")) return "Directory";
  if (path.startsWith("/data-source")) return "Data Source";
  return "Queue";
}

/** "dev.user@example.com" → "Dev User" */
export function displayName(email: string): string {
  const local = (email.split("@")[0] ?? email).replace(/[._-]+/g, " ").trim();
  return local
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(" ");
}

/** Two-letter initials from a display name (falls back to first 2 chars). */
export function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const ab = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (ab || name.slice(0, 2)).toUpperCase();
}

const AVATAR_COLORS = [
  "#3c6b3a", "#14457a", "#a8741a", "#7c5a8f",
  "#a8442a", "#2f6e6a", "#8a5a2b", "#5a6b8a",
];

/** Stable avatar color derived from the email (same person → same color). */
export function colorFor(email: string): string {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

const CHANNEL = "quote-app-presence";

/**
 * Live roster of everyone currently in the app, via Supabase Realtime Presence.
 * Each browser tab broadcasts the signed-in user, the page they're on, and
 * whether the tab is idle (backgrounded). De-duplicates multiple tabs per user.
 */
export function usePresence(selfEmail: string): PresenceUser[] {
  const pathname = usePathname();
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const idleRef = useRef(false);

  // Subscribe once per identity.
  useEffect(() => {
    if (!selfEmail) return;
    const supabase = createClient();
    const channel = supabase.channel(CHANNEL, {
      config: { presence: { key: selfEmail } },
    });
    channelRef.current = channel;

    const track = () =>
      channel.track({
        email: selfEmail,
        name: displayName(selfEmail),
        page: pageLabel(window.location.pathname),
        idle: idleRef.current,
        online_at: new Date().toISOString(),
      } satisfies PresenceMeta);

    const sync = () =>
      setUsers(collapsePresence(channel.presenceState<PresenceMeta>(), selfEmail));

    channel.on("presence", { event: "sync" }, sync);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") void track();
    });

    const onVisibility = () => {
      idleRef.current = document.visibilityState === "hidden";
      void track();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      void channel.unsubscribe();
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
     
  }, [selfEmail]);

  // Re-broadcast the page when the route changes.
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !selfEmail) return;
    void channel.track({
      email: selfEmail,
      name: displayName(selfEmail),
      page: pageLabel(pathname),
      idle: idleRef.current,
      online_at: new Date().toISOString(),
    } satisfies PresenceMeta);
  }, [pathname, selfEmail]);

  return users;
}
