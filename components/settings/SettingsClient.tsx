// components/settings/SettingsClient.tsx
"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
import type { GmailConnection, MaskRow, SwiftAccount } from "@/lib/quotes/queries";
import { SwiftAccountPanel } from "./SwiftAccountPanel";
import type { SendIdentity } from "@/lib/quotes/send-identities";
import { setActiveSender, disconnectSender, setActiveFrom } from "@/lib/quotes/settings-actions";
import { MaskManager } from "./MaskManager";

export function SettingsClient({ connections, activeSender, activeFrom, identities, sharedMasks, personalMasks, isMaskAdmin, swiftAccount }: {
  connections: GmailConnection[]; activeSender: string | null;
  activeFrom: string | null; identities: SendIdentity[];
  sharedMasks: MaskRow[]; personalMasks: MaskRow[]; isMaskAdmin: boolean;
  swiftAccount: SwiftAccount | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<void>) => start(async () => { await fn(); router.refresh(); });

  return (
    <div className="mx-auto w-full max-w-[760px] space-y-6">
      <section className="overflow-hidden rounded-2xl border border-rule bg-card">
        <div className="flex items-center justify-between border-b border-rule bg-card-2 px-4 py-2.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Sending accounts</span>
          <a href="/api/gmail/connect" className="inline-flex items-center gap-1 text-[11px] font-semibold text-signal hover:underline">
            <Plus size={13} /> Connect another account
          </a>
        </div>
        <div className="divide-y divide-rule/60">
          {connections.length === 0 && (
            <div className="p-6 text-sm text-muted">No Gmail accounts connected. Use &quot;Connect another account&quot; to add one.</div>
          )}
          {connections.map((c) => {
            const isActive = c.email === activeSender;
            return (
              <div key={c.email} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[13px] font-semibold">
                    {c.email}
                    {isActive && <span className="inline-flex items-center gap-1 rounded bg-gold-wash px-1.5 py-0.5 text-[10px] font-semibold text-gold"><CheckCircle2 size={11} /> Active</span>}
                    {c.status === "error" && <span className="rounded bg-ember-wash px-1.5 py-0.5 text-[10px] font-semibold text-ember">needs reconnect</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!isActive && c.status === "active" && (
                    <button disabled={pending} onClick={() => act(() => setActiveSender(c.email))}
                      className="rounded border border-rule-strong px-2 py-1 text-[11px] font-semibold hover:border-gold disabled:opacity-50">Set active</button>
                  )}
                  <button disabled={pending} onClick={() => act(() => disconnectSender(c.email))} title="Disconnect"
                    className="grid h-7 w-7 place-items-center rounded border border-rule-strong text-muted hover:border-ember hover:text-ember disabled:opacity-50">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {identities.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-rule bg-card">
          <div className="border-b border-rule bg-card-2 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            Send as
          </div>
          <div className="space-y-2 p-4">
            <p className="text-[12px] text-muted">
              Default identity for your quote emails. Sends through your active account above; the
              alias must be added to that account&apos;s Gmail &quot;Send mail as&quot;.
            </p>
            <select
              value={activeFrom ?? ""}
              disabled={pending}
              onChange={(e) => act(() => setActiveFrom(e.target.value || null))}
              className="w-full max-w-md rounded border border-rule-strong bg-input px-2 py-1.5 text-[12px] focus:border-gold focus:outline-none disabled:opacity-50"
            >
              <option value="">Your account address (default)</option>
              {identities.map((i) => (
                <option key={i.email} value={i.email}>{i.name} &lt;{i.email}&gt;</option>
              ))}
            </select>
          </div>
        </section>
      )}

      <MaskManager sharedMasks={sharedMasks} personalMasks={personalMasks} isAdmin={isMaskAdmin} />

      <SwiftAccountPanel account={swiftAccount} />
    </div>
  );
}
