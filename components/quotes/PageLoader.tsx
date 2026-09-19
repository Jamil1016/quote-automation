/**
 * Instant navigation loader. Rendered by each route's loading.tsx so a tab
 * click shows something immediately while the server fetch runs. The shared
 * masthead + tab nav persist from the (app) layout, so this only fills the
 * content area below them.
 *
 * Plain inline SVG + CSS (see `.page-loader-*` in app/globals.css): a quote
 * sheet whose lines draw in. No animation library, no third-party artwork.
 * Motion is disabled under prefers-reduced-motion.
 */
export function PageLoader({ subtitle }: { subtitle?: string }) {
  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div
        role="status"
        aria-live="polite"
        className="mx-auto flex min-h-0 w-full max-w-[1800px] flex-1 flex-col items-center justify-center px-6 pb-6 pt-5 lg:px-10"
      >
        <svg
          aria-hidden
          viewBox="0 0 64 80"
          className="h-24 w-20 text-ink"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 4h34l14 14v58H8z" opacity="0.35" />
          <path d="M42 4v14h14" opacity="0.35" />
          <line className="page-loader-line" x1="16" y1="32" x2="48" y2="32" />
          <line className="page-loader-line page-loader-line-2" x1="16" y1="42" x2="48" y2="42" />
          <line className="page-loader-line page-loader-line-3" x1="16" y1="52" x2="40" y2="52" />
          <line className="page-loader-line page-loader-line-4 text-signal" x1="32" y1="64" x2="48" y2="64" stroke="currentColor" />
        </svg>
        <span className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-soft">
          {subtitle ?? "Loading…"}
        </span>
      </div>
    </main>
  );
}
