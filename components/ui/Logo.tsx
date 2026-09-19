type Props = {
  size?: number;
  className?: string;
  withWordmark?: boolean;
};

/**
 * Brand mark. This reference build ships a text wordmark; replace it with your
 * own logo (e.g. a next/image) for production.
 */
export function Logo({ size = 28, className = "", withWordmark = false }: Props) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <span
        className="brand-logo font-display font-semibold uppercase leading-none text-ink"
        style={{ fontSize: size * 0.6, letterSpacing: "0.14em" }}
      >
        Example Co
      </span>
      {withWordmark && (
        <span
          className="font-display text-[15px] font-semibold uppercase leading-none text-ink"
          style={{ letterSpacing: "0.14em" }}
        >
          Quote Automation
        </span>
      )}
    </span>
  );
}
