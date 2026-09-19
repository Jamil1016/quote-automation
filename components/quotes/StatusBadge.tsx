import type { QuoteStatus } from "@/lib/quotes/types";
import { statusLabel } from "@/lib/quotes/format";

type BadgeStatus = QuoteStatus | "no_service";

const styles: Record<BadgeStatus, string> = {
  ready: "bg-moss-wash text-moss",
  no_price: "bg-amber-wash text-amber",
  no_service: "bg-signal-wash text-signal",
  no_match: "bg-ember-wash text-ember",
};

export function StatusBadge({ status }: { status: BadgeStatus }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${styles[status]}`}>
      {statusLabel(status)}
    </span>
  );
}
