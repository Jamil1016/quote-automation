const ET = "America/New_York";

/** Milliseconds to ADD to a UTC instant to get its ET wall-clock reading. */
function etOffsetMs(at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(
    dtf.formatToParts(at).map((x) => [x.type, x.value])
  );
  const asUtc = Date.UTC(
    +p.year,
    +p.month - 1,
    +p.day,
    +p.hour % 24,
    +p.minute,
    +p.second
  );
  return asUtc - at.getTime();
}

/**
 * Interpret a datetime-local string ("2026-06-12T09:00") as Eastern Time and
 * return the UTC ISO instant. Two-pass refine handles DST boundaries.
 */
export function etToUtcIso(local: string): string {
  const [d, t] = local.split("T");
  const [y, m, dd] = d.split("-").map(Number);
  const [hh, mm] = t.split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, dd, hh, mm));
  const pass1 = new Date(guess.getTime() - etOffsetMs(guess));
  const pass2 = new Date(guess.getTime() - etOffsetMs(pass1));
  return pass2.toISOString();
}

/** "06/12/2026" for a UTC instant, rendered in ET (the {{send_date}} value). */
export function formatEtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

/** "Thu, Jun 12, 2026, 5:00 PM ET" — humanized confirmation of the chosen send time. */
export function formatEtDateTime(iso: string): string {
  const s = new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
  return `${s} ET`;
}
