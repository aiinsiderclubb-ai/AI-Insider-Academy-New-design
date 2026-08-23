import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Clock } from "lucide-react";
import { AppPage } from "@/components/app/page-header";
import { Badge } from "@/components/primitives/badge";
import { ButtonLink } from "@/components/primitives/button";
import { Progress } from "@/components/primitives/display";
import { EmptyState, Note } from "@/components/primitives/states";
import { gradingStandard } from "@/content/catalog";
import { pick } from "@/content/locale";
import { getCourses } from "@/lib/api/catalog";
import { getAccess } from "@/lib/api/session";
import { getDictionary, lessonCount, path, type Locale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false } };

export default async function HomeworkPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const [courses, access] = await Promise.all([getCourses(locale), getAccess()]);
  const grading = gradingStandard[locale === "en" ? "en" : "ru"];

  const tracks = courses
    .filter((course) => course.hasHomework)
    .filter((course) => access.courseIds.has(course.id) || access.tier === "pro" || course.isFree)
    .map((course) => {
      const progress = access.progress[course.id];
      const accepted = progress?.homeworkChecked?.length ?? 0;
      // Lesson 1 is an intro; assignments start from the second lesson.
      const total = Math.max(0, course.lessonCount - 1);
      return { course, accepted, total, percent: total ? Math.round((accepted / total) * 100) : 0 };
    });

  return (
    <AppPage
      eyebrow={d.app.homework}
      title={pick(locale, "Задания и проверка", "Assignments and review")}
      body={pick(
        locale,
        "Каждое задание проверяет куратор. Следующий урок открывается после приёмки.",
        "A curator reviews every assignment. The next lesson opens once yours is accepted.",
      )}
    >
      {tracks.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" aria-hidden />}
          title={pick(locale, "Заданий пока нет", "No assignments yet")}
          body={pick(
            locale,
            "Задания появляются в платных программах со второго урока.",
            "Assignments start from the second lesson of the paid programmes.",
          )}
          action={
            <ButtonLink href={path("/learn", locale)} size="sm">
              {d.nav.catalog}
            </ButtonLink>
          }
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {tracks.map(({ course, accepted, total, percent }) => (
            <li key={course.id} className="rounded-lg border border-line bg-surface p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="eyebrow">{course.categoryLabel}</p>
                  <h2 className="mt-2 text-[17px] leading-tight">{course.title}</h2>
                </div>
                <Badge tone={percent === 100 ? "success" : accepted > 0 ? "accent" : "neutral"}>
                  {accepted}/{total}
                </Badge>
              </div>
              <Progress value={percent} className="mt-4" label={d.study.homeworkAccepted} />
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-[12.5px] text-muted">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  {lessonCount(course.lessonCount, locale, d)}
                </span>
                <Link
                  href={path(`/study/${course.slug}/${Math.min(accepted + 2, course.lessonCount)}`, locale)}
                  className="text-[13px] font-medium text-accent-ink underline-offset-4 hover:underline"
                >
                  {d.study.submitHomework}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {grading && (
        <section className="mt-10">
          <h2 className="text-[17px]">{grading.title}</h2>
          <div className="mt-4 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
            {grading.levels.map((level, index) => (
              <div key={level.name} className="bg-surface p-5">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-0.5" aria-hidden>
                    {[0, 1, 2].map((step) => (
                      <span
                        key={step}
                        className={step <= index ? "h-1.5 w-1.5 rounded-full bg-accent" : "h-1.5 w-1.5 rounded-full bg-line-2"}
                      />
                    ))}
                  </span>
                  <span className="text-[15px] font-semibold text-ink">{level.name}</span>
                </div>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-3">{level.desc}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {access.prelaunch && (
        <Note tone="warning" className="mt-8">
          {pick(
            locale,
            "В режиме предзапуска приём домашних заданий отключён на стороне API.",
            "Assignment submission is disabled API-side while the platform is in prelaunch.",
          )}
        </Note>
      )}
    </AppPage>
  );
}
