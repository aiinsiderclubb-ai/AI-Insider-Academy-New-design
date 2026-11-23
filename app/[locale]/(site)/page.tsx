import { ArrowRight } from "lucide-react";
import { Hero } from "@/components/home/hero";
import { Journey } from "@/components/motion/journey";
import { Marquee } from "@/components/motion/marquee";
import { Reveal, RevealGroup } from "@/components/motion/reveal";
import { Access, Closing, Entrances, Reviews, type AccessOption } from "@/components/home/sections";
import { CourseCard } from "@/components/catalog/course-card";
import { ProductCard } from "@/components/store/product-card";
import { ButtonLink } from "@/components/primitives/button";
import { Container, SectionHead } from "@/components/primitives/surface";
import { courseBundles } from "@/content/catalog";
import { pick } from "@/content/locale";
import { planByTier } from "@/content/plans";
import { getCourses, groupCourses } from "@/lib/api/catalog";
import { getStoreCatalog } from "@/lib/api/store";
import { getReviews } from "@/lib/api/public";
import { storeCategories } from "@/content/store";
import { formatPrice, getDictionary, locales, path, type Locale } from "@/lib/i18n";
import { coursesPublic } from "@/lib/visibility";

export const revalidate = 300;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);
  // Before launch (lib/visibility.ts) the page keeps to the store and the
  // community: no programmes, prices, reviews of courses or course counts.
  const open = coursesPublic();

  const [courses, catalog, reviews] = await Promise.all([
    getCourses(locale),
    getStoreCatalog(locale),
    getReviews(locale),
  ]);

  const groups = groupCourses(courses);
  const paidPrices = groups.paid.flatMap((course) => [course.priceEur, course.mentorPriceEur]).filter(Boolean);
  const cheapestBundle = [...courseBundles].sort((a, b) => a.priceEur - b.priceEur)[0];
  const club = planByTier("club");

  const totalLessons = courses.reduce((sum, course) => sum + course.lessonCount, 0);

  const accessOptions: AccessOption[] = [
    {
      kicker: pick(locale, "Точечно", "One course"),
      title: pick(locale, "Отдельный курс", "A single course"),
      price: `${Math.min(...paidPrices)}–${Math.max(...paidPrices)} €`,
      priceNote: d.common.forever,
      points: [
        pick(locale, "Все уроки и материалы курса", "Every lesson and resource in the course"),
        pick(locale, "Домашние задания: самопроверка или проверка ментором", "Assignments: self-check or mentor review"),
        pick(locale, "Именной сертификат", "A named certificate"),
      ],
      footnote: pick(
        locale,
        "Два тарифа: самостоятельно или с ментором — с проверкой заданий, примерно вдвое дороже.",
        "Two plans: on your own, or with a mentor who reviews your work — about twice the price.",
      ),
      href: path("/learn", locale),
      cta: d.home.heroPrimary,
    },
    {
      kicker: pick(locale, "Выгодно", "Best value"),
      title: pick(locale, "Пакет программ", "A bundle"),
      price: formatPrice(cheapestBundle?.priceEur ?? 69, locale),
      priceNote: `${d.common.from} · ${d.common.forever}`,
      points: [
        pick(locale, "Несколько курсов одним платежом", "Several courses in one payment"),
        pick(locale, "Бонусные материалы пакета", "Bundle bonus materials"),
        pick(locale, "Доступ остаётся навсегда", "Access stays yours for good"),
      ],
      footnote: pick(
        locale,
        "Три набора под конкретный результат: контент, фриланс и агентство.",
        "Three sets aimed at a specific outcome: content, freelancing and agency work.",
      ),
      href: path("/learn?tab=bundles", locale),
      cta: d.learn.inBundles,
      featured: true,
    },
    {
      kicker: pick(locale, "Гибко", "Flexible"),
      title: pick(locale, "Подписка Club", "Club subscription"),
      price: formatPrice(club?.priceEur ?? 59, locale),
      priceNote: d.common.perMonth,
      points: [
        pick(locale, "Курсы Academy, пока подписка активна", "Academy courses while the subscription runs"),
        pick(locale, "Новое сразу после выхода", "New material the day it ships"),
        pick(locale, "Скидка в магазине", "A discount in the store"),
      ],
      footnote: d.plans.oneTimeNote,
      href: path("/plans", locale),
      cta: d.plans.compare,
    },
  ];

  const featuredProducts = catalog.products.filter((product) => product.available).slice(0, 4);

  const stops = [
    { id: "start", label: pick(locale, "Начало", "Start") },
    { id: "entrances", label: pick(locale, "Четыре входа", "Four entrances") },
    { id: "programmes", label: pick(locale, "Программы", "Programmes") },
    { id: "store", label: pick(locale, "Магазин", "Store") },
    { id: "access", label: pick(locale, "Доступ", "Access") },
    { id: "path", label: pick(locale, "Маршрут", "Route") },
    { id: "voices", label: pick(locale, "Отзывы", "Reviews") },
    { id: "finish", label: pick(locale, "Старт", "Get going") },
  ];

  const visibleStops = open
    ? stops
    : stops.filter((stop) => !["programmes", "access", "path", "voices", "finish"].includes(stop.id));

  const ribbon = storeCategories.map((category) => pick(locale, category.titleRu, category.titleEn));

  return (
    <>
      <Journey
        stops={visibleStops}
        from={pick(locale, "Вопрос", "Question")}
        to={pick(locale, "Результат", "Result")}
        railUntil={open ? "access" : "store"}
      />

      <div id="start" />

      <Hero
        locale={locale}
        d={d}
        prelaunch={!open}
        stats={{
          courses: open ? courses.length : null,
          lessons: open ? totalLessons : null,
          products: catalog.products.length,
          languages: locales.length,
        }}
      />

      <div id="entrances" />
      <Entrances locale={locale} d={d} prelaunch={!open} />

      <Marquee items={ribbon} className="mb-20 sm:mb-28" />

      {open && (
        <Container size="wide" id="programmes" className="pb-20 sm:pb-28">
          <Reveal>
          <SectionHead
            eyebrow={d.learn.tabPaid}
            title={d.home.coursesTitle}
            body={d.home.coursesBody}
            action={
              <ButtonLink href={path("/learn", locale)} variant="ghost" size="sm">
                {d.nav.catalog}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </ButtonLink>
            }
          />
          </Reveal>
          <RevealGroup step={70} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {groups.paid.slice(0, 4).map((course, index) => (
              <CourseCard key={course.id} course={course} locale={locale} d={d} priority={index < 2} />
            ))}
          </RevealGroup>
        </Container>
      )}

      <Container size="wide" id="store">
        <Reveal>
        <SectionHead
          eyebrow={d.store.title}
          title={d.home.storeTitle}
          body={d.home.storeBody}
          action={
            <ButtonLink href={path("/store", locale)} variant="ghost" size="sm">
              {d.common.showAll}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </ButtonLink>
          }
        />
        </Reveal>
        <RevealGroup step={70} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} product={product} locale={locale} d={d} />
          ))}
        </RevealGroup>
      </Container>

      {open && (
        <>
          <div id="access" />
          <Access d={d} options={accessOptions} />

          <div id="voices" />
          <Reviews locale={locale} d={d} reviews={reviews} />

          <div id="finish" />
          <Closing
            locale={locale}
            d={d}
            stats={{ courses: courses.length, lessons: totalLessons, products: catalog.products.length }}
          />
        </>
      )}
    </>
  );
}
