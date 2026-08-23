import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { GraduationCap, Lock, Play } from "lucide-react";
import { AppPage } from "@/components/app/page-header";
import { Badge } from "@/components/primitives/badge";
import { ButtonLink } from "@/components/primitives/button";
import { Progress } from "@/components/primitives/display";
import { EmptyState } from "@/components/primitives/states";
import { courseCover } from "@/content/covers";
import { pick } from "@/content/locale";
import { getCourses } from "@/lib/api/catalog";
import { courseCompletion, getAccess } from "@/lib/api/session";
import { getDictionary, lessonCount, path, type Locale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false } };

export default async function LearningPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const [courses, access] = await Promise.all([getCourses(locale), getAccess()]);

  const owned = courses
    .filter((course) => course.isFree || access.courseIds.has(course.id) || access.tier === "pro")
    .map((course) => ({ course, ...courseCompletion(access, course.id, course.lessonCount) }));

  const inProgress = owned.filter((item) => item.done > 0 && item.percent < 100);
  const notStarted = owned.filter((item) => item.done === 0);
  const finished = owned.filter((item) => item.percent === 100);

  const locked = courses.filter(
    (course) => !course.isFree && !access.courseIds.has(course.id) && access.tier !== "pro" && course.status === "published",
  );

  const sections = [
    { key: "progress", title: pick(locale, "В процессе", "In progress"), items: inProgress },
    { key: "new", title: pick(locale, "Не начаты", "Not started"), items: notStarted },
    { key: "done", title: pick(locale, "Завершены", "Completed"), items: finished },
  ].filter((section) => section.items.length > 0);

  return (
    <AppPage
      eyebrow={d.app.learning}
      title={pick(locale, "Мои программы", "My programmes")}
      body={pick(
        locale,
        "Всё, что открыто для вас прямо сейчас, с точным прогрессом по урокам.",
        "Everything open to you right now, with exact lesson progress.",
      )}
      action={
        <ButtonLink href={path("/learn", locale)} variant="secondary" size="sm">
          {d.nav.catalog}
        </ButtonLink>
      }
    >
      {owned.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="h-5 w-5" aria-hidden />}
          title={pick(locale, "Здесь появятся ваши курсы", "Your courses will appear here")}
          body={pick(
            locale,
            "Три программы открываются бесплатно сразу после регистрации.",
            "Three programmes open for free the moment you register.",
          )}
          action={
            <ButtonLink href={path("/learn?tab=free", locale)} size="sm">
              {d.learn.startFree}
            </ButtonLink>
          }
        />
      ) : (
        <div className="flex flex-col gap-10">
          {sections.map((section) => (
            <section key={section.key}>
              <h2 className="mb-4 flex items-center gap-2.5 text-[17px]">
                {section.title}
                <span className="font-mono text-[12px] tabular-nums text-faint">{section.items.length}</span>
              </h2>

              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {section.items.map(({ course, done, total, percent }) => {
                  const image = courseCover(course.image, course.slug);
                  return (
                    <li key={course.id}>
                      <article className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-xs transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-2 hover:shadow-md">
                        <div className="relative aspect-[21/9] overflow-hidden border-b border-line bg-surface-3">
                          {image && (
                            <Image src={image} alt="" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />
                          )}
                          {percent === 100 && (
                            <span className="absolute top-3 right-3">
                              <Badge tone="success">{d.study.done}</Badge>
                            </span>
                          )}
                        </div>

                        <div className="flex flex-1 flex-col gap-3 p-5">
                          <h3 className="text-[17px] leading-tight">
                            <Link
                              href={path(`/study/${course.slug}/${Math.min(done + 1, total)}`, locale)}
                              className="after:absolute after:inset-0 after:content-['']"
                            >
                              {course.title}
                            </Link>
                          </h3>
                          <p className="text-[12.5px] text-muted">
                            {done} / {total} · {lessonCount(total, locale, d)}
                          </p>
                          <Progress value={percent} className="mt-auto" tone={percent === 100 ? "success" : "accent"} />
                          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent-ink">
                            <Play className="h-3.5 w-3.5" aria-hidden />
                            {done > 0 ? d.common.continue : d.common.start}
                          </span>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {locked.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 flex items-center gap-2 text-[17px]">
            <Lock className="h-4 w-4 text-faint" aria-hidden />
            {pick(locale, "Ещё не открыты", "Not unlocked yet")}
          </h2>
          <ul className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
            {locked.map((course) => (
              <li key={course.id} className="flex items-center justify-between gap-4 bg-surface p-4">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-ink">{course.title}</p>
                  <p className="mt-0.5 text-[12.5px] text-muted">
                    {course.categoryLabel} · {lessonCount(course.lessonCount, locale, d)}
                  </p>
                </div>
                <ButtonLink href={path(`/learn/${course.slug}`, locale)} variant="secondary" size="sm">
                  {d.common.more}
                </ButtonLink>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AppPage>
  );
}
