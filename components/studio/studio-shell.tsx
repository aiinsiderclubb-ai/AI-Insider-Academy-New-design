"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BookOpen,
  ExternalLink,
  FileText,
  Inbox,
  LogOut,
  Menu,
  Package,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { BrandMark } from "@/components/layout/brand";
import { Badge } from "@/components/primitives/badge";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import type { Dictionary } from "@/lib/i18n";
import { path, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ElementType> = {
  pulse: Activity,
  queue: Inbox,
  learners: Users,
  revenue: Wallet,
  courses: BookOpen,
  store: Package,
  growth: Sparkles,
  content: FileText,
  ops: ShieldCheck,
};

export interface StudioNavItem {
  id: string;
  label: string;
  href: string;
  badge?: number;
}

export function StudioShell({
  locale,
  d,
  groups,
  role,
  onSignOut,
  children,
}: {
  locale: Locale;
  d: Dictionary;
  groups: { title: string; items: StudioNavItem[] }[];
  role: string;
  onSignOut: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) =>
    href.endsWith("/studio") ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const nav = (
    <nav className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-5" aria-label={d.app.studio}>
      {groups.map((group) => (
        <div key={group.title}>
          <p className="eyebrow mb-2 px-2.5">{group.title}</p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const Icon = ICONS[item.id] ?? Activity;
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                      active ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-2 hover:bg-surface-3 hover:text-ink",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.badge ? (
                      <span className="rounded-full bg-accent px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-on-accent">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="mt-auto flex flex-col gap-1 border-t border-line pt-4">
        <Link
          href={path("/", locale)}
          className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          {d.nav.backToSite}
        </Link>
        <form action={onSignOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] text-danger transition-colors hover:bg-danger-soft"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            {d.nav.signOut}
          </button>
        </form>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-dvh bg-ground">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-line bg-surface-inset lg:flex">
        <div className="flex h-14 items-center gap-2.5 border-b border-line px-4">
          <BrandMark size={22} />
          <span className="font-mono text-[12px] tracking-[0.18em] text-ink uppercase">Studio</span>
        </div>
        {nav}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-line bg-[color-mix(in_oklab,var(--ground)_88%,transparent)] px-4 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={d.nav.openMenu}
            className="-ml-1 flex h-9 w-9 items-center justify-center rounded-md text-ink hover:bg-surface-3 lg:hidden"
          >
            <Menu className="h-4.5 w-4.5" aria-hidden />
          </button>
          <span className="font-mono text-[12px] tracking-[0.18em] text-muted uppercase lg:hidden">Studio</span>

          <div className="flex-1" />

          <Badge tone={role === "admin" ? "accent" : "neutral"}>{role}</Badge>
          <ThemeToggle
            labels={{ theme: d.nav.theme, light: d.nav.themeLight, dark: d.nav.themeDark, system: d.nav.themeSystem }}
          />
        </header>

        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={d.nav.closeMenu}
            onClick={() => setOpen(false)}
            className="animate-fade absolute inset-0 bg-[rgb(23_19_15/0.45)] backdrop-blur-[2px]"
          />
          <div className="animate-pop absolute inset-y-0 left-0 flex w-64 flex-col border-r border-line bg-surface">
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <span className="font-mono text-[12px] tracking-[0.18em] text-ink uppercase">Studio</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={d.nav.closeMenu}
                className="rounded-md p-1.5 text-faint hover:bg-surface-3 hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            {nav}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== page scaffold ============================== */

export function StudioPage({
  title,
  body,
  action,
  children,
}: {
  title: React.ReactNode;
  body?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-7 sm:px-6">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-[clamp(1.4rem,2.6vw,2rem)] leading-tight tracking-[-0.03em]">{title}</h1>
          {body && <p className="mt-2 text-[14px] leading-relaxed text-ink-3">{body}</p>}
        </div>
        {action}
      </header>
      {children}
    </div>
  );
}
