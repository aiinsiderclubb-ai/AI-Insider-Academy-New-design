import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { AuthShowcase } from "@/components/auth/auth-showcase";
import { DotField } from "@/components/auth/dot-field";
import { getDictionary, path, type Locale } from "@/lib/i18n";

/**
 * Sign-in, sign-up and the rest of the account doors.
 *
 * The form keeps the left half over a quiet field of dots that answers the
 * pointer. The right half is the showcase: an AI system running on its own
 * in a 3D stage — always dark, in either theme, like the site's other
 * cinematic blocks. It says nothing about courses, which stay hidden until
 * launch (lib/visibility.ts).
 */
export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* -------------------------------- form -------------------------------- */}
      <div className="relative isolate flex flex-col overflow-hidden px-5 py-8 sm:px-10">
        <DotField className="pointer-events-none absolute inset-0 -z-10" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(38rem 26rem at 0% 100%, color-mix(in oklab, var(--accent) 9%, transparent), transparent 65%), radial-gradient(60% 60% at 50% 50%, transparent 40%, var(--ground) 100%)",
          }}
        />

        <div className="flex items-center justify-between gap-4">
          <Brand href={path("/", locale)} name={d.brand.name} sub={d.brand.sub} />
          <Link
            href={path("/", locale)}
            className="flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {d.nav.backToSite}
          </Link>
        </div>

        <main id="main" className="flex flex-1 items-center py-12">
          <div className="mx-auto w-full max-w-md animate-rise">{children}</div>
        </main>

        <p className="text-center text-[12px] text-faint">
          © {new Date().getFullYear()} {d.footer.madeWith}
        </p>
      </div>

      {/* ------------------------------ showcase ------------------------------ */}
      <aside className="on-dark relative hidden min-h-dvh border-l border-line lg:sticky lg:top-0 lg:block lg:h-dvh">
        <AuthShowcase locale={locale} tagline={d.brand.tagline} />
      </aside>
    </div>
  );
}
