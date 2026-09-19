// components/settings/SwiftAccountPanel.tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, CheckCircle2 } from "lucide-react";
import type { SwiftAccount } from "@/lib/quotes/queries";
import { connectSwift, disconnectSwift } from "@/lib/quotes/swift-account-actions";

export function SwiftAccountPanel({ account }: { account: SwiftAccount | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const connect = () =>
    start(async () => {
      setError(null);
      try {
        await connectSwift(username, password);
        setUsername("");
        setPassword("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not connect.");
      }
    });

  const disconnect = () =>
    start(async () => {
      setError(null);
      try {
        await disconnectSwift();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not disconnect.");
      }
    });

  return (
    <section className="overflow-hidden rounded-2xl border border-rule bg-card">
      <div className="border-b border-rule bg-card-2 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
        PM API account
      </div>
      <div className="space-y-3 p-4">
        {account ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[13px] font-semibold">
                {account.username}
                <span className="inline-flex items-center gap-1 rounded bg-gold-wash px-1.5 py-0.5 text-[10px] font-semibold text-gold">
                  <CheckCircle2 size={11} /> Connected
                </span>
              </div>
              {account.verifiedAt && (
                <div className="mt-0.5 text-[11px] text-muted">
                  Verified {new Date(account.verifiedAt).toLocaleDateString()}
                </div>
              )}
            </div>
            <button
              disabled={pending}
              onClick={disconnect}
              title="Disconnect"
              className="grid h-7 w-7 shrink-0 place-items-center rounded border border-rule-strong text-muted hover:border-ember hover:text-ember disabled:opacity-50"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ) : (
          <>
            <p className="text-[12px] text-muted">
              Save your project-management (PM) API email and password. Used later to file sent quotes back to the PM system.
            </p>
            <input
              type="email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="PM API email"
              autoComplete="off"
              disabled={pending}
              className="w-full max-w-md rounded border border-rule-strong bg-input px-2 py-1.5 text-[12px] focus:border-gold focus:outline-none disabled:opacity-50"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="PM API password"
              autoComplete="new-password"
              disabled={pending}
              className="w-full max-w-md rounded border border-rule-strong bg-input px-2 py-1.5 text-[12px] focus:border-gold focus:outline-none disabled:opacity-50"
            />
            <button
              disabled={pending || username.length === 0 || password.length === 0}
              onClick={connect}
              className="rounded border border-rule-strong px-3 py-1.5 text-[11px] font-semibold hover:border-gold disabled:opacity-50"
            >
              {pending ? "Connecting..." : "Connect"}
            </button>
          </>
        )}
        {error && <div className="text-[11px] font-semibold text-ember">{error}</div>}
      </div>
    </section>
  );
}
