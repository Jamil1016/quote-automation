// lib/quotes/theme.ts
// The app's selectable UI themes. "ledger" = the default light parchment look;
// "brand" = the dark navy/cyan Example Co Design System look. Pure + tiny so it is
// unit-testable and safe to import anywhere (no server-only deps).
export type Theme = "ledger" | "brand";

/** Normalize a stored/raw theme value. Example Co is the default; only an explicit
 *  "ledger" opts back into the light theme (null/unknown → "brand"). */
export function resolveTheme(value: string | null | undefined): Theme {
  return value === "ledger" ? "ledger" : "brand";
}
