import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Brand } from "@/components/layout/brand";
import { OnboardingWizard, type Recommendation, type TrackId } from "@/components/onboarding/onboarding-wizard";
import { links } from "@/content/site";
import { getCourses } from "@/lib/api/catalog";
import { getStoreCatalog } from "@/lib/api/store";
import { getMe } from "@/lib/api/session";
import { formatPrice, getDictionary, path, type Locale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false } };

/** Which course and store item each track points at. */
const TRACK_MAP: Record<TrackId, { course: string; product: string }> = {
  agents: { course: "ai-agent-engineer", product: "multi-agent-ops-team" },
  automation: { course: "ai-automation-engineer", product: "lead-generation-workflow" },
  content: { course: "ai-content-creator", product: "viral-hooks-database" },
  business: { course: "ai-business-builder", product: "agency-proposal-template" },
};

export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const me = await getMe();
  if (!me) redirect(path("/login", locale));

  const [courses, catalog] = await Promise.all([getCourses(locale), getStoreCatalog(locale)]);

  const recommendations = Object.fromEntries(
    (Object.keys(TRACK_MAP) as TrackId[]).map((track) => {
      const course = courses.find((item) => item.id === TRACK_MAP[track].course);
      const product = catalog.products.find((item) => item.slug === TRACK_MAP[track].product);
      if (!course) return [track, null];
      return [
        track,
        {
          courseSlug: course.slug,
          courseTitle: course.title,
          courseSummary: course.description || course.summary,
          productSlug: product?.slug,
          productTitle: product?.title,
          productSummary: product?.summary,
          productPrice: product ? formatPrice(product.priceEur, locale) : undefined,
        } satisfies Recommendation,
      ];
    }),
  ) as Record<TrackId, Recommendation | null>;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center px-5 sm:px-8">
        <Brand href={path("/app", locale)} name={d.brand.name} sub={d.brand.sub} />
      </header>
      <main id="main" className="flex flex-1 items-center px-5 py-10 sm:px-8">
        <OnboardingWizard
          locale={locale}
          d={d}
          recommendations={recommendations}
          telegramUrl={links.telegramCommunity}
        />
      </main>
    </div>
  );
}
