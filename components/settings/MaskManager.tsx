// components/settings/MaskManager.tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { MaskRow } from "@/lib/quotes/queries";
import { addMask, removeMask } from "@/lib/quotes/settings-actions";

function AddMaskForm({ pending, onAdd }: { pending: boolean; onAdd: (name: string, email: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const submit = () => {
    if (name.trim() && email.trim()) { onAdd(name.trim(), email.trim()); setName(""); setEmail(""); }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name (e.g. Accounting | Example Co)"
        className="min-w-[180px] flex-1 rounded border border-rule-strong bg-input px-2 py-1.5 text-[12px] focus:border-gold focus:outline-none" />
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com"
        className="min-w-[160px] flex-1 rounded border border-rule-strong bg-input px-2 py-1.5 text-[12px] focus:border-gold focus:outline-none" />
      <button disabled={pending} onClick={submit}
        className="inline-flex items-center gap-1 rounded border border-rule-strong px-2 py-1.5 text-[11px] font-semibold hover:border-gold disabled:opacity-50">
        <Plus size={13} /> Add
      </button>
    </div>
  );
}

function MaskList({ masks, canRemove, pending, onRemove }: {
  masks: MaskRow[]; canRemove: boolean; pending: boolean; onRemove: (id: number) => void;
}) {
  if (masks.length === 0) return <div className="text-[12px] text-muted">None yet.</div>;
  return (
    <div className="divide-y divide-rule/60">
      {masks.map((m) => (
        <div key={m.id} className="flex items-center justify-between gap-3 py-2">
          <span className="text-[13px]"><span className="font-semibold">{m.name}</span> <span className="text-muted">&lt;{m.email}&gt;</span></span>
          {canRemove && (
            <button disabled={pending} onClick={() => onRemove(m.id)} title="Remove"
              className="grid h-7 w-7 place-items-center rounded border border-rule-strong text-muted hover:border-ember hover:text-ember disabled:opacity-50">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function MaskManager({ sharedMasks, personalMasks, isAdmin }: {
  sharedMasks: MaskRow[]; personalMasks: MaskRow[]; isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<void>) => start(async () => { await fn(); router.refresh(); });

  return (
    <section className="overflow-hidden rounded-2xl border border-rule bg-card">
      <div className="border-b border-rule bg-card-2 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
        Send-as masks
      </div>
      <div className="space-y-5 p-4">
        <p className="text-[12px] text-muted">
          A mask lets you send as another address. It only sends if that address is added and verified
          in the sending account&apos;s Gmail &quot;Send mail as&quot;.
        </p>

        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Shared (everyone can use)</div>
          <MaskList masks={sharedMasks} canRemove={isAdmin} pending={pending} onRemove={(id) => run(() => removeMask(id))} />
          {isAdmin && <AddMaskForm pending={pending} onAdd={(n, e) => run(() => addMask(n, e, "shared"))} />}
        </div>

        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Your masks (only you)</div>
          <MaskList masks={personalMasks} canRemove={true} pending={pending} onRemove={(id) => run(() => removeMask(id))} />
          <AddMaskForm pending={pending} onAdd={(n, e) => run(() => addMask(n, e, "personal"))} />
        </div>
      </div>
    </section>
  );
}
