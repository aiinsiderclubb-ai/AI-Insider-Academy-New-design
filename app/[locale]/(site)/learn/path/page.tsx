import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Lock } from "lucide-react";
import { Badge, Stat } from "@/components/primitives/badge";
import { Breadcrumbs } from "@/components/primitives/navigation";
import { ButtonLink } from "@/components/primitives/button";
import { Container, SectionHead } from "@/components/primitives/surface";
import { Progress } from "@/components/primitives/display";
import { Note } from "@/components/primitives/states";
import { academyPrinciples, learningStages } from "@/content/catalog";
import { pick } from "@/content/locale";
import { getCourses } from "@/lib/api/catalog";
import { courseCompletion, getAccess } from "@/lib/api/session";
import { formatPrice, getDictionary, lessonCount, path, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const d = getDictionary(locale);
  return { title: d.nav.path, description: d.learn.body };
}

export default async function LearningPathPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const [courses, access] = await Promise.all([getCourses(locale), getAccess()]);
  const byId = new Map(courses.map((course) => [course.id, course]));

  const stages = learningStages.map((stage) => {
    const items = stage.courseIds.map((id) => byId.get(id)).filter((course): course is NonNullable<typeof course> => Boolean(course));
    const done = items.filter((course) => courseCompletion(access, course.id, course.lessonCount).percent === 100).length;
    return { stage, items, done, percent: items.length ? Math.round((done / items.length) * 100) : 0 };
  });

  const totalLessons = courses.reduce((sum, course) => sum + course.lessonCount, 0);

  return (
    <>
      <Container size="wide" className="pt-8">
        <Breadcrumbs
          label={d.common.breadcrumb}
          items={[
            { label: d.brand.name, href: path("/", locale) },
            { label: d.learn.title, href: path("/learn", locale) },
            { label: d.nav.path },
          ]}
        />
      </Container>

      <Container size="wide" className="pt-7 pb-12">
        <div className="grid gap-x-14 gap-y-9 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div>
            <p className="eyebrow">{d.learn.subtitle}</p>
            <h1 className="mt-5 text-[clamp(2.1rem,5vw,3.5rem)] leading-[0.99] tracking-[-0.04em]">{d.nav.path}</h1>
            <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-2">
              {pick(locale, academyPrinciples.ru, academyPrinciples.en)}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-6 self-end">
            <Stat value={learningStages.length} label={pick(locale, "этапа маршрута", "route stages")} />
            <Stat value={courses.length} label={d.home.statsCourses} />
            <Stat value={totalLessons} label={d.home.statsLessons} />
            <Stat value={courses.filter((course) => course.isFree).length} label={d.learn.tabFree} />
          </dl>
        </div>
      </Container>

      <Container size="wide" className="pb-20">
        <ol className="relative flex flex-col gap-6">
          {stages.map(({ stage, items, done, percent }, stageIndex) => (
            <li key={stage.id} className="relative">
              {/* the rail is the route: it literally connects the stages */}
              {stageIndex < stages.length - 1 && (
                <span aria-hidden className="absolute top-14 bottom-[-1.5rem] left-[19px] w-px bg-line" />
              )}

              <div className="flex gap-5">
                <span
                  className={cn(
                    "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border font-mono text-[13px] tabular-nums",
                    percent === 100
                      ? "border-success bg-success text-white"
                      : "border-accent bg-accent-soft text-accent-ink",
                  )}
                >
                  {percent === 100 ? <Check className="h-4 w-4" aria-hidden /> : stage.order}
                </span>

                <div className="min-w-0 flex-1 rounded-lg border border-line bg-surface p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-[20px] leading-tight">{pick(locale, stage.title, stage.titleEn)}</h2>
                      <p className="mt-2 text-[13.5px] text-muted">{pick(locale, stage.subtitle, stage.subtitleEn)}</p>
                    </div>
                    {access.signedIn && items.length > 0 && (
                      <div className="w-40">
                        <Progress value={percent} size="sm" label={`${done}/${items.length}`} />
                      </div>
                    )}
                  </div>

                  <ul className="mt-5 flex flex-col gap-px overflow-hidden rounded-md border border-line bg-line">
                    {items.map((course) => {
                      const open = course.isFree || access.courseIds.has(course.id) || access.tier === "pro";
                      const completion = courseCompletion(access, course.id, course.lessonCount);
                      return (
                        <li key={course.id} className="bg-surface transition-colors hover:bg-surface-2">
                          <Link
                            href={path(`/learn/${course.slug}`, locale)}
                            className="flex flex-wrap items-center justify-between gap-3 p-4"
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              {!open && <Lock className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />}
                              <span className="min-w-0">
                                <span className="block truncate text-[14.5px] font-medium text-ink">{course.title}</span>
                                <span className="mt-0.5 block text-[12.5px] text-muted">
                                  {course.categoryLabel} · {lessonCount(course.lessonCount, locale, d)}
                                </span>
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-3">
                              {access.signedIn && completion.percent > 0 && (
                                <Badge tone={completion.percent === 100 ? "success" : "accent"}>{completion.percent}%</Badge>
                              )}
                              <span className="font-mono text-[13px] tabular-nums text-ink-2">
                                {course.isFree ? d.common.free : formatPrice(course.priceEur, locale)}
                              </span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <Note className="mt-8">{d.plans.oneTimeNote}</Note>

        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href={path("/learn?tab=free", locale)} size="lg" className="group">
            {d.learn.startFree}
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
          </ButtonLink>
          <ButtonLink href={path("/learn", locale)} variant="secondary" size="lg">
            {d.nav.catalog}
          </ButtonLink>
        </div>
      </Container>
    </>
  );
}
