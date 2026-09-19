"use client";
import { useState } from "react";
import { usePresence, initials, colorFor, type PresenceUser } from "@/lib/presence/usePresence";

function Avatar({ u, size = 30, ring = "var(--card)" }: { u: PresenceUser; size?: number; ring?: string }) {
  return (
    <span
      title={`${u.name}${u.isSelf ? " (you)" : ""} · ${u.idle ? "idle" : u.page}`}
      className="relative grid place-items-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: colorFor(u.email),
        boxShadow: `0 0 0 2px ${ring}`,
      }}
    >
      {initials(u.name)}
      <span
        className="absolute -bottom-0.5 -right-0.5 rounded-full"
        style={{
          width: size * 0.28,
          height: size * 0.28,
          background: u.idle ? "var(--idle)" : "var(--moss)",
          boxShadow: `0 0 0 2px ${ring}`,
        }}
      />
    </span>
  );
}

/**
 * "Active now" presence widget for the masthead: a live count + an avatar
 * stack of other people in the app, expandable to a full roster.
 */
export function PresenceCluster({ email }: { email: string }) {
  const users = usePresence(email);
  const [open, setOpen] = useState(false);
  const others = users.filter((u) => !u.isSelf);
  const activeCount = users.filter((u) => !u.idle).length;
  const shown = others.slice(0, 4);
  const extra = others.length - shown.length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="See who's online"
        className="flex items-center gap-2.5 rounded-full border border-rule-strong bg-card py-1 pl-3 pr-1.5 transition-colors hover:border-gold"
      >
        <span className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted">
          <span className="presence-dot" />
          {activeCount} active
        </span>
        {shown.length > 0 && (
          <span className="flex items-center">
            {shown.map((u, i) => (
              <span key={u.email} style={{ marginLeft: i === 0 ? 0 : -9 }}>
                <Avatar u={u} size={26} />
              </span>
            ))}
            {extra > 0 && (
              <span
                className="grid place-items-center rounded-full bg-paper-deep font-mono text-[10px] font-semibold text-muted"
                style={{ width: 26, height: 26, marginLeft: -9, boxShadow: "0 0 0 2px var(--card)" }}
              >
                +{extra}
              </span>
            )}
          </span>
        )}
      </button>

      {open && (
        <>
          <button aria-hidden onClick={() => setOpen(false)} className="fixed inset-0 z-40" />
          <div className="absolute right-0 z-50 mt-2 w-72 origin-top-right rounded-xl border border-rule-strong bg-card p-2 shadow-[0_22px_60px_-30px_rgba(33,28,20,0.5)]">
            <div className="px-2 pb-2 pt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              In the app now · {users.length}
            </div>
            <div className="flex flex-col">
              {users.map((u) => (
                <div key={u.email} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-card-2">
                  <Avatar u={u} size={30} ring="var(--card)" />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold leading-tight">
                      {u.name} {u.isSelf && <span className="font-normal text-muted">· you</span>}
                    </div>
                    <div className="truncate text-[11px] text-muted">
                      {u.idle ? "Idle" : u.page}
                    </div>
                  </div>
                  <span
                    className="ml-auto h-2 w-2 shrink-0 rounded-full"
                    style={{ background: u.idle ? "var(--idle)" : "var(--moss)" }}
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
