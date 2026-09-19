type Props = {
  className?: string;
  /** Length expressed as a Tailwind width class, e.g. "w-12" or "w-full". */
  width?: string;
};

/**
 * 1px rule used above section heads. Cream by default, can be inverted
 * via className for dark surfaces.
 */
export function HairlineRule({ className = "", width = "w-10" }: Props) {
  return <span className={`block hairline ${width} ${className}`} aria-hidden />;
}
