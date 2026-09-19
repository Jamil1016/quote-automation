export interface PresenceMeta {
  email: string;
  name: string;
  page: string;
  idle: boolean;
  online_at: string;
}

export interface PresenceUser extends PresenceMeta {
  isSelf: boolean;
}

/**
 * Collapse a Supabase Realtime presence state (one entry per tab/connection,
 * keyed by email) into one row per person.
 *
 * - A person counts as active if ANY of their tabs is active.
 * - The page shown is the one from their MOST RECENT tab (by online_at),
 *   preferring active tabs. Picking the most recent — not the first one seen —
 *   is what makes the location follow a person across tab switches and survive
 *   a second open tab or a connection that lingered from before a reload.
 *   (The previous "first active wins" rule pinned the stale page.)
 */
export function collapsePresence(
  state: Record<string, PresenceMeta[]>,
  selfEmail: string,
): PresenceUser[] {
  const grouped = new Map<string, PresenceMeta[]>();
  for (const metas of Object.values(state)) {
    for (const m of metas) {
      const arr = grouped.get(m.email);
      if (arr) arr.push(m);
      else grouped.set(m.email, [m]);
    }
  }
  return Array.from(grouped.entries())
    .map(([email, metas]) => {
      const active = metas.filter((m) => !m.idle);
      const pool = active.length > 0 ? active : metas;
      const latest = pool.reduce((a, b) => (b.online_at > a.online_at ? b : a));
      return { ...latest, idle: active.length === 0, isSelf: email === selfEmail };
    })
    .sort((a, b) => {
      if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1; // you first
      if (a.idle !== b.idle) return a.idle ? 1 : -1; // active before idle
      return a.name.localeCompare(b.name);
    });
}
