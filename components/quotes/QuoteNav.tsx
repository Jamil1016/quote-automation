"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Quotation Queue" },
  { href: "/generated", label: "Generated" },
  { href: "/email-builder", label: "Templates" },
  { href: "/directory", label: "Quote Directory" },
  { href: "/data-source", label: "Data Source" },
];

/** Underlined editorial tab nav, shared across all app pages via the header. */
export function QuoteNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-7">
      {TABS.map((t) => {
        const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 pb-3 text-[13px] font-semibold tracking-[0.01em] transition-colors ${
              active
                ? "border-gold text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
