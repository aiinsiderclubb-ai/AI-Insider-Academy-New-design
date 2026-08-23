import { SiteChrome } from "@/components/layout/site-chrome";
import { SiteFooter } from "@/components/layout/site-footer";
import { buildNav } from "@/components/layout/nav-model";
import type { SearchEntry } from "@/components/layout/command-search";
import { getCourses } from "@/lib/api/catalog";
import { getStoreCatalog } from "@/lib/api/store";
import { getSession } from "@/lib/api/session";
import { getDictionary, lessonCount, path, type Locale } from "@/lib/i18n";

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const [courses, catalog, user] = await Promise.all([getCourses(locale), getStoreCatalog(locale), getSession()]);

  const searchEntries: SearchEntry[] = [
    ...courses.map((course) => ({
      id: `course-${course.id}`,
      kind: "course" as const,
      title: course.title,
      note: `${course.categoryLabel} · ${lessonCount(course.lessonCount, locale, d)}`,
      href: path(`/learn/${course.slug}`, locale),
      keywords: `${course.summary} ${course.skills.join(" ")}`,
    })),
    ...catalog.products.map((product) => ({
      id: `product-${product.id}`,
      kind: "product" as const,
      title: product.title,
      note: `${product.categoryLabel} · ${product.priceEur} €`,
      href: path(`/store/${product.slug}`, locale),
      keywords: product.summary,
    })),
    {
      id: "page-plans",
      kind: "page" as const,
      title: d.plans.title,
      note: d.plans.subtitle,
      href: path("/plans", locale),
    },
    {
      id: "page-path",
      kind: "page" as const,
      title: d.nav.path,
      note: d.learn.subtitle,
      href: path("/learn/path", locale),
    },
    {
      id: "page-forum",
      kind: "page" as const,
      title: d.nav.forum,
      note: d.community.forumBody,
      href: path("/community/forum", locale),
    },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteChrome
        locale={locale}
        d={d}
        nav={buildNav(d, locale)}
        user={user ? { name: user.name, avatarUrl: user.avatarUrl } : null}
        searchEntries={searchEntries}
      />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter locale={locale} d={d} />
    </div>
  );
}
