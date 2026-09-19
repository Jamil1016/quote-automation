import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/ui/Logo";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { HairlineRule } from "@/components/ui/HairlineRule";
import { TopographicField } from "@/components/ui/TopographicField";
import { isDemoMode } from "@/lib/demo/mode";
import { enterDemo, signInWithGoogle } from "./actions";

type Props = {
  searchParams: Promise<{ err?: string }>;
};

const GOOGLE_PROVIDER_HINT =
  "Provider is not enabled or not configured for this project.";

export default async function SignInPage({ searchParams }: Props) {
  // Already signed in? Don't show the login form again. Send them into the app;
  // the (app) layout re-checks the allowlist and routes non-allowed users to
  // /not-authorized. Uses getUser() (validates with Supabase Auth), not getSession().
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/");

  const { err } = await searchParams;
  const demo = isDemoMode();
  const showSetupHint =
    err && /provider|not enabled|unsupported|400|404/i.test(err);

  return (
    <main data-theme="brand" className="relative isolate min-h-svh overflow-hidden bg-paper text-ink">
      {/* Topographic backdrop with a soft mask so it fades into the page */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 topo-mask text-ink"
      >
        <TopographicField opacity={0.07} />
      </div>

      {/* Brand corner */}
      <header className="relative z-10 px-6 py-6 sm:px-10">
        <Logo size={24} withWordmark />
      </header>

      {/* Centerpiece */}
      <section className="relative z-10 mx-auto flex max-w-[1180px] flex-col gap-12 px-6 pb-16 pt-10 sm:px-10 lg:flex-row lg:items-stretch lg:gap-20 lg:pt-24">
        {/* Left — type */}
        <div className="flex max-w-xl flex-col justify-center">
          <Eyebrow className="rise rise-delay-1">{demo ? "Public demo" : "Internal Access"}</Eyebrow>

          <h1 className="rise rise-delay-2 mt-4 font-display text-[clamp(38px,6.4vw,72px)] font-medium leading-[0.96] tracking-tight text-ink">
            Quotation,
            <br />
            <em className="not-italic text-signal">in one place.</em>
          </h1>

          <p className="rise rise-delay-3 mt-6 max-w-md text-[15px] leading-relaxed text-muted">
            Quote Automation is Example Co&apos;s quotation workspace. It shows the
            current Quote-Provided worklist matched to its invoicing-form
            entry, refreshed daily, with every figure traceable to its source.
          </p>

          {demo ? (
            <div className="rise rise-delay-4 mt-10">
              <form action={enterDemo}>
                <button
                  type="submit"
                  className="btn-signal group inline-flex items-center gap-3 rounded-full px-6 py-3 text-[14.5px]"
                >
                  <span>Enter demo</span>
                  <span className="opacity-60 transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </button>
              </form>
              <p className="mt-4 max-w-md text-xs leading-relaxed text-muted">
                No account needed. You are signed in as a shared demo user. All
                data is invented, nothing is uploaded to Drive, and no email is
                sent. The data can be reset at any time.
              </p>
            </div>
          ) : (
          <div className="rise rise-delay-4 mt-10">
            <form action={signInWithGoogle}>
              <button
                type="submit"
                className="btn-signal group inline-flex items-center gap-3 rounded-full px-6 py-3 text-[14.5px]"
              >
                <GoogleGlyph />
                <span>Continue with Google</span>
                <span className="opacity-60 transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </button>
            </form>

            <p className="mt-4 text-xs text-muted">
              Use your{" "}
              <span className="font-mono text-[12px] text-ink-soft">
                @example.com
              </span>{" "}
              account. Access is by invitation. Ask an admin if you don&apos;t
              have one yet.
            </p>
          </div>
          )}

          {err && (
            <div
              role="alert"
              className="rise rise-delay-5 mt-6 max-w-md rounded-md border border-amber/40 bg-amber/5 px-4 py-3 text-[13px] leading-relaxed text-ink-soft"
            >
              <p className="font-mono text-[11px] uppercase tracking-wider text-amber">
                Sign-in failed
              </p>
              <p className="mt-1">
                {showSetupHint
                  ? GOOGLE_PROVIDER_HINT
                  : decodeURIComponent(err)}
              </p>
              {showSetupHint && (
                <p className="mt-3 text-xs text-muted">
                  Open Supabase → Authentication → Providers → Google, paste a
                  client ID + secret from Google Cloud Console (project{" "}
                  <span className="font-mono">YOUR_GCP_PROJECT</span>),
                  then try again.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right — meta card */}
        <aside className="relative flex max-w-md flex-1 flex-col justify-between border-l border-rule pl-0 lg:pl-12">
          <div className="rise rise-delay-4 space-y-6">
            <div>
              <Eyebrow>What you&apos;ll get</Eyebrow>
              <HairlineRule className="mt-2" width="w-8" />
            </div>

            <ul className="space-y-5 text-[14.5px] leading-relaxed">
              <Feature label="The worklist, already matched">
                Every Accounting Quote-Provided task lined up against its priced
                invoicing-form entry, refreshed daily.
              </Feature>
              <Feature label="Traceable to the source line">
                Each quote shows the exact invoice line, service rate, and
                category mapping behind it. Edit, choose a line, or verify
                before anything goes out.
              </Feature>
              <Feature label="Generate and file in one step">
                Produce Example Co quotation PDFs and upload them straight to Drive,
                one or a whole batch. Emails go out only when you schedule
                them, as Gmail drafts sent at the time you pick.{demo ? " In this demo nothing is uploaded or sent." : ""}
              </Feature>
            </ul>
          </div>

          <footer className="rise rise-delay-5 mt-12 border-t border-rule pt-5 text-[11px] uppercase tracking-[0.16em] text-muted">
            <p>
              Example Co · Data Analytics ·{" "}
              <Link href="/" className="underline-offset-4 hover:underline">
                example.com
              </Link>
            </p>
          </footer>
        </aside>
      </section>
    </main>
  );
}

function Feature({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="grid grid-cols-[14px_1fr] gap-3">
      <span className="mt-2 h-px w-3 bg-ink" aria-hidden />
      <div>
        <p className="font-display text-[16px] leading-snug text-ink">{label}</p>
        <p className="mt-1 text-[13.5px] text-muted">{children}</p>
      </div>
    </li>
  );
}

function GoogleGlyph() {
  return (
    <svg
      aria-hidden
      width="16"
      height="16"
      viewBox="0 0 18 18"
      className="-ml-1"
    >
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
        fill="#fff"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.836.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#fff"
        opacity="0.85"
      />
      <path
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.961H.957A9 9 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.333z"
        fill="#fff"
        opacity="0.7"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.581C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.294C4.672 5.166 6.656 3.58 9 3.58z"
        fill="#fff"
        opacity="0.55"
      />
    </svg>
  );
}
