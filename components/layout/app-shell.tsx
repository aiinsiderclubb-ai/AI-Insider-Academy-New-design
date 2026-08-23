"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Award,
  Bell,
  ClipboardList,
  ExternalLink,
  Folder,
  Gift,
  GraduationCap,
  LifeBuoy,
  LogOut,
  Menu,
  Receipt,
  Search,
  Settings,
  Sun,
  Users,
  X,
} from "lucide-react";
import { Brand } from "./brand";
import { LanguageMenu } from "./language-menu";
import { ThemeToggle } from "./theme-toggle";
import type { AppNavItem } from "./nav-model";
import { Avatar } from "@/components/primitives/display";
import { Badge } from "@/components/primitives/badge";
import { MenuItem, MenuSeparator, Popover } from "@/components/primitives/overlay";
import type { Dictionary } from "@/lib/i18n";
import { path, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ElementType> = {
  sun: Sun,
  graduation: GraduationCap,
  clipboard: ClipboardList,
  award: Award,
  folder: Folder,
  receipt: Receipt,
  users: Users,
  gift: Gift,
  lifebuoy: LifeBuoy,
};

export interface AppUser {
  name: string;
  email: string;
  avatarUrl?: string | null;
  personalId?: string;
  tier: "free" | "club" | "pro";
}

export function AppShell({
  locale,
  d,
  groups,
  user,
  unread,
  onSignOut,
  children,
}: {
  locale: Locale;
  d: Dictionary;
  groups: { title: string; items: AppNavItem[] }[];
  user: AppUser;
  unread: number;
  /** Server action that clears the session cookie. */
  onSignOut: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => setMobileOpen(false), [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const flat = groups.flatMap((group) => group.items);
  const primary = flat.slice(0, 4);

  const sidebar = (
    <nav className="flex h-full flex-col gap-7 overflow-y-auto px-4 py-6" aria-label={d.nav.dashboard}>
      {groups.map((group) => (
        <div key={group.title}>
          <p className="eyebrow mb-2 px-2.5">{group.title}</p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const Icon = ICONS[item.icon] ?? Folder;
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] transition-colors",
                      active ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-2 hover:bg-surface-3 hover:text-ink",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
        <Link
          href={path("/", locale)}
          className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          {d.nav.backToSite}
        </Link>
        <Link
          href={path("/app/settings", locale)}
          className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
        >
          <Settings className="h-4 w-4" aria-hidden />
          {d.app.settings}
        </Link>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-ground lg:flex-row">
      {/* ------------------------------- sidebar ------------------------------- */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface-2 lg:flex">
        <div className="flex h-16 items-center border-b border-line px-4">
          <Brand href={path("/app", locale)} name={d.brand.name} sub={d.brand.sub} />
        </div>
        {sidebar}
      </aside>

      {/* -------------------------------- main --------------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-line bg-[color-mix(in_oklab,var(--ground)_88%,transparent)] px-4 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label={d.nav.openMenu}
            className="-ml-1 flex h-10 w-10 items-center justify-center rounded-md text-ink transition-colors hover:bg-surface-3 lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>

          <div className="lg:hidden">
            <Brand href={path("/app", locale)} name={d.brand.name} sub={d.brand.sub} compact />
          </div>

          <div className="flex-1" />

          <Link
            href={path("/store", locale)}
            aria-label={d.nav.search}
            className="flex h-9 w-9 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <Search className="h-4 w-4" aria-hidden />
          </Link>

          <Link
            href={path("/app?panel=notifications", locale)}
            aria-label={`${d.nav.notifications}${unread ? ` (${unread})` : ""}`}
            className="relative flex h-9 w-9 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <Bell className="h-4 w-4" aria-hidden />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent ring-2 ring-[var(--ground)]" />
            )}
          </Link>

          <LanguageMenu locale={locale} label={d.nav.language} />
          <ThemeToggle
            labels={{ theme: d.nav.theme, light: d.nav.themeLight, dark: d.nav.themeDark, system: d.nav.themeSystem }}
          />

          <Popover
            label={d.nav.account}
            trigger={({ open, toggle, ref }) => (
              <button
                ref={ref}
                type="button"
                onClick={toggle}
                aria-expanded={open}
                aria-label={d.nav.account}
                className={cn(
                  "ml-1 flex items-center gap-2 rounded-md border border-line bg-surface py-1 pr-2.5 pl-1 transition-colors hover:border-line-2",
                  open && "border-line-2",
                )}
              >
                <Avatar name={user.name} src={user.avatarUrl} size={26} />
                <span className="hidden max-w-28 truncate text-[13px] font-medium text-ink sm:inline">{user.name}</span>
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="px-2.5 py-2">
                  <p className="truncate text-[13.5px] font-semibold text-ink">{user.name}</p>
                  <p className="truncate text-[12px] text-muted">{user.email}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge tone={user.tier === "pro" ? "accent" : user.tier === "club" ? "success" : "neutral"}>
                      {user.tier === "free" ? d.plans.title : user.tier}
                    </Badge>
                    {user.personalId && (
                      <span className="font-mono text-2xs tracking-[0.08em] text-faint">{user.personalId}</span>
                    )}
                  </div>
                </div>
                <MenuSeparator />
                <MenuItem onClick={() => { close(); router.push(path("/app/settings", locale)); }}>
                  <Settings className="h-4 w-4" aria-hidden />
                  {d.app.settings}
                </MenuItem>
                <MenuItem onClick={() => { close(); router.push(path("/app/orders", locale)); }}>
                  <Receipt className="h-4 w-4" aria-hidden />
                  {d.app.orders}
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  onClick={() => {
                    close();
                    void onSignOut();
                  }}
                  className="text-danger hover:bg-danger-soft hover:text-danger"
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  {d.nav.signOut}
                </MenuItem>
              </>
            )}
          </Popover>
        </header>

        <main id="main" className="min-w-0 flex-1 pb-20 lg:pb-0">
          {children}
        </main>
      </div>

      {/* --------------------------- mobile drawer ----------------------------- */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={d.nav.closeMenu}
            onClick={() => setMobileOpen(false)}
            className="animate-fade absolute inset-0 bg-[rgb(23_19_15/0.45)] backdrop-blur-[2px]"
          />
          <div className="animate-pop absolute inset-y-0 left-0 flex w-72 flex-col border-r border-line bg-surface">
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <Brand href={path("/app", locale)} name={d.brand.name} sub={d.brand.sub} />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label={d.nav.closeMenu}
                className="rounded-md p-2 text-faint hover:bg-surface-3 hover:text-ink"
              >
                <X className="h-4.5 w-4.5" aria-hidden />
              </button>
            </div>
            {sidebar}
          </div>
        </div>
      )}

      {/* ---------------------------- mobile tab bar --------------------------- */}
      <nav
        aria-label={d.nav.dashboard}
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-[color-mix(in_oklab,var(--surface)_92%,transparent)] backdrop-blur-xl lg:hidden"
      >
        {primary.map((item) => {
          const Icon = ICONS[item.icon] ?? Folder;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors",
                active ? "text-accent-ink" : "text-muted",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span className="max-w-full truncate px-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
