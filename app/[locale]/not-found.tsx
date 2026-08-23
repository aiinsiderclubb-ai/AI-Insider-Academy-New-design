import Link from "next/link";
import { BrandMark } from "@/components/layout/brand";
import { ButtonLink } from "@/components/primitives/button";
import { Container } from "@/components/primitives/surface";
import { getDictionary, path, defaultLocale } from "@/lib/i18n";

/**
 * `not-found` cannot read route params, so it speaks the default locale and
 * offers the four entrances rather than a dead end.
 */
export default function NotFound() {
  const locale = defaultLocale;
  const d = getDictionary(locale);

  const routes = [
    { label: d.nav.learn, href: path("/learn", locale) },
    { label: d.nav.store, href: path("/store", locale) },
    { label: d.nav.plans, href: path("/plans", locale) },
    { label: d.nav.community, href: path("/community/forum", locale) },
  ];

  return (
    <Container size="narrow" className="flex min-h-dvh flex-col items-center justify-center py-20 text-center">
      <BrandMark size={34} />
      <p className="eyebrow mt-8">404</p>
      <h1 className="mt-5 text-[clamp(2rem,5vw,3.25rem)] leading-[1.03] tracking-[-0.04em]">{d.states.notFoundTitle}</h1>
      <p className="mt-4 max-w-md text-[15.5px] leading-relaxed text-ink-2">{d.states.notFoundBody}</p>

      <ButtonLink href={path("/", locale)} size="lg" className="mt-8">
        {d.states.goHome}
      </ButtonLink>

      <ul className="mt-10 flex flex-wrap justify-center gap-2">
        {routes.map((route) => (
          <li key={route.href}>
            <Link
              href={route.href}
              className="rounded-full border border-line bg-surface px-4 py-2 text-[13px] text-ink-2 transition-colors hover:border-line-2 hover:text-ink"
            >
              {route.label}
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
