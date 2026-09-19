type Props = {
  className?: string;
  /** Stroke color override. Defaults to ink. */
  stroke?: string;
  /** Stroke opacity (0–1). Defaults to 0.08. */
  opacity?: number;
};

/**
 * Topographic contour field — a faint repeating pattern of nested
 * ellipses that reads like a survey map. Used behind hero areas
 * to suggest "operations on a map" without literally being one.
 *
 * Should be wrapped in a positioned container; this fills its parent.
 */
export function TopographicField({
  className = "",
  stroke = "var(--ink)",
  opacity = 0.08,
}: Props) {
  return (
    <svg
      aria-hidden
      className={`absolute inset-0 h-full w-full ${className}`}
      preserveAspectRatio="xMidYMid slice"
      style={{ color: stroke }}
    >
      <defs>
        <pattern
          id="topo-rings"
          x="0"
          y="0"
          width="260"
          height="220"
          patternUnits="userSpaceOnUse"
        >
          <g fill="none" stroke="currentColor" strokeWidth="0.6" opacity={opacity}>
            <ellipse cx="130" cy="110" rx="120" ry="80" />
            <ellipse cx="130" cy="110" rx="98" ry="62" />
            <ellipse cx="130" cy="110" rx="76" ry="46" />
            <ellipse cx="130" cy="110" rx="54" ry="32" />
            <ellipse cx="130" cy="110" rx="32" ry="18" />
            <ellipse cx="130" cy="110" rx="12" ry="6" />
          </g>
          {/* small triangulation marker — a barely-there crosshair */}
          <g stroke="currentColor" strokeWidth="0.4" opacity={opacity * 1.4}>
            <line x1="126" y1="110" x2="134" y2="110" />
            <line x1="130" y1="106" x2="130" y2="114" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#topo-rings)" />
    </svg>
  );
}
