"use client";
/**
 * Instant navigation loader. Rendered by each route's loading.tsx so a tab
 * click shows an on-brand animated robot immediately while the server fetch
 * runs. The shared masthead + tab nav persist from the (app) layout, so this
 * only fills the content area below them. The robot Lottie lives at
 * /public/loaders/robot.json (recolored to the Ledger palette) — swap that
 * file to change the animation, no code change needed.
 */
import { useEffect, useState } from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

export function RobotLoader({ subtitle }: { subtitle?: string }) {
  // Respect the user's reduced-motion preference: hold a static frame.
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex min-h-0 w-full max-w-[1800px] flex-1 flex-col items-center justify-center px-6 pb-6 pt-5 lg:px-10">
        <div className="h-44 w-44 sm:h-52 sm:w-52" aria-hidden>
          <DotLottieReact
            src="/loaders/robot.json"
            autoplay={!reduced}
            loop={!reduced}
            className="h-full w-full"
          />
        </div>
        <span className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-soft">
          {subtitle ?? "Loading…"}
        </span>
      </div>
    </main>
  );
}
