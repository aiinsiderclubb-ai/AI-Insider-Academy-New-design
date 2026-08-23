"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, Search, X } from "lucide-react";
import { Brand } from "./brand";
import { LanguagePills } from "./language-pills";
import { LanguageMenu } from "./language-menu";
import { ThemeToggle } from "./theme-toggle";
import type { NavSection } from "./nav-model";
import { ButtonLink } from "@/components/primitives/button";
import { Avatar } from "@/components/primitives/display";
import type { Dictionary } from "@/lib/i18n";
import { path, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export interface HeaderUser {
  name: string;
  avatarUrl?: string | null;
}

/**
 * A floating pill bar.
 *
 * At the top of the page it sits flush and transparent; past the first scroll
 * it contracts into a rounded, blurred capsule so the content underneath keeps
 * moving behind it.
 */
export function SiteHeader({
  locale,
  d,
  nav,
  user,
  onOpenSearch,
}: {
  locale: Locale;
  d: Dictionary;
  nav: NavSection[];
  user: HeaderUser | null;
  onOpenSearch?: () => void;
}) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const closeTimer = React.useRef<number | null>(null);

  const [overHero, setOverHero] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Pages that open with a full-bleed dark frame mark it, so the transparent
  // bar can borrow that ground instead of printing dark text on a dark photo.
  React.useEffect(() => {
    setOverHero(Boolean(document.querySelector("[data-dark-hero]")));
  }, [pathname]);

  React.useEffect(() => {
    setOpenId(null);
    setMobileOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!mobileOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenId(null);
        setMobileOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const hoverOpen = (id: string) => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpenId(id);
  };
  const hoverClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpenId(null), 140);
  };

  const isActive = (href: string) => {
    const base = href.split("?")[0];
    return pathname === base || pathname.startsWith(`${base}/`);
  };

  return (
    <header className={cn("sticky top-0 z-50 h-16", overHero && !scrolled && "on-dark")}>
      {/* The bar keeps a constant 64px in flow; only the capsule inside moves,
          so nothing shifts when it contracts on scroll. */}
      <div
        className={cn(
          "absolute inset-x-0 mx-auto flex items-center gap-3 transition-all duration-300 ease-[var(--ease-out-quart)]",
          scrolled
            ? "top-2 h-14 max-w-[1180px] rounded-full border border-line bg-[color-mix(in_oklab,var(--surface)_78%,transparent)] px-3 shadow-pop backdrop-blur-xl sm:px-4"
            : "top-0 h-16 max-w-[1440px] rounded-none border border-transparent bg-transparent px-5 sm:px-7",
        )}
      >
        <Brand href={path("/", locale)} name={d.brand.name} sub={d.brand.sub} />

        {/* ------------------------------ pill nav ------------------------------ */}
        <nav
          className="mx-auto hidden items-center gap-0.5 rounded-full border border-line bg-[color-mix(in_oklab,var(--surface-2)_72%,transparent)] p-1 backdrop-blur-md lg:flex"
          aria-label={d.nav.learn}
        >
          {nav.map((section) => {
            const active = isActive(section.href);
            const expandable = Boolean(section.groups?.length);
            const open = openId === section.id;

            return (
              <div
                key={section.id}
                className="relative"
                onPointerEnter={() => expandable && hoverOpen(section.id)}
                onPointerLeave={() => expandable && hoverClose()}
              >
                <Link
                  href={section.href}
                  aria-expanded={expandable ? open : undefined}
                  onClick={(event) => {
                    if (!expandable) return;
                    if (!open && event.detail === 0) {
                      event.preventDefault();
                      setOpenId(section.id);
                    }
                  }}
                  className={cn(
                    "flex h-8 items-center gap-1 rounded-full px-3.5 text-[13.5px] font-medium transition-colors duration-200",
                    active
                      ? "bg-accent text-on-accent"
                      : open
                        ? "bg-surface-3 text-ink"
                        : "text-ink-2 hover:text-ink",
                  )}
                >
                  {section.label}
                  {expandable && (
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform duration-200",
                        active ? "opacity-70" : "text-faint",
                        open && "rotate-180",
                      )}
                      aria-hidden
                    />
                  )}
                </Link>

                {expandable && open && (
                  <div
                    className="animate-pop absolute top-[calc(100%+12px)] left-1/2 z-50 w-[min(40rem,90vw)] -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-surface shadow-pop"
                    onPointerEnter={() => hoverOpen(section.id)}
                    onPointerLeave={hoverClose}
                  >
                    <div className={cn("grid", section.feature ? "sm:grid-cols-[1.15fr_1fr]" : "grid-cols-1")}>
                      <div className="p-3">
                        {section.groups?.map((group) => (
                          <div key={group.title}>
                            {section.groups!.length > 1 && <p className="eyebrow px-3 pt-2 pb-1.5">{group.title}</p>}
                            {group.links.map((link, index) => (
                              <Link
                                key={link.href}
                                href={link.href}
                                className="group/item flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-2"
                              >
                                <span className="mt-0.5 font-mono text-[10.5px] tabular-nums text-faint">
                                  {String(index + 1).padStart(2, "0")}
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-[14px] font-medium text-ink">{link.label}</span>
                                  {link.note && (
                                    <span className="mt-0.5 block line-clamp-1 text-[12.5px] text-muted">{link.note}</span>
                                  )}
                                </span>
                              </Link>
                            ))}
                          </div>
                        ))}
                      </div>

                      {section.feature && (
                        <Link
                          href={section.feature.href}
                          className="group/feature flex flex-col justify-between gap-6 border-l border-line bg-surface-2 p-5 transition-colors hover:bg-surface-3"
                        >
                          <div>
                            <p className="eyebrow text-accent-ink">{section.feature.eyebrow}</p>
                            <p className="mt-3 font-display text-[17px] leading-tight font-extrabold tracking-tight text-ink">
                              {section.feature.title}
                            </p>
                            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">{section.feature.body}</p>
                          </div>
                          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent-ink">
                            {section.feature.cta}
                            <span className="transition-transform duration-200 group-hover/feature:translate-x-0.5">→</span>
                          </span>
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="flex-1 lg:hidden" />

        {/* ----------------------------- utilities ------------------------------ */}
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label={d.nav.search}
            className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface-2 px-3 text-[13px] text-muted transition-colors hover:border-line-2 hover:text-ink"
          >
            <Search className="h-3.5 w-3.5" aria-hidden />
            <kbd className="font-mono text-[10px] text-faint">⌘K</kbd>
          </button>

          <LanguagePills locale={locale} label={d.nav.language} className="hidden lg:flex" />

          <ThemeToggle
            labels={{ theme: d.nav.theme, light: d.nav.themeLight, dark: d.nav.themeDark, system: d.nav.themeSystem }}
            triggerClassName="border border-line bg-surface-2"
          />

          {user ? (
            <ButtonLink href={path("/app", locale)} size="sm" className="pl-1.5">
              <Avatar name={user.name} src={user.avatarUrl} size={22} />
              <span className="max-w-28 truncate">{d.nav.dashboard}</span>
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href={path("/login", locale)} variant="ghost" size="sm">
                {d.nav.login}
              </ButtonLink>
              <ButtonLink href={path("/register", locale)} size="sm">
                {d.nav.register}
              </ButtonLink>
            </>
          )}
        </div>

        {/* --------------------------- mobile trigger --------------------------- */}
        <div className="flex items-center gap-1 md:hidden">
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label={d.nav.search}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <Search className="h-[18px] w-[18px]" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            aria-label={mobileOpen ? d.nav.closeMenu : d.nav.openMenu}
            aria-expanded={mobileOpen}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface-2 text-ink transition-colors hover:border-line-2"
          >
            {mobileOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </div>

      {/* ------------------------------ mobile sheet ---------------------------- */}
      {mobileOpen && (
        <div className="animate-fade fixed inset-x-0 top-16 bottom-0 z-40 overflow-y-auto bg-ground md:hidden">
          <div className="px-5 py-6">
            <nav className="flex flex-col" aria-label={d.nav.openMenu}>
              {nav.map((section, index) => (
                <div key={section.id} className="border-b border-line py-4 first:pt-0">
                  <Link href={section.href} className="flex items-baseline gap-3">
                    <span className="font-mono text-[11px] tabular-nums text-accent">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="font-display text-xl font-extrabold tracking-tight text-ink">{section.label}</span>
                  </Link>
                  {section.groups?.[0] && (
                    <div className="mt-3 flex flex-col gap-1 pl-8">
                      {section.groups
                        .flatMap((group) => group.links)
                        .map((link) => (
                          <Link key={link.href} href={link.href} className="py-1.5 text-[15px] text-ink-3">
                            {link.label}
                          </Link>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>

            <div className="mt-6 flex flex-col gap-2">
              {user ? (
                <ButtonLink href={path("/app", locale)} size="lg" full>
                  {d.nav.dashboard}
                </ButtonLink>
              ) : (
                <>
                  <ButtonLink href={path("/register", locale)} size="lg" full>
                    {d.nav.register}
                  </ButtonLink>
                  <ButtonLink href={path("/login", locale)} variant="secondary" size="lg" full>
                    {d.nav.login}
                  </ButtonLink>
                </>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-line pt-5">
              <LanguageMenu locale={locale} label={d.nav.language} />
              <ThemeToggle
                labels={{
                  theme: d.nav.theme,
                  light: d.nav.themeLight,
                  dark: d.nav.themeDark,
                  system: d.nav.themeSystem,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
