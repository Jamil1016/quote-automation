export function EmailChips({ value, nowrap = false }: { value: string | null; nowrap?: boolean }) {
  const emails = (value ?? "").split(/[,;]+/).map((e) => e.trim()).filter(Boolean);
  if (emails.length === 0) return <span className="text-muted">—</span>;
  return (
    <span className={`inline-flex gap-1 ${nowrap ? "max-w-full flex-nowrap overflow-hidden align-bottom" : "flex-wrap"}`}>
      {emails.map((e, i) => (
        <span
          key={i}
          className={`inline-flex items-center text-[11px] bg-signal-wash text-signal-deep border border-signal/30 rounded-full px-2 py-0.5 ${nowrap ? "shrink-0 whitespace-nowrap" : ""}`}
        >
          {e}
        </span>
      ))}
    </span>
  );
}
