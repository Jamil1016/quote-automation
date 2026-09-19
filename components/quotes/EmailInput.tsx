"use client";
import { useState } from "react";
import { X } from "lucide-react";

/**
 * Chip/tag-style email entry. Type an address and press space, comma, or Enter
 * to turn it into a bubble; Backspace on an empty field removes the last; the ✕
 * removes a specific one. Value in/out is a comma-joined string, so it drops in
 * wherever a comma-separated recipient/cc field was used.
 */
export function EmailInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const emails = value.split(",").map((e) => e.trim()).filter(Boolean);
  const setEmails = (arr: string[]) => onChange(arr.join(", "));

  const commit = (raw: string) => {
    const parts = raw.split(/[,\s]+/).map((e) => e.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...emails];
    for (const p of parts) if (!next.includes(p)) next.push(p);
    setEmails(next);
    setInput("");
  };
  const removeAt = (i: number) => setEmails(emails.filter((_, idx) => idx !== i));

  return (
    <div className="flex w-full flex-wrap items-center gap-1 rounded border border-rule bg-input px-1.5 py-1 focus-within:border-signal">
      {emails.map((em, i) => (
        <span
          key={`${em}-${i}`}
          className="inline-flex items-center gap-1 rounded-full border border-signal/30 bg-signal-wash px-2 py-0.5 text-[11px] text-signal-deep"
        >
          {em}
          <button type="button" onClick={() => removeAt(i)} className="hover:text-ember" aria-label={`remove ${em}`}>
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        className="min-w-[90px] flex-1 bg-transparent text-[12px] outline-none"
        value={input}
        placeholder={emails.length ? "" : (placeholder ?? "email")}
        onChange={(e) => {
          const v = e.target.value;
          if (/[,\s]/.test(v)) commit(v); // handles pasted lists
          else setInput(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "," || e.key === " ") {
            e.preventDefault();
            commit(input);
          } else if (e.key === "Backspace" && input === "" && emails.length) {
            removeAt(emails.length - 1);
          }
        }}
        onBlur={() => commit(input)}
      />
    </div>
  );
}
