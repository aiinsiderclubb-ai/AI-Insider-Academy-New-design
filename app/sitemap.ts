import type { MetadataRoute } from "next";
import { locales, defaultLocale, type Locale } from "@/lib/i18n/config";
import { resolveSiteUrl } from "@/lib/api/origin";
import { legalSlugs } from "@/content/legal";
import { courseBundles } from "@/content/catalog";
import { giveawayList } from "@/content/community";
import { creatorList } from "@/content/site";
import { getCourses } from "@/lib/api/catalog";
import { getStoreCatalog } from "@/lib/api/store";
import { getAllBlogPosts } from "@/lib/api/public";

const SITE = resolveSiteUrl();

/** Every public route, in every locale, with hreflang alternates. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [courses, catalog, posts] = await Promise.all([
    getCourses(defaultLocale),
    getStoreCatalog(defaultLocale),
    getAllBlogPosts(defaultLocale),
  ]);

  const staticPaths = [
    { path: "", priority: 1, changeFrequency: "weekly" as const },
    { path: "/learn", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/learn/path", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/store", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/store/creators", priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/store/tools", priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/plans", priority: 0.85, changeFrequency: "monthly" as const },
    { path: "/community/forum", priority: 0.7, changeFrequency: "daily" as const },
    { path: "/community/events", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/community/giveaways", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/community/blog", priority: 0.8, changeFrequency: "weekly" as const },
  ];

  const dynamicPaths = [
    ...courses.map((course) => ({ path: `/learn/${course.slug}`, priority: 0.8, changeFrequency: "weekly" as const })),
    ...courseBundles.map((bundle) => ({ path: `/learn/bundles/${bundle.id}`, priority: 0.7, changeFrequency: "monthly" as const })),
    ...catalog.products.map((product) => ({ path: `/store/${product.slug}`, priority: 0.75, changeFrequency: "weekly" as const })),
    ...creatorList.map((creator) => ({ path: `/store/creators/${creator.slug}`, priority: 0.5, changeFrequency: "monthly" as const })),
    ...giveawayList.map((giveaway) => ({ path: `/community/giveaways/${giveaway.slug}`, priority: 0.6, changeFrequency: "weekly" as const })),
    ...posts.map((post) => ({ path: `/community/blog/${post.slug}`, priority: 0.65, changeFrequency: "monthly" as const, lastModified: post.date })),
    ...legalSlugs.map((slug) => ({ path: `/legal/${slug}`, priority: 0.3, changeFrequency: "yearly" as const })),
  ];

  const all: { path: string; priority: number; changeFrequency: "weekly" | "daily" | "monthly" | "yearly"; lastModified?: string }[] =
    [...staticPaths, ...dynamicPaths];

  return all.flatMap((entry) =>
    locales.map((locale: Locale) => ({
      url: `${SITE}/${locale}${entry.path}`,
      priority: entry.priority,
      changeFrequency: entry.changeFrequency,
      lastModified: entry.lastModified ? new Date(entry.lastModified) : undefined,
      alternates: {
        languages: Object.fromEntries(
          locales.map((alt) => [alt === "ukr" ? "uk" : alt, `${SITE}/${alt}${entry.path}`]),
        ),
      },
    })),
  );
}
