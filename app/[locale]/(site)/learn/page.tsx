import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { CourseCard } from "@/components/catalog/course-card";
import { BundleCard, VaultCard } from "@/components/catalog/bundle-card";
import { FilterBar, type FilterGroup } from "@/components/catalog/filter-bar";
import { Breadcrumbs } from "@/components/primitives/navigation";
import { Reveal, RevealGroup } from "@/components/motion/reveal";
import { ButtonLink } from "@/components/primitives/button";
import { Container, SectionHead } from "@/components/primitives/surface";
import { EmptyState, Note } from "@/components/primitives/states";
import { Stat } from "@/components/primitives/badge";
import { courseBundles, vaultBundle, vaultHub, vaultProducts } from "@/content/catalog";
import { pick } from "@/content/locale";
import { difficultyFilters } from "@/content/site";
import { getCourses, groupCourses, type Course } from "@/lib/api/catalog";
import { formatPrice, getDictionary, path, resultCount, type Locale } from "@/lib/i18n";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const d = getDictionary(locale);
  return { title: d.learn.title, description: d.learn.body };
}

type Search = { tab?: string; track?: string; level?: string };

const TABS = ["all", "paid", "free", "bundles", "vault", "intake"] as const;
type Tab = (typeof TABS)[number];

export default async function LearnPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const query = await searchParams;
  const d = getDictionary(locale);

  const courses = await getCourses(locale);
  const groups = groupCourses(courses);

  const tab: Tab = (TABS as readonly string[]).includes(query.tab ?? "") ? (query.tab as Tab) : "all";

  const tracks = Array.from(new Set(courses.map((course) => course.categoryLabel)));

  const matchesFilters = (course: Course) => {
    if (query.track && course.categoryLabel !== query.track) return false;
    if (query.level === "free" && !course.isFree) return false;
    if (query.level && query.level !== "free" && String(course.difficulty) !== query.level) return false;
    return true;
  };

  const filterGroups: FilterGroup[] = [
    {
      key: "tab",
      label: d.learn.title,
      options: [
        { value: "all", label: d.learn.tabAll, count: courses.length },
        { value: "paid", label: d.learn.tabPaid, count: groups.paid.length },
        { value: "free", label: d.learn.tabFree, count: groups.free.length },
        { value: "bundles", label: d.learn.tabBundles, count: courseBundles.length },
        { value: "vault", label: d.learn.tabVault, count: vaultProducts.length },
        { value: "intake", label: d.learn.tabIntake, count: groups.intake.length },
      ],
    },
    {
      key: "track",
      label: d.learn.filterTrack,
      options: [
        { value: "all", label: d.common.all },
        ...tracks.map((track) => ({
          value: track,
          label: track,
          count: courses.filter((course) => course.categoryLabel === track).length,
        })),
      ],
    },
    {
      key: "level",
      label: d.learn.filterLevel,
      options: difficultyFilters.map((filter) => ({
        value: filter.id === "all" ? "all" : filter.id,
        label: pick(locale, filter.ru, filter.en),
      })),
    },
  ];

  const showCourses = tab === "all" || tab === "paid" || tab === "free" || tab === "intake";
  const paid = groups.paid.filter(matchesFilters);
  const free = groups.free.filter(matchesFilters);
  const intake = groups.intake.filter(matchesFilters);
  const soon = groups.soon.filter(matchesFilters);

  const visibleCount =
    tab === "paid" ? paid.length : tab === "free" ? free.length : tab === "intake" ? intake.length : paid.length + free.length + intake.length;

  return (
    <>
      <Container size="wide" className="pt-8 pb-10">
        <Breadcrumbs
          label={d.common.breadcrumb}
          items={[{ label: d.brand.name, href: path("/", locale) }, { label: d.learn.title }]}
        />

        <div className="mt-7 grid gap-x-14 gap-y-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Reveal>
            <p className="eyebrow">{d.learn.subtitle}</p>
            <h1 className="mt-5 text-[clamp(2.25rem,5.4vw,3.75rem)] leading-[0.98] tracking-[-0.04em]">
              {d.learn.title}
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-2">{d.learn.body}</p>
          </Reveal>

          <RevealGroup step={70} as="dl" className="grid grid-cols-2 gap-x-6 gap-y-6 self-end sm:grid-cols-4 lg:grid-cols-2">
            <Stat value={courses.length} label={d.home.statsCourses} />
            <Stat value={courses.reduce((sum, course) => sum + course.lessonCount, 0)} label={d.home.statsLessons} />
            <Stat value={courseBundles.length} label={d.nav.bundles} />
            <Stat value={vaultProducts.length} label={d.nav.vault} />
          </RevealGroup>
        </div>
      </Container>

      <Container size="wide" className="pb-10">
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-xs">
          <FilterBar groups={filterGroups} resetLabel={d.common.clearFilters} />
        </div>
        {showCourses && (
          <p className="mt-4 text-[13px] text-muted tabular-nums">{resultCount(visibleCount, locale, d)}</p>
        )}
      </Container>

      {/* ------------------------------- paid ------------------------------- */}
      {(tab === "all" || tab === "paid") && (
        <Container size="wide" className="pb-16">
          <Reveal>
            <SectionHead
              eyebrow={d.learn.tabPaid}
              title={d.home.coursesTitle}
              body={d.home.coursesBody}
              as="h2"
            />
          </Reveal>

          {paid.length ? (
            <RevealGroup step={60} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {paid.map((course, index) => (
                <CourseCard key={course.id} course={course} locale={locale} d={d} priority={index < 3} />
              ))}
            </RevealGroup>
          ) : (
            <EmptyState
              title={d.store.emptyTitle}
              body={d.store.emptyBody}
              action={
                <ButtonLink href={path("/learn", locale)} size="sm">
                  {d.common.clearFilters}
                </ButtonLink>
              }
            />
          )}
        </Container>
      )}

      {/* ------------------------------- free ------------------------------- */}
      {(tab === "all" || tab === "free") && free.length > 0 && (
        <Container size="wide" className="pb-16">
          <Reveal>
            <SectionHead
              eyebrow={d.learn.tabFree}
              title={pick(locale, "Начните без оплаты", "Start without paying")}
              body={pick(
                locale,
                "Три программы открываются сразу после регистрации — с домашними заданиями и прогрессом.",
                "Three programmes open the moment you register — assignments and progress included.",
              )}
              as="h2"
            />
          </Reveal>
          <RevealGroup step={60} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {free.map((course) => (
              <CourseCard key={course.id} course={course} locale={locale} d={d} />
            ))}
          </RevealGroup>
        </Container>
      )}

      {/* ------------------------------ intake ------------------------------ */}
      {(tab === "all" || tab === "intake") && intake.length > 0 && (
        <Container size="wide" className="pb-16">
          <Reveal>
            <SectionHead
              eyebrow={d.learn.tabIntake}
              title={pick(locale, "Открытый набор", "Open intake")}
              body={pick(
                locale,
                "Анкета, отборочный тест и выбор специализации — чтобы не гадать, с чего начинать.",
                "An application, an intake test and a specialisation choice — so you don't have to guess where to start.",
              )}
              as="h2"
            />
          </Reveal>
          <RevealGroup step={60} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {intake.map((course) => (
              <CourseCard key={course.id} course={course} locale={locale} d={d} />
            ))}
          </RevealGroup>
        </Container>
      )}

      {/* ------------------------------ bundles ----------------------------- */}
      {(tab === "all" || tab === "bundles") && (
        <Container size="wide" className="pb-16">
          <Reveal>
            <SectionHead
              eyebrow={d.nav.bundles}
              title={pick(locale, "Пакеты со скидкой", "Discounted bundles")}
              body={pick(
                locale,
                "Несколько программ одним платежом плюс бонусные материалы под конкретный результат.",
                "Several programmes in one payment, plus bonus material aimed at a specific outcome.",
              )}
              as="h2"
            />
          </Reveal>
          <RevealGroup step={80} className="grid gap-4 lg:grid-cols-3">
            {courseBundles.map((bundle, index) => (
              <BundleCard key={bundle.id} bundle={bundle} locale={locale} d={d} featured={index === 1} />
            ))}
          </RevealGroup>
        </Container>
      )}

      {/* ------------------------------- vault ------------------------------ */}
      {(tab === "all" || tab === "vault") && (
        <Container size="wide" className="pb-20">
          <Reveal>
            <SectionHead
              eyebrow={d.nav.vault}
              title={pick(locale, vaultHub.titleRu, vaultHub.titleEn)}
              body={pick(locale, vaultHub.leadRu, vaultHub.leadEn)}
              as="h2"
              action={
                <ButtonLink href={path("/store?collection=vault", locale)} variant="ghost" size="sm">
                  {d.common.showAll}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </ButtonLink>
              }
            />
          </Reveal>

          <div className="mb-5 grid gap-4 rounded-lg border border-line bg-surface p-6 shadow-xs sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-center">
            {vaultHub.stats.map((stat) => (
              <Stat key={stat.value} value={stat.value} label={pick(locale, stat.labelRu, stat.labelEn)} />
            ))}
            <div className="rounded-md border border-accent/40 bg-accent-soft p-4 lg:min-w-56">
              <p className="text-[13px] font-medium text-ink">{pick(locale, vaultBundle.titleRu, vaultBundle.titleEn)}</p>
              <p className="mt-1.5 flex items-baseline gap-2">
                <span className="font-mono text-[18px] font-medium tabular-nums text-ink">
                  {formatPrice(vaultBundle.priceEur, locale)}
                </span>
                <span className="font-mono text-[12px] text-muted line-through tabular-nums">
                  {formatPrice(vaultBundle.oldPriceEur, locale)}
                </span>
              </p>
            </div>
          </div>

          <RevealGroup step={60} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vaultProducts.map((product) => (
              <VaultCard key={product.id} product={product} locale={locale} d={d} />
            ))}
          </RevealGroup>
        </Container>
      )}

      {/* -------------------------------- soon ------------------------------ */}
      {tab === "all" && soon.length > 0 && (
        <Container size="wide" className="pb-20">
          <Reveal>
            <SectionHead
              eyebrow={d.badges.soon}
              title={pick(locale, "Готовим к выпуску", "In production")}
              body={pick(
                locale,
                "Программы в записи и на монтаже. Оставьте почту — сообщим в день выхода.",
                "Recorded and in the edit. Leave your email and we will tell you on release day.",
              )}
              as="h2"
            />
          </Reveal>
          <RevealGroup step={60} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {soon.map((course) => (
              <CourseCard key={course.id} course={course} locale={locale} d={d} />
            ))}
          </RevealGroup>
          <Note className="mt-6">{d.plans.oneTimeNote}</Note>
        </Container>
      )}
    </>
  );
}
