import { Fragment } from "react";
import Link from "next/link";
import { ArrowUpRight, Mail, MessageCircle, Send } from "lucide-react";
import { Brand } from "./brand";
import { Spotlight } from "@/components/motion/pointer";
import { Reveal } from "@/components/motion/reveal";
import { links } from "@/content/site";
import type { Dictionary } from "@/lib/i18n";
import { localeShort, locales, path, type Locale } from "@/lib/i18n/config";

/** `https://t.me/name` → `@name`, the way a person would write it. */
function handle(url: string) {
  return `@${url.replace(/\/$/, "").split("/").pop() ?? ""}`;
}

/**
 * The last frame of every public page.
 *
 * It stands on the dark ground in both themes (`ch-ink`), so a light page ends
 * on a full stop rather than fading out, and it is built from the devices the
 * rest of the site already uses — the hairline grid, the ember, the monospaced
 * index numerals — instead of introducing new ones.
 *
 * The wordmark at the bottom is decoration and is cut by the edge on purpose.
 * It also keeps the corner clear: the assistant launcher is fixed to the
 * bottom-right of the viewport, and with the wordmark as the lowest element it
 * floats over ornament instead of over the language links.
 */
export function SiteFooter({ locale, d }: { locale: Locale; d: Dictionary }) {
  const p = (href: string) => path(href, locale);
  const year = new Date().getFullYear();

  const columns: { title: string; links: { label: string; href: string }[] }[] = [
    {
      title: d.footer.learning,
      links: [
        { label: d.nav.catalog, href: p("/learn") },
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

  const contacts = [
    {
      icon: Send,
      // The community link is an invite hash, so the row names the place instead.
      label: "Telegram",
      value: `${d.brand.name} · ${d.nav.community}`,
      href: links.telegramCommunity,
      external: true,
    },
    {
      icon: MessageCircle,
      label: d.footer.manager,
      value: handle(links.telegramManager),
      href: links.telegramManager,
      external: true,
    },
    {
      icon: Mail,
      label: "Email",
      value: links.contactEmail,
      href: `mailto:${links.contactEmail}`,
      external: false,
    },
  ];

  return (
    <footer className="ch-ink relative isolate mt-24 overflow-hidden border-t border-line bg-ground">
      {/* ------------------------------- ground ------------------------------- */}
      <div
        aria-hidden
        className="hairline-grid absolute inset-0 -z-10 opacity-45 [mask-image:radial-gradient(60%_55%_at_22%_0%,black,transparent)]"
      />
      {/* The ember sits under the wordmark, so the letters are lit from below. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 -z-10 h-[34rem]"
        style={{
          background:
            "radial-gradient(52rem 19rem at 50% 100%, color-mix(in oklab, var(--accent) 26%, transparent), transparent 70%), radial-gradient(26rem 12rem at 12% 100%, color-mix(in oklab, var(--accent) 10%, transparent), transparent 72%)",
        }}
      />
      <span
        aria-hidden
        className="absolute top-0 left-1/2 h-px w-[min(56rem,82%)] -translate-x-1/2 bg-[linear-gradient(90deg,transparent,var(--accent),transparent)] opacity-80"
      />

      <Spotlight className="relative">
        <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-7">
          {/* ------------------------------ statement ------------------------------ */}
          <div className="grid gap-12 pt-16 sm:pt-20 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-end lg:gap-20">
            <Reveal>
              <Brand href={p("/")} name={d.brand.name} sub={d.brand.sub} className="w-fit" />
              {/* Words are kept whole: a hyphenated one ("AI-систем") would otherwise break at its hyphen. */}
              <p className="mt-7 max-w-[18ch] font-display text-[clamp(2.1rem,4.7vw,3.75rem)] leading-[1.04] font-extrabold tracking-[-0.045em] text-balance text-ink">
                {d.brand.tagline.split(" ").map((word, index, words) => (
                  <Fragment key={word}>
                    <span className="whitespace-nowrap">
                      {word}
                      {index === words.length - 1 && <span className="text-accent">.</span>}
                    </span>
                    {/* The space stays outside the unbreakable span, or no line could end at it. */}
                    {index < words.length - 1 && " "}
                  </Fragment>
                ))}
              </p>
            </Reveal>

            <Reveal delay={120}>
              <p className="eyebrow flex items-center gap-3">
                <span className="rule-accent inline-block w-7" aria-hidden />
                {d.footer.contacts}
              </p>
              <ul className="mt-5 border-t border-line">
                {contacts.map((contact) => (
                  <li key={contact.href} className="border-b border-line">
                    <a
                      href={contact.href}
                      {...(contact.external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
                      className="group flex items-center gap-4 py-4 outline-offset-4"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line-2 bg-surface text-ink-2 transition-colors duration-200 group-hover:border-accent group-hover:bg-accent group-hover:text-on-accent">
                        <contact.icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-2xs tracking-[0.14em] text-muted uppercase">
                          {contact.label}
                        </span>
                        <span className="mt-1 block truncate text-[15px] font-medium text-ink-2 transition-colors duration-200 group-hover:text-ink">
                          {contact.value}
                        </span>
                      </span>
                      <ArrowUpRight
                        className="h-4 w-4 shrink-0 text-faint transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent"
                        aria-hidden
                      />
                    </a>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          {/* --------------------------------- map --------------------------------- */}
          <div className="mt-14 grid grid-cols-2 gap-x-8 gap-y-10 border-t border-line pt-10 sm:mt-16 sm:grid-cols-4">
            {columns.map((column, index) => (
              <nav key={column.title} aria-label={column.title}>
                <p className="eyebrow flex items-baseline gap-2.5">
                  <span className="numeral" aria-hidden>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {column.title}
                </p>
                <ul className="mt-5 flex flex-col gap-3">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="group inline-flex items-center text-[14px] text-ink-3 transition-colors duration-200 hover:text-ink"
                      >
                        {/* A dash slides in ahead of the label — the page's orange rule, at link scale. */}
                        <span
                          aria-hidden
                          className="h-px w-0 bg-accent transition-[width,margin] duration-200 ease-out group-hover:mr-2 group-hover:w-3 group-focus-visible:mr-2 group-focus-visible:w-3"
                        />
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          {/* ------------------------------- colophon ------------------------------ */}
          <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-line py-6 sm:justify-between">
            <p className="text-[12.5px] text-muted">
              © {year} {d.footer.madeWith}. {d.footer.rights}.
            </p>
            <ul className="flex items-center gap-1 rounded-full border border-line bg-surface p-1">
              {locales.map((option) => (
                <li key={option}>
                  <Link
                    href={`/${option}`}
                    hrefLang={option === "ukr" ? "uk" : option}
                    aria-current={option === locale ? "true" : undefined}
                    className={
                      option === locale
                        ? "block rounded-full bg-surface-3 px-3 py-1 font-mono text-2xs tracking-[0.1em] text-ink"
                        : "block rounded-full px-3 py-1 font-mono text-2xs tracking-[0.1em] text-muted transition-colors hover:text-ink"
                    }
                  >
                    {localeShort[option]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ------------------------------- wordmark ------------------------------- */}
        <p
          aria-hidden
          className="pointer-events-none -mb-[0.12em] bg-clip-text text-center font-display text-[clamp(4rem,16.4vw,15.5rem)] leading-[0.82] font-extrabold tracking-[-0.06em] whitespace-nowrap text-transparent select-none"
          style={{
            backgroundImage:
              "linear-gradient(180deg, color-mix(in oklab, var(--ink) 22%, transparent) 0%, color-mix(in oklab, var(--ink) 9%, transparent) 55%, color-mix(in oklab, var(--accent) 22%, transparent) 100%)",
          }}
        >
          {d.brand.name}
        </p>
      </Spotlight>
    </footer>
  );
}
