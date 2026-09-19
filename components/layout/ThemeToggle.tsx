// components/layout/ThemeToggle.tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sun, Moon } from "lucide-react";
import { setTheme } from "@/lib/quotes/settings-actions";
import type { Theme } from "@/lib/quotes/theme";

/**
 * Ledger ⇄ Example Co theme switch in the masthead. Flips the shell's data-theme
 * optimistically (instant), persists via setTheme, then refreshes so the
 * server-rendered shell agrees. data-theme lives on #app-shell (see (app)/layout).
 */
export function ThemeToggle({ theme }: { theme: Theme }) {
  const router = useRouter();
  const [current, setCurrent] = useState<Theme>(theme);
  const [pending, start] = useTransition();

  const flip = () => {
    const next: Theme = current === "brand" ? "ledger" : "brand";
    setCurrent(next);
    const shell = document.getElementById("app-shell");
    if (shell) {
      if (next === "brand") shell.setAttribute("data-theme", "brand");
      else shell.removeAttribute("data-theme");
    }
    start(async () => {
      try { await setTheme(next); router.refresh(); } catch { /* keep optimistic state */ }
    });
  };

  const toBrand = current !== "brand";
  return (
    <button
      type="button"
      onClick={flip}
      disabled={pending}
      aria-label={toBrand ? "Switch to Example Co theme" : "Switch to Ledger theme"}
      title={toBrand ? "Switch to Example Co (dark)" : "Switch to Ledger (light)"}
      className="grid h-8 w-8 place-items-center rounded-md border border-rule-strong text-muted transition-colors hover:border-signal hover:text-signal disabled:opacity-50"
    >
      {toBrand ? <Moon size={15} /> : <Sun size={15} />}
    </button>
  );
}
