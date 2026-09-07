import Link from "next/link";
import { BrandMark } from "./brand";
import { links } from "@/content/site";
import type { Dictionary } from "@/lib/i18n";
import { localeShort, locales, path, type Locale } from "@/lib/i18n/config";

export function SiteFooter({ locale, d }: { locale: Locale; d: Dictionary }) {
  const p = (href: string) => path(href, locale);
  const year = new Date().getFullYear();

  const columns: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
    {
      title: d.footer.learning,
      links: [
        { label: d.nav.catalog, href: p("/learn") },
        { label: d.nav.path, href: p("/learn/path") },
        { label: d.nav.bundles, href: p("/learn?tab=bundles") },
        { label: d.nav.plans, href: p("/plans") },
      ],
    },
    {
      title: d.footer.product,
      links: [
        { label: d.nav.store, href: p("/store") },
        { label: d.nav.vault, href: p("/store?collection=vault") },
        { label: d.nav.creators, href: p("/store/creators") },
        { label: d.store.becomeCreator, href: p("/store/creators#apply") },
      ],
    },
    {
      title: d.community.title,
      links: [
        { label: d.nav.forum, href: p("/community/forum") },
        { label: d.nav.events, href: p("/community/events") },
        { label: d.nav.giveaways, href: p("/community/giveaways") },
        { label: d.nav.blog, href: p("/community/blog") },
      ],
    },
    {
      title: d.footer.legal,
      links: [
        { label: d.footer.offer, href: p("/legal/offer") },
        { label: d.footer.impressum, href: p("/legal/impressum") },
        { label: d.footer.privacy, href: p("/legal/privacy") },
        { label: d.footer.refund, href: p("/legal/refund") },
        { label: d.footer.giveawayRules, href: p("/legal/giveaway-rules") },
      ],
    },
  ];

  return (
    <footer className="mt-24 border-t border-line bg-surface-2">
      <div className="mx-auto w-full max-w-[1440px] px-5 py-14 sm:px-7">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,2.6fr)]">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <BrandMark size={26} />
              <span className="font-display text-[15px] leading-none font-extrabold tracking-[-0.03em] text-ink">
                {d.brand.name}
                <span className="ml-1 font-medium text-muted">{d.brand.sub}</span>
              </span>
            </div>
            <p className="mt-4 text-[13.5px] leading-relaxed text-ink-3">{d.brand.tagline}</p>

            <div className="mt-6 flex flex-wrap gap-2">
              <a
                href={links.telegramCommunity}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-md border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-line-2 hover:text-ink"
              >
                Telegram
              </a>
              <a
                href={`mailto:${links.contactEmail}`}
                className="rounded-md border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-line-2 hover:text-ink"
              >
                {links.contactEmail}
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {columns.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <p className="eyebrow mb-3.5">{column.title}</p>
                <ul className="flex flex-col gap-2.5">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-[13.5px] text-ink-3 transition-colors hover:text-ink">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
          <p className="text-[12.5px] text-muted">
            © {year} {d.footer.madeWith}. {d.footer.rights}.
          </p>
          <ul className="flex items-center gap-1">
            {locales.map((option) => (
              <li key={option}>
                <Link
                  href={`/${option}`}
                  hrefLang={option === "ukr" ? "uk" : option}
                  aria-current={option === locale ? "true" : undefined}
                  className={
                    option === locale
                      ? "rounded px-2 py-1 font-mono text-2xs tracking-[0.1em] text-ink"
                      : "rounded px-2 py-1 font-mono text-2xs tracking-[0.1em] text-faint transition-colors hover:text-ink-2"
                  }
                >
                  {localeShort[option]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
