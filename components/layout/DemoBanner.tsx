/**
 * Shown across the top of the app shell when DEMO_MODE is on. Server-rendered
 * by app/(app)/layout.tsx, so the flag never needs to reach the browser.
 */
export function DemoBanner() {
  return (
    <div
      role="status"
      className="shrink-0 border-b border-amber/40 bg-amber/10 px-6 py-1.5 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft"
    >
      Demo data. Nothing is sent. Every company, site and price here is invented, and the data can be reset at any time.
    </div>
  );
}
