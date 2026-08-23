import type { Dictionary } from "@/lib/i18n";
import { path, type Locale } from "@/lib/i18n/config";

export interface NavLink {
  label: string;
  href: string;
  note?: string;
}

export interface NavSection {
  id: string;
  label: string;
  href: string;
  /** A section with children opens a panel; without, it is a plain link. */
  groups?: { title: string; links: NavLink[] }[];
  feature?: { eyebrow: string; title: string; body: string; href: string; cta: string };
}

/**
 * Four entrances instead of eleven. Everything the old header exposed still
 * has a home — one level down, inside the entrance it belongs to.
 */
export function buildNav(d: Dictionary, locale: Locale): NavSection[] {
  const p = (href: string) => path(href, locale);

  return [
    {
      id: "learn",
      label: d.nav.learn,
      href: p("/learn"),
      groups: [
        {
          title: d.learn.title,
          links: [
            { label: d.nav.catalog, href: p("/learn"), note: d.learn.body },
            { label: d.nav.path, href: p("/learn/path"), note: d.plans.accessNote },
            { label: d.nav.bundles, href: p("/learn?tab=bundles"), note: d.learn.inBundles },
            { label: d.nav.accelerator, href: p("/learn/ai-insider-accelerator"), note: d.learn.apply },
          ],
        },
      ],
      feature: {
        eyebrow: d.learn.firstLessonFree,
        title: d.home.coursesTitle,
        body: d.home.coursesBody,
        href: p("/learn?tab=free"),
        cta: d.learn.startFree,
      },
    },
    {
      id: "store",
      label: d.nav.store,
      href: p("/store"),
      groups: [
        {
          title: d.store.title,
          links: [
            { label: d.store.featured, href: p("/store"), note: d.store.body },
            { label: d.store.newArrivals, href: p("/store?badge=new") },
            { label: d.store.bestSellers, href: p("/store?sort=rating") },
            { label: d.nav.vault, href: p("/store?collection=vault") },
            { label: d.nav.creators, href: p("/store/creators") },
          ],
        },
      ],
      feature: {
        eyebrow: d.store.dropOfWeek,
        title: d.home.storeTitle,
        body: d.home.storeBody,
        href: p("/store?badge=trending"),
        cta: d.common.showAll,
      },
    },
    {
      id: "plans",
      label: d.nav.plans,
      href: p("/plans"),
    },
    {
      id: "community",
      label: d.nav.community,
      href: p("/community/forum"),
      groups: [
        {
          title: d.community.title,
          links: [
            { label: d.nav.forum, href: p("/community/forum"), note: d.community.forumBody },
            { label: d.nav.events, href: p("/community/events"), note: d.community.eventsBody },
            { label: d.nav.giveaways, href: p("/community/giveaways"), note: d.community.giveawaysBody },
            { label: d.nav.blog, href: p("/community/blog"), note: d.community.blogBody },
          ],
        },
      ],
    },
  ];
}

export interface AppNavItem {
  label: string;
  href: string;
  icon: string;
}

/** Private-area sidebar. Order follows how often a task is actually done. */
export function buildAppNav(d: Dictionary, locale: Locale): { title: string; items: AppNavItem[] }[] {
  const p = (href: string) => path(href, locale);
  return [
    {
      title: d.app.learning,
      items: [
        { label: d.app.today, href: p("/app"), icon: "sun" },
        { label: d.app.learning, href: p("/app/learning"), icon: "graduation" },
        { label: d.app.homework, href: p("/app/homework"), icon: "clipboard" },
        { label: d.app.achievements, href: p("/app/achievements"), icon: "award" },
      ],
    },
    {
      title: d.app.library,
      items: [
        { label: d.app.library, href: p("/app/library"), icon: "folder" },
        { label: d.app.orders, href: p("/app/orders"), icon: "receipt" },
      ],
    },
    {
      title: d.community.title,
      items: [
        { label: d.app.team, href: p("/app/team"), icon: "users" },
        { label: d.app.referrals, href: p("/app/referrals"), icon: "gift" },
        { label: d.app.support, href: p("/app/support"), icon: "lifebuoy" },
      ],
    },
  ];
}
