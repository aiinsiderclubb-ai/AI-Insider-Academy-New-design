"use client";

import * as React from "react";
import type { OAuthProvider } from "@/lib/auth/oauth";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.29 14.29a7.2 7.2 0 0 1 0-4.58V6.6H1.28a12 12 0 0 0 0 10.8l4.01-3.11Z" />
      <path fill="#EA4335" d="M12 4.76c1.76 0 3.34.6 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 1.28 6.6l4.01 3.11C6.23 6.87 8.88 4.76 12 4.76Z" />
    </svg>
  );
}

function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-[19px] w-[19px] -translate-y-px" fill="currentColor" aria-hidden>
      <path d="M16.37 12.78c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.15-2.76.83-3.47.83-.72 0-1.82-.81-2.99-.79a4.43 4.43 0 0 0-3.75 2.27c-1.6 2.78-.41 6.89 1.15 9.14.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.24-.02 2.02-1.12 2.77-2.23a9.76 9.76 0 0 0 1.26-2.59 3.98 3.98 0 0 1-2.42-3.65ZM14.1 6.03c.63-.77 1.06-1.83.94-2.9-.91.04-2.02.61-2.67 1.37-.58.67-1.09 1.76-.96 2.8 1.02.08 2.06-.52 2.69-1.27Z" />
    </svg>
  );
}

const PROVIDERS: Record<OAuthProvider, { label: string; Logo: () => React.JSX.Element }> = {
  google: { label: "Google", Logo: GoogleLogo },
  apple: { label: "Apple", Logo: AppleLogo },
};

/**
 * "Continue with Google / Apple", above the email form. Each button is a plain
 * link to /api/oauth/{provider}: the redirect does the work, so it behaves the
 * same with scripts slow, blocked or still loading.
 */
export function SocialSignIn({
  providers,
  locale,
  next,
  d,
}: {
  providers: OAuthProvider[];
  locale: Locale;
  next?: string;
  d: Dictionary;
}) {
  const [leaving, setLeaving] = React.useState<OAuthProvider | null>(null);

  // Coming back with the browser's Back button restores the page from cache;
  // without this the spinner would still be turning.
  React.useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setLeaving(null);
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  if (!providers.length) return null;

  const query = new URLSearchParams({ locale });
  if (next) query.set("next", next);

  return (
    <div className="mt-8">
      <div className="grid gap-2.5">
        {providers.map((provider) => {
          const { label, Logo } = PROVIDERS[provider];
          const busy = leaving === provider;
          return (
            <a
              key={provider}
              href={`/api/oauth/${provider}?${query}`}
              onClick={(event) => {
                if (leaving) event.preventDefault();
                else setLeaving(provider);
              }}
              aria-busy={busy || undefined}
              aria-disabled={Boolean(leaving) || undefined}
              className="group relative flex h-12 items-center justify-center gap-3 rounded-full border border-line-2 bg-surface px-5 text-[14.5px] font-medium text-ink transition-[border-color,background-color,transform] duration-150 hover:border-line-3 hover:bg-surface-2 active:scale-[0.99] aria-disabled:pointer-events-none aria-disabled:opacity-60"
            >
              {busy ? (
                <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-line-3 border-t-ink" aria-hidden />
              ) : (
                <Logo />
              )}
              <span>
                {d.auth.continueWith} {label}
              </span>
            </a>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-3" role="separator" aria-label={d.auth.orEmail}>
        <span className="h-px flex-1 bg-line" />
        <span className="font-mono text-2xs tracking-[0.18em] text-faint uppercase">{d.auth.orEmail}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
