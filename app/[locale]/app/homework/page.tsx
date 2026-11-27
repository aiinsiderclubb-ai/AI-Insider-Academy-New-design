import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Clock } from "lucide-react";
import { AppPage } from "@/components/app/page-header";
import { Badge } from "@/components/primitives/badge";
import { ButtonLink } from "@/components/primitives/button";
import { Progress } from "@/components/primitives/display";
import { EmptyState, Note } from "@/components/primitives/states";
import { gradingStandard, lessonHomework } from "@/content/catalog";
import { pick } from "@/content/locale";
import { getCourses } from "@/lib/api/catalog";
import { getAccess, hasReview, ownsCourse } from "@/lib/api/session";
import { getDictionary, lessonCount, path, type Locale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false } };

export default async function HomeworkPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const d = getDictionary(locale);

  const [courses, access] = await Promise.all([getCourses(locale), getAccess()]);
  const grading = gradingStandard[locale === "en" ? "en" : "ru"];

  /*
   * A lesson carries an assignment when one is written for it, or — on a
   * reviewed programme — from its second lesson on (the shared wording the
   * study room falls back to). Free courses are practice the learner checks
   * themselves; there "done" means the lesson is finished.
   */
  const tracks = courses
    .filter((course) => ownsCourse(access, course))
    .map((course) => {
      const lessons = course.lessons.filter(
        (lesson, index) => lessonHomework(course.id, lesson.id) || (course.hasHomework && index > 0),
      );
      const reviewed = course.hasHomework && hasReview(access, course);
      const progress = access.progress[course.id];
      const finished = new Set(reviewed ? (progress?.homeworkChecked ?? []) : (progress?.watched ?? []));
      const accepted = lessons.filter((lesson) => finished.has(lesson.index)).length;
      const total = lessons.length;
      const nextLesson = lessons.find((lesson) => !finished.has(lesson.index)) ?? lessons[0];
      return { course, reviewed, accepted, total, nextLesson, percent: total ? Math.round((accepted / total) * 100) : 0 };
    })
    .filter((track) => track.total > 0);

  return (
    <AppPage
      eyebrow={d.app.homework}
      title={pick(locale, "Задания и проверка", "Assignments and review")}
      body={pick(
        locale,
        "В программах с проверкой работу смотрит куратор и отвечает в уведомлениях. В бесплатных курсах задания — для самопроверки по критериям.",
        "On reviewed programmes a curator checks your work and replies in your notifications. On free courses the assignments are practice you check against the criteria.",
      )}
    >
      {tracks.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" aria-hidden />}
          title={pick(locale, "Заданий пока нет", "No assignments yet")}
          body={pick(
            locale,
            "Начните любой курс — задания к урокам появятся здесь.",
            "Start any course and its lesson assignments will appear here.",
          )}
          action={
            <ButtonLink href={path("/learn", locale)} size="sm">
              {d.nav.catalog}
            </ButtonLink>
          }
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {tracks.map(({ course, reviewed, accepted, total, percent, nextLesson }) => (
            <li key={course.id} className="rounded-lg border border-line bg-surface p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="eyebrow">
                    {course.categoryLabel} · {reviewed ? pick(locale, "проверяет куратор", "curator-reviewed") : pick(locale, "самопроверка", "self-check")}
                  </p>
                  <h2 className="mt-2 text-[17px] leading-tight">{course.title}</h2>
                </div>
                <Badge tone={percent === 100 ? "success" : accepted > 0 ? "accent" : "neutral"}>
                  {accepted}/{total}
                </Badge>
              </div>
              <Progress
                value={percent}
                className="mt-4"
                label={reviewed ? d.study.homeworkAccepted : pick(locale, "Уроков с заданием пройдено", "Assignment lessons done")}
              />
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-[12.5px] text-muted">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  {lessonCount(course.lessonCount, locale, d)}
                </span>
                <Link
                  href={path(`/study/${course.slug}/${(nextLesson?.index ?? 0) + 1}`, locale)}
                  className="text-[13px] font-medium text-accent-ink underline-offset-4 hover:underline"
                >
                  {percent === 100 ? pick(locale, "Открыть задания", "Open assignments") : reviewed ? d.study.submitHomework : pick(locale, "К заданию", "To the assignment")}
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
