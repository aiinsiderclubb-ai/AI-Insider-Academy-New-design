import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { ArrowRight, Check, Send } from "lucide-react";
import { Badge } from "@/components/primitives/badge";
import { ButtonLink } from "@/components/primitives/button";
import { Breadcrumbs } from "@/components/primitives/navigation";
import { Container } from "@/components/primitives/surface";
import { Reveal, RevealGroup } from "@/components/motion/reveal";
import { MentorFaces, MentorPortrait } from "@/components/mentors/mentor-portrait";
import { MentorConstellation } from "@/components/mentors/mentor-constellation";
import { ReviewFlow, ReviewFlowHead } from "@/components/mentors/review-flow";
import { LaunchButton } from "@/components/catalog/launch-button";
import { pick } from "@/content/locale";
import { coursesTaughtBy, mentors } from "@/content/mentors";
import { getCourses } from "@/lib/api/catalog";
import { getDictionary, lessonCount, path, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: pick(locale as Locale, "Менторы", "Mentors"),
    description: pick(
      locale as Locale,
      "Кто ведёт курсы AI Insider Academy и проверяет работы учеников.",
      "Who teaches the AI Insider Academy courses and reviews learners' work.",
    ),
  };
}

export default async function MentorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);
  const courses = await getCourses(locale);


  return (
    <>
      <Container size="wide" className="pt-8">
        <Breadcrumbs
          label={d.common.breadcrumb}
          items={[
            { label: d.brand.name, href: path("/", locale) },
            { label: pick(locale, "Менторы", "Mentors") },
          ]}
        />
      </Container>

      {/* ================================== hero ================================== */}
      <section className="relative overflow-hidden">
        <Container size="wide" className="grid items-center gap-14 pt-12 pb-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:pt-16 lg:pb-28">
          <Reveal>
            <p className="eyebrow flex items-center gap-3">
              <span className="rule-accent inline-block w-7" aria-hidden />
              {pick(locale, "Команда Академии", "The Academy team")}
            </p>
            <h1 className="mt-6 font-display text-[clamp(2.75rem,6.4vw,5.25rem)] leading-[0.92] font-extrabold tracking-[-0.04em]">
              {pick(locale, "Люди, которые", "The people who")}
              <br />
              <span className="text-accent">{pick(locale, "ведут и проверяют", "teach and review")}</span>
            </h1>
            <p className="mt-7 max-w-xl text-[16.5px] leading-relaxed text-ink-2">
              {pick(
                locale,
                "Кто записывает уроки, кто разбирает ваши задания на тарифе «С ментором» и к кому идти с вопросами — знакомьтесь.",
                "Who records the lessons, who reviews your assignments on the mentor plan and who to ask — meet them.",
              )}
            </p>

            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-line pt-7">
              <div>
                <dt className="eyebrow">{pick(locale, "Менторы", "Mentors")}</dt>
                <dd className="mt-2 font-display text-[28px] leading-none font-extrabold tabular-nums">{mentors.length}</dd>
              </div>
              <div>
                <dt className="eyebrow">{pick(locale, "Курсы", "Courses")}</dt>
                <dd className="mt-2 font-display text-[28px] leading-none font-extrabold tabular-nums">{courses.length}</dd>
              </div>
              <div>
                <dt className="eyebrow">{pick(locale, "Проверка", "Review")}</dt>
                <dd className="mt-2 text-[14px] leading-snug font-medium text-ink-2">
                  {pick(locale, "каждой работы", "of every piece of work")}
                </dd>
              </div>
            </dl>

            <div className="mt-10 flex flex-wrap gap-3">
              <ButtonLink href={path("/learn", locale)} size="lg" className="group">
                {d.nav.catalog}
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
              </ButtonLink>
              <ButtonLink href={path("/learn?tab=free", locale)} size="lg" variant="secondary">
                {d.learn.startFree}
              </ButtonLink>
            </div>
          </Reveal>

          <Reveal>
            <MentorConstellation mentors={mentors} locale={locale} />
          </Reveal>
        </Container>
      </section>

      {/* ================================ mentors ================================= */}
      <section className="chapter ch-paper">
        <Container size="wide" className="flex flex-col gap-24 lg:gap-32">
          {mentors.map((mentor, i) => {
            const name = pick(locale, mentor.nameRu, mentor.name);
            const taught = coursesTaughtBy(mentor, courses);
            const flip = i % 2 === 1;
            return (
              <Fragment key={mentor.id}>
              <article
                id={mentor.id}
                className={cn(
                  "grid scroll-mt-28 items-center gap-10 lg:gap-16",
                  flip ? "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]" : "lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]",
                )}
              >
                <Reveal className={cn(flip && "lg:order-2")}>
                  <MentorPortrait
                    src={mentor.photo}
                    alt={name}
                    caption={name}
                    note={pick(locale, mentor.roleRu, mentor.role)}
                    className="mx-auto w-full max-w-[400px] lg:max-w-none"
                  />
                </Reveal>

                <Reveal className="min-w-0">
                  <p className="font-mono text-[12px] tracking-[0.2em] text-faint">{String(i + 1).padStart(2, "0")}</p>
                  <h2 className="mt-3 font-display text-[clamp(2.4rem,5.4vw,4rem)] leading-[0.94] font-extrabold tracking-[-0.035em]">
                    {name}
                  </h2>
                  <p className="mt-4 text-[14px] font-medium text-accent-ink">{pick(locale, mentor.roleRu, mentor.role)}</p>
                  <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-ink-2">{pick(locale, mentor.bioRu, mentor.bio)}</p>

                  {mentor.facts.length > 0 && (
                    <ul className="mt-7 flex flex-wrap gap-2">
                      {mentor.facts.map((fact) => (
                        <li
                          key={fact.en}
                          className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-surface px-3.5 py-1.5 text-[13px] text-ink-2"
                        >
                          <Check className="h-3.5 w-3.5 text-accent" aria-hidden />
                          {pick(locale, fact.ru, fact.en)}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-9">
                    <p className="eyebrow">
                      {mentor.reviewsOnly ? pick(locale, "Чем занимается", "What they do") : pick(locale, "Ведёт курсы", "Teaches")}
                    </p>
                    {mentor.reviewsOnly ? (
                      <p className="mt-4 max-w-xl rounded-2xl border border-line-2 bg-surface p-5 text-[14px] leading-relaxed text-ink-2">
                        {pick(
                          locale,
                          "Проверяет задания на тарифе «С ментором» по всем курсам Академии.",
                          "Reviews assignments on the mentor plan across every Academy course.",
                        )}
                      </p>
                    ) : (
                      <RevealGroup step={50} className="mt-4 grid gap-2.5 sm:grid-cols-2">
                        {taught.map((course) => (
                          <Link
                            key={course.id}
                            href={path(`/learn/${course.slug}`, locale)}
                            className="group flex items-center justify-between gap-3 rounded-2xl border border-line-2 bg-surface px-4 py-3.5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-accent/45"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-[14px] font-medium text-ink">{course.title}</span>
                              <span className="mt-0.5 block text-[12px] text-muted">
                                {course.status === "in-development"
                                  ? d.badges.soon
                                  : course.isFree
                                    ? d.common.free
                                    : lessonCount(course.lessonCount, locale, d)}
                              </span>
                            </span>
                            {course.status === "in-development" ? (
                              <Badge tone="warning">{d.badges.soon}</Badge>
                            ) : (
                              <ArrowRight
                                className="h-4 w-4 shrink-0 text-faint transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-accent"
                                aria-hidden
                              />
                            )}
                          </Link>
                        ))}
                      </RevealGroup>
                    )}
                  </div>

                  {mentor.links && mentor.links.length > 0 && (
                    <div className="mt-7 flex flex-wrap gap-4">
                      {mentor.links.map((link) => (
                        <a
                          key={link.href}
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-ink-2 transition-colors hover:text-accent-ink"
                        >
                          <Send className="h-3.5 w-3.5" aria-hidden />
                          {link.label}
                        </a>
                      ))}
                    </div>
                  )}
                </Reveal>
              </article>
              </Fragment>
            );
          })}
        </Container>
      </section>

      {/* ============================== how review works ============================== */}
      <section className="chapter">
        <Container size="wide">
          <ReviewFlowHead locale={locale} />
          <div className="mt-12">
            <ReviewFlow locale={locale} />
          </div>

          <Reveal>
            <div className="free-start mt-20">
              <div className="free-start-inner relative">
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-8 p-7 sm:p-10">
                  <div className="flex max-w-xl items-center gap-5">
                    <MentorFaces people={mentors.map((m) => ({ photo: m.photo, name: pick(locale, m.nameRu, m.name) }))} size={44} />
                    <div>
                      <p className="font-display text-[clamp(1.5rem,3vw,2.1rem)] leading-tight font-extrabold tracking-[-0.02em]">
                        {pick(locale, "Начните с бесплатного курса", "Start with a free course")}
                      </p>
                      <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">
                        {pick(
                          locale,
                          "Регистрация занимает минуту — уроки открываются сразу.",
                          "Registration takes a minute and the lessons open immediately.",
                        )}
                      </p>
                    </div>
                  </div>
                  <LaunchButton
                    href={path("/learn?tab=free", locale)}
                    label={d.learn.startFree}
                    pendingLabel={pick(locale, "Открываем…", "Opening…")}
                  />
                </div>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
