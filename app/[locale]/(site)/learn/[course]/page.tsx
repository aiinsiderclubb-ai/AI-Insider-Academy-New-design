import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowRight, BadgeCheck, Check, Quote, Target } from "lucide-react";
import { Accordion, AccordionItem } from "@/components/primitives/navigation";
import { ButtonLink } from "@/components/primitives/button";
import { ChapterHead } from "@/components/primitives/chapter";
import { Container } from "@/components/primitives/surface";
import { Rating } from "@/components/primitives/display";
import { Note } from "@/components/primitives/states";
import { Reveal, RevealGroup } from "@/components/motion/reveal";
import { Magnetic, Spotlight } from "@/components/motion/pointer";
import { Marquee } from "@/components/motion/marquee";
import { Wipe } from "@/components/motion/wipe";
import { AccessTiers } from "@/components/catalog/access-tiers";
import { CourseBar } from "@/components/catalog/course-bar";
import { CourseHero } from "@/components/catalog/course-hero";
import { Curriculum } from "@/components/catalog/curriculum";
import { DifficultyLadder } from "@/components/catalog/difficulty";
import { BundleCard } from "@/components/catalog/bundle-card";
import { CourseCard } from "@/components/catalog/course-card";
import { bundlesWithCourse, courseFaq, gradingStandard, instructor, profileFor } from "@/content/catalog";
import { courseCover, courseTrailer } from "@/content/covers";
import { pick } from "@/content/locale";
import { getCourse, getCourses } from "@/lib/api/catalog";
import { getCourseReviews } from "@/lib/api/public";
import { getAccess } from "@/lib/api/session";
import { formatDate, formatPrice, getDictionary, path, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; course: string }>;
}): Promise<Metadata> {
  const { locale, course: slug } = await params;
  const course = await getCourse(slug, locale as Locale);
  if (!course) return {};
  return {
    title: course.title,
    description: course.description || course.summary,
    openGraph: { title: course.title, description: course.summary, images: [courseCover(course.image, course.slug) ?? ""] },
  };
}

/**
 * A course, told as a sequence of chapters.
 *
 * The old page stacked eleven bordered panels of the same weight — everything
 * shouted, so nothing did. Here the page changes ground under the reader:
 * dark to open, paper to promise, dark for the syllabus, a warm sheet where
 * money is discussed. Each chapter carries one idea, which is what let the
 * information shrink without anything being dropped.
 */
export default async function CoursePage({
  params,
}: {
  params: Promise<{ locale: string; course: string }>;
}) {
  const { locale: raw, course: slug } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const course = await getCourse(slug, locale);
  if (!course) notFound();

  const [{ reviews, average, count }, access, allCourses] = await Promise.all([
    getCourseReviews(course.id, locale),
    getAccess(),
    getCourses(locale),
  ]);

  const profile = profileFor(course.id);
  const bundles = bundlesWithCourse(course.id);
  const image = courseCover(course.image, course.slug);
  /* The opener's media block crosses into this chapter, so the padding below
     has to know whether there is anything to cross. */
  const hasMedia = Boolean(image || courseTrailer(course.slug));
  const grading = gradingStandard[locale === "en" ? "en" : "ru"];
  const owned = access.courseIds.has(course.id);
  const soon = course.status === "in-development";
  const prerequisites = (pick(locale, profile?.prerequisites, profile?.prerequisitesEn) ?? []) as string[];
  const highlights = (pick(locale, instructor.highlightsRu, instructor.highlights) ?? []) as string[];

  const related = allCourses
    .filter((item) => item.id !== course.id && item.categoryLabel === course.categoryLabel)
    .slice(0, 3);

  /* Only a paid, published course actually offers a choice of tiers. */
  const twoTiers = !owned && !course.isFree && !soon;
  const ribbon = [...course.tools, ...course.skills].filter(Boolean).slice(0, 12);
  const faq = course.faq.length
    ? course.faq
    : courseFaq.map((entry) => ({ q: pick(locale, entry.q, entry.qEn), a: pick(locale, entry.a, entry.aEn) }));

  return (
    <>
      <CourseHero
        course={course}
        locale={locale}
        d={d}
        image={image}
        average={average}
        count={count}
        owned={owned}
      />

      {/* ================================ profile =============================== */}
      <section className={cn("chapter ch-paper", hasMedia && "pt-36 sm:pt-44")}>
        <Container size="wide">
          <div className="grid gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <ChapterHead
                eyebrow={d.learn.aboutCourse}
                lines={pick(
                  locale,
                  ["Насколько сложно", "и кому подойдёт"],
                  ["How hard it is", "and who it suits"],
                )}
                body={course.description || course.summary}
              />
            </div>

            <div>
              <DifficultyLadder
                value={course.difficulty}
                locale={locale}
                heading={pick(locale, "Сложность курса", "Course level")}
              />

              {course.audience.length > 0 && (
                <div className="mt-14">
                  <p className="eyebrow">{d.learn.whoFor}</p>
                  <ul className="mt-6 grid gap-x-10 sm:grid-cols-2">
                    {course.audience.map((item, index) => (
                      <Reveal
                        as="li"
                        key={item}
                        delay={Math.min(index, 6) * 70}
                        className="group flex items-center gap-4 border-t border-line py-4 transition-colors last:border-b sm:last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b"
                      >
                        <Check
                          className="h-4 w-4 shrink-0 text-accent transition-transform duration-300 group-hover:scale-110"
                          aria-hidden
                        />
                        <span className="text-[15px] leading-snug text-ink-2">{item}</span>
                      </Reveal>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </Container>
      </section>

      {/* =============================== syllabus =============================== */}
      <Spotlight as="section" className="chapter ch-ink relative isolate overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(46rem 30rem at 8% 0%, color-mix(in oklab, #ff7a1a 11%, transparent), transparent 62%)",
          }}
        />
        <Container size="wide" className="relative">
          <div id="curriculum" className="grid scroll-mt-24 gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <ChapterHead
                eyebrow={course.durationLabel}
                lines={[d.learn.curriculum]}
                body={
                  course.hasHomework
                    ? pick(
                        locale,
                        "Первый урок открыт всем. Со второго — домашнее задание: следующее видео открывается после проверки.",
                        "The first lesson is open to everyone. From the second on, each lesson carries an assignment and the next video unlocks once it is reviewed.",
                      )
                    : pick(
                        locale,
                        "Записанные уроки без расписания — проходите в своём темпе и возвращайтесь когда нужно.",
                        "Recorded lessons with no schedule — go at your own pace and come back whenever.",
                      )
                }
              />

              {prerequisites.length > 0 && (
                <div className="mt-10 border-t border-line pt-7">
                  <p className="eyebrow">{d.learn.prerequisites}</p>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {prerequisites.map((item) => (
                      <li
                        key={item}
                        className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-[12.5px] text-ink-2"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div>
              <Curriculum course={course} locale={locale} d={d} unlockedUpTo={owned ? course.lessonCount : 0} />

              {course.finalProject && (
                <Reveal>
                  <div className="mt-10 rounded-2xl border border-accent/30 bg-accent-soft p-7">
                    <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-accent-ink uppercase">
                      <Target className="h-3.5 w-3.5" aria-hidden />
                      {d.learn.finalProject}
                    </p>
                    <p className="mt-4 font-display text-[clamp(1.1rem,1.9vw,1.4rem)] leading-snug font-semibold tracking-[-0.02em] text-ink">
                      {course.finalProject}
                    </p>
                    <p className="mt-3 text-[13.5px] leading-relaxed text-ink-3">
                      {pick(
                        locale,
                        "Работа идёт на проверку куратору и остаётся в вашем портфолио.",
                        "The work goes to a curator for review and stays in your portfolio.",
                      )}
                    </p>
                  </div>
                </Reveal>
              )}
            </div>
          </div>
        </Container>

        {ribbon.length > 3 && (
          <Marquee items={ribbon} duration={46} className="relative mt-16 border-x-0" separator="·" />
        )}
      </Spotlight>

      {/* ================================ access ================================ */}
      <section id="access" className="chapter ch-tint scroll-mt-20">
        <Container size="wide">
          <ChapterHead
            eyebrow={pick(locale, "Доступ", "Access")}
            lines={[
              twoTiers
                ? pick(locale, "Два способа пройти курс", "Two ways to take it")
                : owned
                  ? pick(locale, "Курс уже ваш", "Already yours")
                  : pick(locale, "Как начать", "How to start"),
            ]}
            body={
              twoTiers
                ? pick(
                    locale,
                    "Разница только в проверке работ. Материалы, обновления и срок доступа одинаковые.",
                    "The only difference is review. Materials, updates and access length are identical.",
                  )
                : undefined
            }
            className="mb-10"
          />
          <AccessTiers course={course} locale={locale} d={d} owned={owned} />
        </Container>
      </section>

      {/* ============================== assessment ============================== */}
      {course.hasHomework && (
        <section className="chapter ch-paper">
          <Container size="wide">
            <div className="grid gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
              <div>
                <ChapterHead
                  eyebrow={d.learn.certificate}
                  lines={
                    locale === "en"
                      ? ["Reviewed work,", "not watched video"]
                      : ["Проверенная работа,", "а не просмотр"]
                  }
                  body={grading?.title}
                />

                {grading && (
                  <ol className="mt-10 flex flex-col">
                    {grading.levels.map((level, index) => (
                      <Reveal
                        as="li"
                        key={level.name}
                        delay={index * 80}
                        className="flex items-start gap-5 border-t border-line py-5 last:border-b"
                      >
                        <span className="mt-1 flex shrink-0 items-center gap-1" aria-hidden>
                          {[0, 1, 2].map((step) => (
                            <span
                              key={step}
                              className={
                                step <= index ? "h-1.5 w-1.5 rounded-full bg-accent" : "h-1.5 w-1.5 rounded-full bg-line-2"
                              }
                            />
                          ))}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[15.5px] font-semibold text-ink">{level.name}</span>
                          <span className="mt-1 block text-[13.5px] leading-relaxed text-ink-3">{level.desc}</span>
                        </span>
                      </Reveal>
                    ))}
                  </ol>
                )}

                <ul className="mt-8 grid gap-2 sm:grid-cols-2">
                  {[
                    pick(locale, "PDF и запись в личном кабинете", "PDF plus a record in your account"),
                    pick(locale, "Подходит для LinkedIn и резюме", "Fits LinkedIn and a CV"),
                  ].map((item) => (
                    <li key={item} className="flex gap-2.5 text-[13.5px] leading-snug text-ink-2">
                      <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <Wipe className="zoom-host overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-md">
                <div className="relative aspect-[4/3] w-full">
                  <Image
                    src={locale === "en" ? "/certificates/ai-agency-builder-en.png" : "/certificates/ai-content-creator-ru.png"}
                    alt={d.learn.certificate}
                    fill
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className="object-contain p-5"
                  />
                </div>
              </Wipe>
            </div>
          </Container>
        </section>
      )}

      {/* ================================ voices ================================ */}
      <section className="chapter">
        <Container size="wide">
          <div className="grid gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
            <div>
              <ChapterHead
                eyebrow={d.learn.instructor}
                lines={[pick(locale, instructor.nameRu, instructor.name)]}
                body={pick(locale, instructor.bioRu, instructor.bio)}
              />
              <p className="mt-5 text-[13px] text-muted">{pick(locale, instructor.roleRu, instructor.role)}</p>
              {highlights.length > 0 && (
                <ul className="mt-6 flex flex-wrap gap-2">
                  {highlights.map((item) => (
                    <li
                      key={item}
                      className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-[12.5px] text-ink-2"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div id="reviews" className="scroll-mt-24">
              <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-line pb-5">
                <p className="eyebrow">{d.learn.reviews}</p>
                {count > 0 && <Rating value={average} count={count} size={15} />}
              </div>

              {reviews.length ? (
                <RevealGroup step={70} className="grid gap-4 pt-6 sm:grid-cols-2">
                  {reviews.map((review) => (
                    <figure
                      key={review.id}
                      className="flex h-full flex-col rounded-2xl border border-line bg-surface p-6 transition-[transform,border-color] duration-200 ease-[var(--ease-out-quart)] hover:-translate-y-0.5 hover:border-accent/35"
                    >
                      <Quote className="h-5 w-5 text-accent" aria-hidden />
                      <blockquote className="mt-4 flex-1 text-[14.5px] leading-relaxed text-ink-2">{review.text}</blockquote>
                      <figcaption className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4 text-[12.5px]">
                        <span className="font-medium text-ink">{review.author}</span>
                        <span className="tabular-nums text-muted">
                          {formatDate(review.date, locale, { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </figcaption>
                    </figure>
                  ))}
                </RevealGroup>
              ) : (
                <div className="pt-6">
                  <Note tone="neutral">{d.store.noReviews}</Note>
                </div>
              )}
            </div>
          </div>
        </Container>
      </section>

      {/* ================================ further =============================== */}
      {(bundles.length > 0 || related.length > 0) && (
        <section className="chapter ch-paper ch-seam">
          <Container size="wide">
            {bundles.length > 0 && (
              <>
                <ChapterHead
                  eyebrow={d.nav.bundles}
                  lines={[d.learn.inBundles]}
                  body={pick(
                    locale,
                    "Этот курс входит в пакеты со скидкой — можно взять его отдельно или вместе с другими программами.",
                    "This course is part of discounted bundles — take it on its own or together with other programmes.",
                  )}
                  className="mb-10"
                />
                <RevealGroup step={80} className="grid gap-4 lg:grid-cols-3">
                  {bundles.map((bundle, index) => (
                    <BundleCard key={bundle.id} bundle={bundle} locale={locale} d={d} featured={index === 0} />
                  ))}
                </RevealGroup>
              </>
            )}

            {related.length > 0 && (
              <>
                <ChapterHead
                  eyebrow={course.categoryLabel}
                  lines={[d.store.related]}
                  className={bundles.length > 0 ? "mt-20 mb-10" : "mb-10"}
                />
                <RevealGroup step={80} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {related.map((item) => (
                    <CourseCard key={item.id} course={item} locale={locale} d={d} />
                  ))}
                </RevealGroup>
              </>
            )}
          </Container>
        </section>
      )}

      {/* ================================== faq ================================= */}
      <section className="chapter ch-ink">
        <Container size="wide">
          <div className="grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <ChapterHead eyebrow={d.learn.faq} lines={[pick(locale, "Что обычно спрашивают", "What people ask")]} />

              {!owned && (
                <div className="mt-10 border-t border-line pt-7">
                  <p className="text-[15px] leading-relaxed text-ink-2">
                    {pick(locale, "Остался вопрос — ответим до покупки.", "Still unsure? We answer before you buy.")}
                  </p>
                  <Magnetic className="mt-5">
                    <ButtonLink
                      href={course.isFree || soon ? path("/learn", locale) : path(`/learn/${course.slug}/buy`, locale)}
                      size="lg"
                      className="group"
                    >
                      {course.isFree ? d.learn.startFree : soon ? d.study.notifyMe : d.learn.buyCourse}
                      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                    </ButtonLink>
                  </Magnetic>
                </div>
              )}
            </div>

            <Accordion>
              {faq.map((entry) => (
                <AccordionItem key={entry.q} name="course-faq" title={entry.q}>
                  {entry.a}
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </Container>
      </section>

      {!owned && !course.isFree && !soon && (
        <CourseBar
          title={course.title}
          note={course.categoryLabel}
          price={formatPrice(course.priceEur, locale)}
          href={path(`/learn/${course.slug}/buy`, locale)}
          cta={d.learn.buyCourse}
        />
      )}
    </>
  );
}
